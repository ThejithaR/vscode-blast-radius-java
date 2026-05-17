# Git-Engine Integration Guide

This document provides integration instructions for **Member 1 (Extension Team)**.

## Overview

The git-engine is a TypeScript module that extracts git delta information from the active Java file. It's the first component in the blast-radius pipeline.

## Installation

The git-engine is already set up as a workspace package. No additional installation needed.

```typescript
import { extract } from '@blast-radius/git-engine';
```

## Public API

### `extract(activeFilePath, workspaceRoot): Promise<GitDeltaOutput>`

Main function that orchestrates all git-engine components.

**Parameters:**
- `activeFilePath` (string): Absolute path to the active Java file
- `workspaceRoot` (string): Absolute path to the workspace root directory

**Returns:** Promise<GitDeltaOutput>

**Throws:**
- Error if not in a git repository
- Error if file has no uncommitted changes
- Error if file is not a Java file
- Error if package declaration not found

**Example:**
```typescript
import * as vscode from 'vscode';
import { extract } from '@blast-radius/git-engine';

export async function mapBlastRadius() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    return;
  }

  const activeFilePath = editor.document.uri.fsPath;
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  try {
    const gitDelta = await extract(activeFilePath, workspaceRoot);
    
    // gitDelta is now ready to be passed to ast-engine (Member 3)
    console.log('Git Delta:', gitDelta);
    
    // Continue with pipeline...
    // const astDeps = await astRunner.spawn(gitDelta);
    
  } catch (error: any) {
    vscode.window.showErrorMessage(`Git Engine Error: ${error.message}`);
  }
}
```

### `validateFile(activeFilePath, workspaceRoot): { valid: boolean; error?: string }`

Pre-flight validation before calling `extract()`. Useful for showing early warnings.

**Parameters:**
- `activeFilePath` (string): Absolute path to the file
- `workspaceRoot` (string): Absolute path to the workspace root

**Returns:** Object with validation result
- `valid` (boolean): true if file can be processed
- `error` (string, optional): Error message if invalid

**Example:**
```typescript
import { validateFile } from '@blast-radius/git-engine';

const validation = validateFile(activeFilePath, workspaceRoot);
if (!validation.valid) {
  vscode.window.showWarningMessage(
    `Cannot map blast radius: ${validation.error}`
  );
  return;
}

// Proceed with extract()
```

## Output Contract

The `extract()` function returns a `GitDeltaOutput` object:

```typescript
interface GitDeltaOutput {
  targetFile: string;        // Workspace-relative path with forward slashes
  targetPackage: string;     // Java package (e.g., "org.wso2.carbon.identity.core")
  gitDiff: string;          // Raw unified diff output
  changedMethods: string[]; // Method names containing changes
}
```

**Example output:**
```json
{
  "targetFile": "components/identity-core/org.wso2.carbon.identity.core/src/main/java/org/wso2/carbon/identity/core/util/IdentityUtil.java",
  "targetPackage": "org.wso2.carbon.identity.core.util",
  "gitDiff": "@@ -145,7 +145,8 @@\n public static String getProperty(String key) {\n-    return System.getProperty(key);\n+    String value = System.getProperty(key);\n+    return value != null ? value : \"\";\n }",
  "changedMethods": ["getProperty"]
}
```

## Error Handling

### Common Errors

1. **Not in a git repository**
   ```
   Error: Not a git repository: /path/to/workspace
   ```
   **Solution:** Ensure the workspace is a git repository

2. **No uncommitted changes**
   ```
   Error: No uncommitted changes found in file: path/to/File.java
   ```
   **Solution:** File must have uncommitted changes (working directory changes)

3. **Not a Java file**
   ```
   Error: Not a Java file
   ```
   **Solution:** Only .java files are supported

4. **No package declaration**
   ```
   Error: No package declaration found in file: path/to/File.java
   ```
   **Solution:** Java file must have a `package x.y.z;` declaration

### Recommended Error Handling Pattern

```typescript
try {
  const gitDelta = await extract(activeFilePath, workspaceRoot);
  // Continue pipeline...
} catch (error: any) {
  const message = error.message || 'Unknown error';
  
  if (message.includes('not a git repository')) {
    vscode.window.showErrorMessage(
      'Blast Radius requires a git repository. Please open a git-tracked project.'
    );
  } else if (message.includes('No uncommitted changes')) {
    vscode.window.showInformationMessage(
      'No changes to analyze. Make some changes to the file and try again.'
    );
  } else if (message.includes('Not a Java file')) {
    vscode.window.showWarningMessage(
      'Blast Radius only works with Java files (.java)'
    );
  } else {
    vscode.window.showErrorMessage(
      `Failed to extract git delta: ${message}`
    );
  }
}
```

## Pipeline Integration

The git-engine is the first step in the pipeline:

```typescript
// extension/src/orchestrator/pipeline.ts
import { extract as extractGitDelta } from '@blast-radius/git-engine';
import { spawn as spawnAstEngine } from '../childProcess/astRunner';
import { merge as mergeContracts } from './contractAssembler';
import { analyze as analyzeWithBob } from '@blast-radius/ai-orchestrator';

export async function run(activeEditor: vscode.TextEditor) {
  const activeFilePath = activeEditor.document.uri.fsPath;
  const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
  
  // Step 1: Git Delta (Member 2)
  const gitDelta = await extractGitDelta(activeFilePath, workspaceRoot);
  
  // Step 2: AST Dependencies (Member 3)
  const astDeps = await spawnAstEngine(gitDelta);
  
  // Step 3: Merge into Contract A (Member 1)
  const contractA = mergeContracts(gitDelta, astDeps);
  
  // Step 4: AI Analysis (Member 4)
  const contractB = await analyzeWithBob(contractA);
  
  // Step 5: Render (Member 5)
  webviewPanel.postContract(contractB);
}
```

## Testing

### Unit Testing

Use the provided fixtures for testing:

```typescript
import { parseDiff, getChangedLineNumbers } from '@blast-radius/git-engine';
import * as fs from 'fs';

// Load a fixture
const fixture = JSON.parse(
  fs.readFileSync('demo/sample-diffs/02-simple-method-change.json', 'utf-8')
);

// Test diff parsing
const hunks = parseDiff(fixture.gitDiff);
console.log('Hunks:', hunks);

// Test line number extraction
const changedLines = getChangedLineNumbers(hunks);
console.log('Changed lines:', changedLines);
```

### Integration Testing

Test against the carbon-identity-framework repository:

1. Open carbon-identity-framework in VS Code
2. Make a change to any Java file
3. Run the Blast Radius command
4. Verify the git-engine output

## Performance Considerations

- **Typical execution time:** 100-300ms
- **Large files (>5000 lines):** May take up to 500ms
- **Very large diffs (>1MB):** May hit the 10MB buffer limit

If performance is an issue, consider:
- Caching method declarations between runs
- Running git-engine in a worker thread
- Showing a progress indicator for large files

## Utility Functions

The git-engine also exports utility functions that may be useful:

```typescript
import {
  isGitRepository,
  hasUncommittedChanges,
  getCurrentBranch,
  extractPackageName,
  isJavaFile,
  normalizeFilePath,
  findMethodDeclarations
} from '@blast-radius/git-engine';

// Check if directory is a git repo
if (isGitRepository(workspaceRoot)) {
  console.log('Git repository detected');
}

// Get current branch
const branch = getCurrentBranch(workspaceRoot);
console.log('Current branch:', branch);

// Extract package from Java source
const source = fs.readFileSync('File.java', 'utf-8');
const packageName = extractPackageName(source);
console.log('Package:', packageName);
```

## Debugging

Enable detailed logging:

```typescript
import { extract } from '@blast-radius/git-engine';

try {
  console.log('Starting git-engine extraction...');
  console.log('Active file:', activeFilePath);
  console.log('Workspace root:', workspaceRoot);
  
  const gitDelta = await extract(activeFilePath, workspaceRoot);
  
  console.log('Git delta extracted successfully:');
  console.log('- Target file:', gitDelta.targetFile);
  console.log('- Target package:', gitDelta.targetPackage);
  console.log('- Changed methods:', gitDelta.changedMethods);
  console.log('- Diff length:', gitDelta.gitDiff.length, 'bytes');
  
} catch (error: any) {
  console.error('Git-engine error:', error);
  console.error('Stack trace:', error.stack);
}
```

## Sample Fixtures

Two sample fixtures are provided in `demo/sample-diffs/`:

1. **02-simple-method-change.json** - Simple import fix affecting 2 methods
2. **01-method-refactoring.json** - Large refactoring with multiple method extractions

Use these for:
- Unit testing your pipeline integration
- Demonstrating the extension without making real changes
- Validating contract assembly logic

## Contract Validation

Validate output against the schema:

```bash
cd vscode-blast-radius-java
ajv validate \
  -s shared/contracts/git-delta-output.schema.json \
  -d demo/sample-diffs/02-simple-method-change.json
```

## Questions?

- See [git-engine/README.md](./README.md) for implementation details
- See [docs/CONTRACTS.md](../docs/CONTRACTS.md) for contract specifications
- See [docs/PIPELINE.md](../docs/PIPELINE.md) for end-to-end flow
- Contact Member 2 for git-engine specific questions

## Status

✅ Implementation complete
✅ Build successful
✅ Schema validation passing
✅ Sample fixtures created
⏳ Awaiting integration testing with extension pipeline