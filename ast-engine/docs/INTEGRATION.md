# AST Engine Integration Guide

## Overview

The AST engine is integrated into the VS Code extension pipeline as a child process. The extension spawns the Java CLI, passes arguments, and captures JSON output from stdout.

## Architecture

```
Extension (TypeScript)
    ↓
astEngineService.ts
    ↓ spawn child process
Java CLI (blast-radius-ast.jar)
    ↓ stdout
JSON (AstDependenciesOutput)
    ↓
contractAssembler.ts
    ↓
Contract A (merged with GitDeltaOutput)
```

## Build Process

### Automated Build

```bash
bash scripts/build-ast-engine.sh
```

This works on Linux, Mac, and Windows (with Git Bash).

### Manual Build

```bash
cd ast-engine
mvn clean package
```

This produces `target/blast-radius-ast-0.0.1.jar` (shaded fat-jar with all dependencies, versioned).

## Integration Points

### 1. astEngineService.ts

**Location:** `extension/src/services/astEngineService.ts`

**Responsibilities:**
- Validates `GitDeltaOutput` from git-engine
- Builds CLI command with correct arguments
- Spawns Java process
- Parses JSON from stdout
- Handles exit codes (1=usage, 2=workspace, 3=exception)
- Falls back to example data if JAR not found

**Key Code:**
```typescript
const command = [
  'java',
  '-Xmx4g',  // Heap size for large repos
  '-jar',
  `"${astEngineJar}"`,
  `--workspace="${workspaceRoot}"`,
  `--target="${gitOutput.targetFile}"`,
  `--target-package="${gitOutput.targetPackage}"`,
  `--methods="${methodsCsv}"`
].join(' ');

const { stdout, stderr } = await execAsync(command, {
  maxBuffer: 50 * 1024 * 1024,  // 50MB
  timeout: 300000,  // 5 minutes
  cwd: workspaceRoot
});

const output: AstDependenciesOutput = JSON.parse(stdout);
```

### 2. contractAssembler.ts

**Location:** `extension/src/orchestrator/contractAssembler.ts`

**Responsibilities:**
- Merges `GitDeltaOutput` + `AstDependenciesOutput` → `ContractA`
- Validates required fields
- Logs warnings for empty results

**Key Code:**
```typescript
const contractA: ContractA = {
  targetFile: gitOutput.targetFile,
  targetPackage: gitOutput.targetPackage,
  gitDiff: gitOutput.gitDiff,
  changedMethods: gitOutput.changedMethods || [],
  dependencies: astOutput.dependencies || []
};
```

### 3. Pipeline Orchestration

**Location:** `extension/src/orchestrator/pipeline.ts`

**Flow:**
1. Git engine extracts changes → `GitDeltaOutput`
2. AST engine analyzes dependencies → `AstDependenciesOutput`
3. Contract assembler merges → `ContractA`
4. AI orchestrator analyzes → `ContractB`
5. Visualizer renders report

## Type Contracts

### GitDeltaOutput (Input)

```typescript
interface GitDeltaOutput {
  targetFile: string;        // workspace-relative path
  targetPackage: string;     // dotted FQN (e.g., "com.example.core")
  gitDiff: string;           // raw git diff
  changedMethods: string[];  // method names (empty = class-sweep mode)
}
```

### AstDependenciesOutput (Output)

```typescript
interface CallSite {
  callerMethod: string;      // method name or "<class-init>"
  lineNumber: number;        // 1-based line number
  usageContextLine: string;  // source line (leading whitespace stripped)
}

interface AstDependency {
  filePath: string;          // workspace-relative path
  packageName: string;       // dotted FQN
  importedSymbols: string[]; // imported types from target package
  callSites: CallSite[];     // ≥1 call site per dependency
}

interface AstDependenciesOutput {
  dependencies: AstDependency[];
}
```

### ContractA (Merged)

```typescript
interface ContractA {
  targetFile: string;
  targetPackage: string;
  gitDiff: string;
  changedMethods: string[];
  dependencies: AstDependency[];  // Same shape as AstDependenciesOutput
}
```

## Error Handling

### Exit Codes

| Code | Meaning | Extension Behavior |
|------|---------|-------------------|
| 0 | Success | Parse stdout as JSON |
| 1 | Usage error (bad args) | Log error, fall back to example |
| 2 | Workspace not found / no pom.xml | Log error, fall back to example |
| 3 | Internal exception | Log stderr, fall back to example |

### Fallback Strategy

If the JAR is not found or execution fails, the extension falls back to:
```
extension/examples/ast-output.json
```

This allows development/testing without building the Java component.

### Logging

- **stdout**: Reserved for JSON output only
- **stderr**: All logs, warnings, progress messages
  - Extension captures stderr and logs to VS Code Output panel
  - Useful for debugging type resolution issues

## Performance Considerations

### Heap Size

```typescript
'-Xmx4g'  // 4GB heap for large repos like carbon-identity-framework
```

Adjust based on workspace size:
- Small repos (<10 modules): 1-2GB
- Medium repos (10-50 modules): 2-4GB
- Large repos (50+ modules): 4-8GB

### Timeout

```typescript
timeout: 300000  // 5 minutes
```

Typical execution times:
- Synthetic workspace: <5 seconds
- carbon-identity-framework (80+ modules): 30-60 seconds
- First run (cold JVM): +10-20 seconds

### Buffer Size

```typescript
maxBuffer: 50 * 1024 * 1024  // 50MB
```

Handles large dependency graphs. Increase if output exceeds 50MB.

## Testing

### Unit Test - Command Building

```typescript
const gitOutput: GitDeltaOutput = {
  targetFile: "src/main/java/com/example/Foo.java",
  targetPackage: "com.example",
  changedMethods: ["method1", "method2"],
  gitDiff: "..."
};

// Expected command:
// java -Xmx4g -jar "..." --workspace="..." --target="..." 
//   --target-package="com.example" --methods="method1,method2"
```

### Integration Test - Synthetic Workspace

```bash
cd extension
npm run build

# Run against synthetic workspace
# Verify output matches shared/examples/ast-dependencies-output.example.json
```

### E2E Test - Carbon Identity Framework

```bash
# 1. Open carbon-identity-framework in VS Code
# 2. Open InFlowExtensionExecutor.java
# 3. Run "Blast Radius: Map" command
# 4. Verify:
#    - AST engine runs successfully
#    - Dependencies include TaskExecutionNode.java
#    - Contract A assembles correctly
#    - Report generates
```

## Troubleshooting

### "JAR not found"

**Symptom:** Extension falls back to example data

**Solution:**
```bash
cd ast-engine
mvn clean package
# Verify: target/blast-radius-ast.jar exists
```

### "Usage error" (exit code 1)

**Symptom:** CLI prints usage to stderr

**Causes:**
- Missing required argument (--workspace, --target, --target-package)
- Malformed argument (missing "=" or quotes)

**Solution:** Check `astEngineService.ts` command building logic

### "Workspace not found" (exit code 2)

**Symptom:** CLI exits with code 2

**Causes:**
- Workspace path doesn't exist
- No `pom.xml` files found under workspace

**Solution:** Verify workspace is a valid Maven project

### "Internal exception" (exit code 3)

**Symptom:** CLI exits with code 3, stack trace on stderr

**Causes:**
- JavaParser parse failure
- Type resolution failure
- Out of memory

**Solution:**
1. Check stderr for stack trace
2. Increase heap size if OOM
3. Check for malformed Java files

### Empty dependencies array

**Symptom:** `dependencies: []` in output

**Causes:**
- No callers found (legitimate)
- Type resolution failed (all calls skipped)
- Target class not in workspace

**Solution:**
1. Check stderr for "parse-skip" or "Skipping unreadable jar" messages
2. Verify target class exists and compiles
3. Check if callers use interfaces (polymorphic calls should work)

### TypeScript compilation errors

**Symptom:** `Cannot find module 'fs-extra'`

**Solution:**
```bash
cd extension
npm install
```

## Maintenance

### Updating Contracts

If you change the JSON schema:

1. Update `shared/contracts/ast-dependencies-output.schema.json`
2. Update `shared/types/astDependenciesOutput.ts`
3. Update `extension/src/services/astEngineService.ts` types
4. Update `extension/examples/ast-output.json`
5. Rebuild Java: `mvn clean package`
6. Rebuild TypeScript: `npm run build --workspace=extension`

### Adding New CLI Arguments

1. Update `BlastRadiusAstCli.java` arg parsing
2. Update `astEngineService.ts` command building
3. Update this documentation
4. Update `ast-engine/README.md`

## References

- **CLI Specification:** [`ast-engine/README.md`](README.md)
- **Implementation Plan:** [`ast-engine-plan.md`](../ast-engine-plan.md)
- **Contract Schemas:** [`shared/contracts/`](../shared/contracts/)
- **Type Definitions:** [`shared/types/`](../shared/types/)
- **Example Payloads:** [`shared/examples/`](../shared/examples/)