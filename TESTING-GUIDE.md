# Testing Guide - AST Engine Integration

## Overview

This guide explains how to test the complete pipeline from Git Engine → AST Engine → AI Orchestrator → Visualizer.

## Prerequisites

- Java 17+ installed
- Maven 3.9+ installed
- Node.js 20+ installed
- Git bash (for running scripts on Windows)
- VS Code installed

## Build Process

### Step 1: Install Dependencies

```bash
cd c:/Projects/vscode-blast-radius-java
npm install
```

This installs dependencies for all workspaces (extension, git-engine, ai-orchestrator, visualizer, shared).

### Step 2: Build All Components

Use the build script which builds everything in the correct order:

```bash
bash scripts/build-extension.vsix.sh
```

This script:
1. Builds AST Engine (Java) → `ast-engine/target/blast-radius-ast-0.0.1.jar`
2. Builds Visualizer (React + Vite) → `visualizer/dist/`
3. Copies visualizer to extension → `extension/dist/webview/`
4. Builds Git Engine (TypeScript) → `git-engine/dist/`
5. Builds AI Orchestrator (TypeScript) → `ai-orchestrator/dist/`
6. Copies dependencies to extension → `extension/lib/`
7. Builds Extension (TypeScript) → `extension/dist/`
8. Packages VSIX → `extension/blast-radius-mapper-0.0.1.vsix`

**Expected output:**
```
==> Building all sub-bundles
==========================================
Building AST Engine
==========================================
Running Maven package...
✓ JAR built successfully: target/blast-radius-ast-0.0.1.jar
==========================================
AST Engine build complete!
==========================================
==> vite build (visualizer)
...
✓ built in XXXms
==> Webview bundle copied to extension/dist/webview/
==> Building workspace dependencies
...
==> tsc (extension)
...
==> vsce package
...
==> .vsix in extension/
```

**Verify:**
```bash
ls ast-engine/target/blast-radius-ast-0.0.1.jar
ls extension/dist/extension.js
ls extension/blast-radius-mapper-0.0.1.vsix
```

## Testing the Pipeline

### Test 1: Standalone AST Engine (Java CLI)

Test the Java CLI directly before integrating with the extension.

**Command:**
```bash
cd c:/Projects/vscode-blast-radius-java

java -Xmx4g -jar ast-engine/target/blast-radius-ast-0.0.1.jar \
  --workspace="C:/Projects/carbon-identity-framework" \
  --target="components/flow-orchestration-framework/org.wso2.carbon.identity.flow.inflow.extensions/src/main/java/org/wso2/carbon/identity/flow/inflow/extensions/executor/InFlowExtensionExecutor.java" \
  --target-package="org.wso2.carbon.identity.flow.inflow.extensions.executor" \
  --methods="execute,buildErrorResponse,triggerDiagnosticFailure" \
  > test-ast-output.json
```

**Expected:**
- Exit code: 0
- `test-ast-output.json` contains valid JSON
- Dependencies array is non-empty
- Each dependency has `callSites` array with ≥1 element

**Verify:**
```bash
# Check exit code
echo $?  # Should be 0

# Check JSON structure
cat test-ast-output.json | jq '.dependencies | length'  # Should be > 0

# Check for TaskExecutionNode.java (polymorphic call)
cat test-ast-output.json | jq '.dependencies[] | select(.filePath | contains("TaskExecutionNode"))'
```

### Test 2: Extension Pipeline (Full Integration)

Test the complete pipeline through VS Code Extension Development Host.

**Setup:**
1. Open `c:/Projects/vscode-blast-radius-java` in VS Code
2. Navigate to `extension/` folder in VS Code Explorer
3. Press `F5` to launch Extension Development Host
   - This opens a new VS Code window with the extension loaded
   - The new window is titled "[Extension Development Host]"

**In the Extension Development Host window:**
1. Open `c:/Projects/carbon-identity-framework` folder
2. Navigate to and open: `components/flow-orchestration-framework/org.wso2.carbon.identity.flow.inflow.extensions/src/main/java/org/wso2/carbon/identity/flow/inflow/extensions/executor/InFlowExtensionExecutor.java`
3. Press `Ctrl+Shift+P` (Command Palette)
4. Type "Blast Radius: Map"
5. Press Enter

**Expected Flow:**

```
Step 1/5: Extracting Git changes...
✓ Git changes extracted: 3 methods changed

Step 2/5: Analyzing AST dependencies...
[AST engine logs appear here]
✓ AST analysis complete: X dependencies found

Step 3/5: Assembling Contract A...
✓ Contract A assembled successfully

Step 4/5: Running AI risk analysis...
✓ AI analysis complete: Y nodes, Z edges

Step 5/5: Generating markdown report...
✓ Report generated: reports/blast-radius-report.md

Blast Radius analysis completed in X.XXs
```

**Verify:**
1. Check VS Code Output panel (select "Blast Radius" from dropdown)
2. Verify temp files created:
   - `temp/git-output.json`
   - `temp/ast-output.json`
   - `temp/contract-a.json`
   - `temp/contract-b.json`
3. Verify report: `reports/blast-radius-report.md`

### Test 3: Data Flow Verification

Verify data flows correctly between components.

**Check Git Engine → AST Engine:**

```bash
# View git-output.json
cat temp/git-output.json | jq '.'
```

**Expected structure:**
```json
{
  "targetFile": "components/.../InFlowExtensionExecutor.java",
  "targetPackage": "org.wso2.carbon.identity.flow.inflow.extensions.executor",
  "gitDiff": "...",
  "changedMethods": ["execute", "buildErrorResponse", "triggerDiagnosticFailure"]
}
```

**Check AST Engine → Contract Assembler:**

```bash
# View ast-output.json
cat temp/ast-output.json | jq '.dependencies[0]'
```

**Expected structure:**
```json
{
  "filePath": "components/.../TaskExecutionNode.java",
  "packageName": "org.wso2.carbon.identity.flow.orchestration.engine.node",
  "importedSymbols": ["Executor", "InFlowExtensionExecutor"],
  "callSites": [
    {
      "callerMethod": "execute",
      "lineNumber": 116,
      "usageContextLine": "mappedFlowExecutor.execute(...);"
    }
  ]
}
```

**Check Contract A (Merged):**

```bash
# View contract-a.json
cat temp/contract-a.json | jq '.'
```

**Expected structure:**
```json
{
  "targetFile": "...",
  "targetPackage": "...",
  "gitDiff": "...",
  "changedMethods": ["execute", ...],
  "dependencies": [
    {
      "filePath": "...",
      "packageName": "...",
      "importedSymbols": [...],
      "callSites": [...]
    }
  ]
}
```

## Troubleshooting

### Issue: "JAR not found"

**Symptom:** Extension falls back to example data

**Solution:**
```bash
cd ast-engine
mvn clean package
ls target/blast-radius-ast-0.0.1.jar  # Verify exists
```

### Issue: Build script fails

**Error:** TypeScript compilation errors in ai-orchestrator or other components

**Solution:** The build script (`build-extension.vsix.sh`) builds everything in the correct order. If it fails:

1. Check the error message carefully
2. Ensure all contract changes are applied
3. Run from project root:
```bash
cd c:/Projects/vscode-blast-radius-java
bash scripts/build-extension.vsix.sh
```

**Note:** Do NOT use `npm run build --workspace=extension` - that syntax doesn't work. Use the build script instead.

### Issue: Empty dependencies array

**Symptom:** `ast-output.json` has `dependencies: []`

**Possible causes:**
1. No callers found (legitimate)
2. Type resolution failed
3. Target class not in workspace

**Debug:**
1. Check stderr output in VS Code Output panel
2. Look for "parse-skip" or "Skipping unreadable jar" messages
3. Verify target class compiles
4. Check if polymorphic calls are being detected

### Issue: TypeScript compilation errors

**Error:** `Cannot find module 'fs-extra'`

**Solution:**
```bash
cd extension
npm install
```

### Issue: Git engine returns wrong format

**Symptom:** `changedMethods` is array of objects instead of strings

**Solution:** Git engine needs to be updated to match new contract. Check `git-engine/` implementation.

## Performance Benchmarks

Expected execution times on carbon-identity-framework:

| Component | Time | Notes |
|-----------|------|-------|
| Git Engine | <1s | Fast, just git diff |
| AST Engine | 30-60s | First run (cold JVM) |
| AST Engine | 20-40s | Subsequent runs |
| AI Orchestrator | 5-15s | Depends on API latency |
| Visualizer | <1s | Markdown generation |
| **Total** | **60-90s** | First run |
| **Total** | **30-60s** | Subsequent runs |

## Validation Checklist

Before declaring integration complete:

- [ ] AST Engine JAR builds successfully
- [ ] JAR name is `blast-radius-ast-0.0.1.jar` (versioned)
- [ ] Extension dependencies installed (`npm install`)
- [ ] Extension builds without errors (`npm run build`)
- [ ] Standalone CLI test passes (Test 1)
- [ ] Full pipeline test passes (Test 2)
- [ ] Git output has correct structure
- [ ] AST output has correct structure with `callSites[]`
- [ ] Contract A merges correctly
- [ ] Polymorphic calls detected (TaskExecutionNode.java appears)
- [ ] No TypeScript compilation errors
- [ ] VS Code Output panel shows detailed logs
- [ ] Temp files created in correct format
- [ ] Report generates successfully

## Next Steps After Testing

Once all tests pass:

1. **Document findings** - Note any edge cases discovered
2. **Update examples** - Refresh example files with real output
3. **Performance tuning** - Adjust heap size if needed
4. **Error handling** - Add any missing error cases
5. **Integration testing** - Test with other Java projects

## Reference

- **AST Engine README:** `ast-engine/README.md`
- **Integration Guide:** `ast-engine/INTEGRATION.md`
- **Pipeline Documentation:** `docs/PIPELINE.md`
- **Contract Schemas:** `shared/contracts/`