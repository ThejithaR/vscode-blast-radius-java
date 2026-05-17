# AST Engine Smoke Tests

Comprehensive test scenarios for validating the AST engine against real-world codebases.

## Prerequisites

```bash
# Build the AST engine
cd vscode-blast-radius-java/ast-engine
mvn -q package

# Verify JAR exists
ls -lh target/blast-radius-ast.jar
```

## Test 1: Synthetic Workspace (Unit Test)

**Purpose:** Validate core functionality with a minimal, controlled workspace.

**Location:** `shared/examples/ast-test-samples/synthetic-workspace/`

**Command:**
```bash
java -jar target/blast-radius-ast.jar \
  --workspace=../shared/examples/ast-test-samples/synthetic-workspace \
  --target=module-a/src/main/java/com/example/core/security/ValidationUtils.java \
  --target-package=com.example.core.security \
  --methods=verifyTokenStructure \
  > test-output-synthetic.json
```

**Expected Results:**
- Exit code: 0
- Output: Valid JSON matching `shared/examples/ast-test-samples/test-output-synthetic.json`
- 3 dependencies found (AuditLogger, InternalBillingController, JwtAuthFilter)
- Each with exactly 1 call site
- Line numbers: 142, 54, 87
- Alphabetically sorted by filePath

**Validation:**
```bash
# Schema validation
npx ajv-cli validate \
  -s ../shared/contracts/ast-dependencies-output.schema.json \
  -d test-output-synthetic.json

# Byte-for-byte comparison
diff test-output-synthetic.json \
  ../shared/examples/ast-test-samples/test-output-synthetic.json
```

---

## Test 2: Carbon Identity Framework - Method Mode

**Purpose:** Validate against a real-world, large-scale Java OSGi codebase.

**Prerequisites:**
- Clone carbon-identity-framework: `git clone https://github.com/wso2/carbon-identity-framework.git`
- Prime Maven cache: `cd carbon-identity-framework && mvn -DskipTests dependency:resolve`

**Command (PowerShell):**
```powershell
java -Xmx4g -jar target\blast-radius-ast.jar `
  --workspace="C:\Projects\carbon-identity-framework" `
  --target="components/flow-orchestration-framework/org.wso2.carbon.identity.flow.inflow.extensions/src/main/java/org/wso2/carbon/identity/flow/inflow/extensions/executor/InFlowExtensionExecutor.java" `
  --target-package="org.wso2.carbon.identity.flow.inflow.extensions.executor" `
  --methods="execute,buildErrorResponse,triggerDiagnosticFailure" `
  > smoke-test-method-mode.json
```

**Command (Bash):**
```bash
java -Xmx4g -jar target/blast-radius-ast.jar \
  --workspace=/path/to/carbon-identity-framework \
  --target=components/flow-orchestration-framework/org.wso2.carbon.identity.flow.inflow.extensions/src/main/java/org/wso2/carbon/identity/flow/inflow/extensions/executor/InFlowExtensionExecutor.java \
  --target-package=org.wso2.carbon.identity.flow.inflow.extensions.executor \
  --methods=execute,buildErrorResponse,triggerDiagnosticFailure \
  > smoke-test-method-mode.json
```

**Expected Results:**
- Exit code: 0
- Processing time: 30-60 seconds
- Source roots found: ~87
- JARs found: ~1700-1800
- Dependencies: Non-empty (at least internal flow-orchestration callers)
- Every dependency has `callSites.length >= 1`
- No duplicate (filePath, callerMethod, lineNumber) tuples

**Validation:**
```bash
echo $?  # Should be 0
npx ajv-cli validate \
  -s ../shared/contracts/ast-dependencies-output.schema.json \
  -d smoke-test-method-mode.json
```

**Memory Requirements:**
- Minimum: 2GB heap (`-Xmx2g`)
- Recommended: 4GB heap (`-Xmx4g`)
- If out-of-memory errors occur, increase heap size or system paging file

---

## Test 3: Carbon Identity Framework - Class-Sweep Mode

**Purpose:** Validate class-level reference detection (empty methods list).

**Command (PowerShell):**
```powershell
java -Xmx4g -jar target\blast-radius-ast.jar `
  --workspace="C:\Projects\carbon-identity-framework" `
  --target="components/flow-orchestration-framework/org.wso2.carbon.identity.flow.inflow.extensions/src/main/java/org/wso2/carbon/identity/flow/inflow/extensions/executor/InFlowExtensionExecutor.java" `
  --target-package="org.wso2.carbon.identity.flow.inflow.extensions.executor" `
  --methods="" `
  > smoke-test-class-sweep.json
```

**Command (Bash):**
```bash
java -Xmx4g -jar target/blast-radius-ast.jar \
  --workspace=/path/to/carbon-identity-framework \
  --target=components/flow-orchestration-framework/org.wso2.carbon.identity.flow.inflow.extensions/src/main/java/org/wso2/carbon/identity/flow/inflow/extensions/executor/InFlowExtensionExecutor.java \
  --target-package=org.wso2.carbon.identity.flow.inflow.extensions.executor \
  --methods= \
  > smoke-test-class-sweep.json
```

**Alternative (omit flag entirely):**
```bash
java -Xmx4g -jar target/blast-radius-ast.jar \
  --workspace=/path/to/carbon-identity-framework \
  --target=components/flow-orchestration-framework/org.wso2.carbon.identity.flow.inflow.extensions/src/main/java/org/wso2/carbon/identity/flow/inflow/extensions/executor/InFlowExtensionExecutor.java \
  --target-package=org.wso2.carbon.identity.flow.inflow.extensions.executor \
  > smoke-test-class-sweep.json
```

**Expected Results:**
- Exit code: 0
- Dependency count: >= Test 2 count (superset)
- Includes all method calls PLUS:
  - Constructor calls (`new InFlowExtensionExecutor(...)`)
  - Field access (`InFlowExtensionExecutor.CONSTANT`)
  - Type references (`InFlowExtensionExecutor` as variable type)
  - Import statements

---

## Test 4: Error Handling

### 4.1 Missing Arguments
```bash
java -jar C:/Projects/vscode-blast-radius-java/ast-engine/target/blast-radius-ast.jar
```
**Expected:** Exit 1, usage message to stderr

### 4.2 Non-Existent Workspace
```bash
java -jar C:/Projects/vscode-blast-radius-java/ast-engine/target/blast-radius-ast.jar \
  --workspace=C:/does/not/exist \
  --target=Foo.java \
  --target-package=com.example
```
**Expected:** Exit 2, no JSON to stdout

### 4.3 Workspace Without pom.xml
```bash
mkdir C:/tmp/empty-workspace
java -jar C:/Projects/vscode-blast-radius-java/ast-engine/target/blast-radius-ast.jar \
  --workspace=C:/tmp/empty-workspace \
  --target=Foo.java \
  --target-package=com.example
```
**Expected:** Exit 2, "No pom.xml found under workspace" to stderr

---

## Test 5: Determinism

Run the same command twice and verify byte-identical output:

```bash
java -jar C:/Projects/vscode-blast-radius-java/ast-engine/target/blast-radius-ast.jar \
  --workspace=C:/Projects/vscode-blast-radius-java/shared/examples/ast-test-samples/synthetic-workspace \
  --target=module-a/src/main/java/com/example/core/security/ValidationUtils.java \
  --target-package=com.example.core.security \
  --methods=verifyTokenStructure \
  > run1.json

java -jar C:/Projects/vscode-blast-radius-java/ast-engine/target/blast-radius-ast.jar \
  --workspace=C:/Projects/vscode-blast-radius-java/shared/examples/ast-test-samples/synthetic-workspace \
  --target=module-a/src/main/java/com/example/core/security/ValidationUtils.java \
  --target-package=com.example.core.security \
  --methods=verifyTokenStructure \
  > run2.json

diff run1.json run2.json
```

**Expected:** No differences (exit code 0 from diff)

---

## Troubleshooting

### Out of Memory Errors

**Symptoms:**
```
# There is insufficient memory for the Java Runtime Environment to continue.
# Native memory allocation (malloc) failed to allocate X bytes
```

**Solutions:**
1. Increase JVM heap: `-Xmx4g` or `-Xmx8g`
2. Increase system paging file (Windows) or swap space (Linux)
3. Close other applications to free memory
4. Test with a smaller workspace first

### Parse Errors

**Symptoms:**
```
parse-skip /path/to/File.java: No data of this type found
```

**Expected Behavior:** These are logged to stderr and the file is skipped. The CLI continues processing other files. This is normal for files with JavaParser-incompatible syntax or encoding issues.

### Slow Performance

**Expected:** 30-60 seconds for carbon-identity-framework (87 source roots, ~1700 JARs)

**If slower:**
- Check disk I/O (especially for `~/.m2/repository` access)
- Verify SSD vs HDD
- Consider running `mvn dependency:resolve` first to prime the cache

---

## Success Criteria

All tests pass when:
1. ✅ Exit codes match expected values
2. ✅ JSON validates against schema
3. ✅ Output is deterministic (same input = same output)
4. ✅ Dependencies are non-empty for real codebases
5. ✅ All call sites have valid line numbers (>= 1)
6. ✅ No duplicate (filePath, callerMethod, lineNumber) tuples
7. ✅ Logs go to stderr, JSON goes to stdout
8. ✅ Parse errors are handled gracefully (logged, not thrown)