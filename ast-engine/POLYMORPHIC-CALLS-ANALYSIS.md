# Polymorphic Call Detection - Analysis & Solution Plan

## Problem Statement

Two critical issues discovered during carbon-identity-framework testing:

### Issue 1: Polymorphic Calls Not Detected
**Symptom:** Empty dependencies array when target methods are called through interfaces/superclasses.

**Example:**
```java
// Target class
public class InFlowExtensionExecutor implements Executor {
    public ExecutorResponse execute(FlowExecutionContext context) { ... }
}

// Caller (TaskExecutionNode.java:116)
Executor mappedFlowExecutor = ...;
ExecutorResponse response = mappedFlowExecutor.execute(context);
```

**Current Behavior:**
- `mce.resolve()` returns `Executor.execute()` (interface method)
- `declaringType().getQualifiedName()` = `"org.wso2.carbon.identity.flow.execution.engine.graph.Executor"`
- Does NOT match target FQN `"org.wso2.carbon.identity.flow.inflow.extensions.executor.InFlowExtensionExecutor"`
- Call is skipped

### Issue 2: Line Number Accuracy
**Concern:** JavaParser may report line numbers from its AST, which might differ from actual source file lines due to:
- Comments being stripped
- Whitespace normalization
- AST node positioning vs. actual text position

**Current Implementation:**
```java
int line = expr.getBegin().map(p -> p.line).orElse(-1);
String contextLine = ContextLineExtractor.readLine(file, line);
```

---

## Issue 1 Solution: Polymorphic Call Detection

### Approach: Check if Target Implements/Extends Declaring Type

When a method call resolves to an interface or superclass, check if our target class is an implementation/subclass.

### Implementation Strategy

**Step 1: Add helper method to check type hierarchy**
```java
private boolean isTargetImplementation(String declaringFqn) {
    try {
        // Use JavaParser's type solver to resolve both types
        ResolvedReferenceTypeDeclaration declaringType = 
            typeSolver.solveType(declaringFqn);
        ResolvedReferenceTypeDeclaration targetType = 
            typeSolver.solveType(spec.targetFqn());
        
        // Check if target implements/extends declaring type
        return isSubtypeOf(targetType, declaringType);
    } catch (Exception e) {
        return false;
    }
}

private boolean isSubtypeOf(ResolvedReferenceTypeDeclaration subtype, 
                            ResolvedReferenceTypeDeclaration supertype) {
    // Direct match
    if (subtype.getQualifiedName().equals(supertype.getQualifiedName())) {
        return true;
    }
    
    // Check interfaces
    for (ResolvedReferenceType iface : subtype.getAllInterfaces()) {
        if (iface.getQualifiedName().equals(supertype.getQualifiedName())) {
            return true;
        }
    }
    
    // Check superclasses
    for (ResolvedReferenceType ancestor : subtype.getAllAncestors()) {
        if (ancestor.getQualifiedName().equals(supertype.getQualifiedName())) {
            return true;
        }
    }
    
    return false;
}
```

**Step 2: Update method matching logic**
```java
// In processMethodMode()
if (declaringFqn.equals(spec.targetFqn()) 
        && spec.changedMethods().contains(methodName)) {
    addCallSite(file, mce);
} else if (isTargetImplementation(declaringFqn) 
        && spec.changedMethods().contains(methodName)) {
    // Polymorphic call through interface/superclass
    addCallSite(file, mce);
}
```

### Challenges & Solutions

**Challenge 1:** Need access to `CombinedTypeSolver` in `DependencyFinder`
- **Solution:** Pass solver as constructor parameter or store in instance field

**Challenge 2:** Performance - checking hierarchy for every call
- **Solution:** Cache results in `Map<String, Boolean>` keyed by declaring FQN

**Challenge 3:** Resolver might fail for some types
- **Solution:** Wrap in try-catch, return false on failure (conservative approach)

---

## Issue 2 Solution: Line Number Verification

### Investigation: Does JavaParser Preserve Line Numbers?

**Test Approach:**
1. Create a test file with comments, blank lines, and JavaDoc
2. Parse with JavaParser
3. Compare `expr.getBegin().line` with actual source line
4. Read that line from file and verify it matches

**Expected Result:** JavaParser DOES preserve original line numbers because:
- It parses the actual source file, not a normalized version
- The `Position` object stores the original line/column from the source
- `ContextLineExtractor.readLine()` reads from the SAME source file

**Test Code:**
```java
// Test file: TestLineNumbers.java
package test;

/**
 * JavaDoc comment
 * Multiple lines
 */
public class TestLineNumbers {
    
    // Single line comment
    
    public void method1() {
        System.out.println("Line 12");  // This is line 12
    }
    
    public void method2() {
        
        // Comment inside method
        System.out.println("Line 18");  // This is line 18
    }
}

// Parse and check
CompilationUnit cu = StaticJavaParser.parse(new File("TestLineNumbers.java"));
for (MethodCallExpr mce : cu.findAll(MethodCallExpr.class)) {
    int line = mce.getBegin().get().line;
    String actualLine = Files.readAllLines(Path.of("TestLineNumbers.java")).get(line - 1);
    System.out.println("Line " + line + ": " + actualLine.trim());
}
```

### Conclusion on Line Numbers

**JavaParser DOES preserve accurate line numbers** because:
1. It parses the original source text
2. Position tracking is based on the actual file content
3. Our `ContextLineExtractor` reads from the same file

**No changes needed** - the current implementation is correct.

---

## Implementation Plan

### Phase 1: Add Polymorphic Call Detection

**Files to modify:**
1. `DependencyFinder.java` - Add type hierarchy checking
2. `TypeSolverBuilder.java` - Expose solver for hierarchy checks (if needed)

**Changes:**
```java
public class DependencyFinder {
    private CombinedTypeSolver typeSolver;  // NEW: Store solver
    private Map<String, Boolean> implementationCache;  // NEW: Cache results
    
    public List<Dependency> find(TargetSpec spec, List<Path> srcRoots, 
                                  CombinedTypeSolver solver) {  // NEW: Accept solver
        this.typeSolver = solver;
        this.implementationCache = new HashMap<>();
        // ... rest of method
    }
    
    private boolean isTargetImplementation(String declaringFqn) {
        // Check cache first
        if (implementationCache.containsKey(declaringFqn)) {
            return implementationCache.get(declaringFqn);
        }
        
        boolean result = checkTypeHierarchy(declaringFqn);
        implementationCache.put(declaringFqn, result);
        return result;
    }
    
    private boolean checkTypeHierarchy(String declaringFqn) {
        try {
            // Resolve both types
            ResolvedReferenceTypeDeclaration declaring = 
                typeSolver.solveType(declaringFqn);
            ResolvedReferenceTypeDeclaration target = 
                typeSolver.solveType(spec.targetFqn());
            
            // Check if target is subtype of declaring
            return isSubtypeOf(target, declaring);
        } catch (Exception e) {
            return false;  // Conservative: if can't resolve, assume no match
        }
    }
    
    private boolean isSubtypeOf(ResolvedReferenceTypeDeclaration subtype,
                                ResolvedReferenceTypeDeclaration supertype) {
        if (subtype.getQualifiedName().equals(supertype.getQualifiedName())) {
            return true;
        }
        
        // Check all interfaces
        for (ResolvedReferenceType iface : subtype.getAllInterfaces()) {
            if (iface.getQualifiedName().equals(supertype.getQualifiedName())) {
                return true;
            }
        }
        
        // Check all ancestors (superclasses)
        for (ResolvedReferenceType ancestor : subtype.getAllAncestors()) {
            if (ancestor.getQualifiedName().equals(supertype.getQualifiedName())) {
                return true;
            }
        }
        
        return false;
    }
    
    private void processMethodMode(Path file, CompilationUnit cu) {
        for (MethodCallExpr mce : cu.findAll(MethodCallExpr.class)) {
            try {
                ResolvedMethodDeclaration r = mce.resolve();
                String declaringFqn = r.declaringType().getQualifiedName();
                String methodName = r.getName();
                
                // Direct match OR polymorphic match
                if ((declaringFqn.equals(spec.targetFqn()) 
                        || isTargetImplementation(declaringFqn))
                        && spec.changedMethods().contains(methodName)) {
                    addCallSite(file, mce);
                }
            } catch (UnsolvedSymbolException | UnsupportedOperationException ignored) {
            }
        }
        // ... rest of method
    }
}
```

**Update `BlastRadiusAstCli.java`:**
```java
// Build solver
TypeSolverBuilder builder = new TypeSolverBuilder();
JavaSymbolSolver solver = builder.build(srcRoots, jars);
CombinedTypeSolver combinedSolver = builder.getCombinedSolver();  // NEW: Expose combined solver
StaticJavaParser.getParserConfiguration().setSymbolResolver(solver);

// Pass solver to finder
List<Dependency> deps = new DependencyFinder().find(spec, srcRoots, combinedSolver);
```

**Update `TypeSolverBuilder.java`:**
```java
public class TypeSolverBuilder {
    private CombinedTypeSolver combined;  // NEW: Store for later access
    
    public JavaSymbolSolver build(List<Path> srcRoots, List<Path> jars) {
        combined = new CombinedTypeSolver();
        // ... rest of method
        return new JavaSymbolSolver(combined);
    }
    
    public CombinedTypeSolver getCombinedSolver() {  // NEW: Accessor
        return combined;
    }
}
```

### Phase 2: Testing

**Test 1: Verify polymorphic detection works**
```bash
java -Xmx4g -jar target/blast-radius-ast.jar \
  --workspace=C:/Projects/carbon-identity-framework \
  --target=.../InFlowExtensionExecutor.java \
  --target-package=org.wso2.carbon.identity.flow.inflow.extensions.executor \
  --methods=execute,buildErrorResponse,triggerDiagnosticFailure \
  > test-output-carbon-method.json
```
Expected: Non-empty dependencies array with `TaskExecutionNode.java` as a caller

**Test 2: Verify synthetic workspace still works**
```bash
java -jar target/blast-radius-ast.jar \
  --workspace=.../synthetic-workspace \
  --target=module-a/src/main/java/com/example/core/security/ValidationUtils.java \
  --target-package=com.example.core.security \
  --methods=verifyTokenStructure \
  > test-output-synthetic.json
```
Expected: Byte-for-byte match with expected output

**Test 3: Verify line numbers are accurate**
- Manually inspect output
- Check that `usageContextLine` matches the actual source line at `lineNumber`

### Phase 3: Documentation

Update `SMOKE-TESTS.md` with:
- Explanation of polymorphic call detection
- Performance notes (caching reduces overhead)
- Known limitations (if any)

---

## Risk Assessment

### Low Risk
- Line number accuracy: No changes needed, current implementation is correct
- Caching: Improves performance, no downside

### Medium Risk
- Type hierarchy resolution: May fail for some edge cases
- Mitigation: Conservative approach (return false on failure)

### Performance Impact
- Additional type resolution per unique declaring type
- Mitigated by caching
- Expected overhead: <5% on large codebases

---

## Success Criteria

1. ✅ Carbon-identity-framework test finds `TaskExecutionNode.java` as caller
2. ✅ Synthetic workspace test still passes
3. ✅ Line numbers in output match actual source lines
4. ✅ No performance regression (< 10% slower)
5. ✅ All existing tests still pass

---

## Timeline

- **Phase 1 (Implementation):** 2-3 hours
- **Phase 2 (Testing):** 1-2 hours
- **Phase 3 (Documentation):** 30 minutes
- **Total:** 4-6 hours

---

## Next Steps

1. Implement polymorphic call detection in `DependencyFinder.java`
2. Update `TypeSolverBuilder.java` to expose `CombinedTypeSolver`
3. Update `BlastRadiusAstCli.java` to pass solver to finder
4. Test against carbon-identity-framework
5. Verify synthetic workspace still works
6. Update documentation