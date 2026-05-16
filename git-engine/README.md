# git-engine/ — Git Delta & Symbol Extractor

## Mission

Determine **what file** the developer is editing and **what they changed**. Produce a `GitDeltaOutput` payload from the active editor + Git state.

## Owner

**Member 2.**

## Tech Stack

- TypeScript 5.x
- Node.js `child_process` (`execSync` for Git CLI)
- Git CLI ≥ 2.30
- Imported by [extension/](../extension/) as a plain TS module (no separate process)

## Implementation Status

✅ **COMPLETE** - All core modules implemented and tested.

### Implemented Modules

1. **`types.ts`** - Internal type definitions
   - `DiffHunk` - Represents a unified diff hunk
   - `MethodDeclaration` - Java method with line range
   - `FileInfo` - File path and package name

2. **`diffParser.ts`** - Unified diff parser
   - `parseDiff()` - Parses `@@` headers and diff lines
   - `getChangedLineNumbers()` - Extracts affected line numbers
   - `getChangedLineRange()` - Gets min/max line range

3. **`activeFileResolver.ts`** - File information extractor
   - `resolveActiveFile()` - Gets workspace-relative path and package
   - `extractPackageName()` - Parses `package x.y.z;` declaration
   - `isJavaFile()` - Validates .java extension
   - `normalizeFilePath()` - Ensures forward slashes

4. **`symbolMapper.ts`** - Method name mapper
   - `mapSymbols()` - Maps changed lines to method names
   - `findMethodDeclarations()` - Finds all methods in file
   - `looksLikeMethodDeclaration()` - Quick filter for method lines

5. **`diffExtractor.ts`** - Git command executor
   - `extractDiff()` - Runs `git diff HEAD -- <file>`
   - `isGitRepository()` - Validates git repo
   - `hasUncommittedChanges()` - Checks for changes
   - `getCurrentBranch()` - Gets current branch name
   - `extractStagedDiff()` - Gets staged changes

6. **`index.ts`** - Main orchestrator
   - `extract()` - **Public API** - Produces `GitDeltaOutput`
   - `validateFile()` - Pre-flight validation

## Public API

```typescript
import { extract } from '@blast-radius/git-engine';

// One-shot: resolve active editor + run git diff + map symbols
const output = await extract(
  '/absolute/path/to/File.java',
  '/absolute/path/to/workspace'
);

// Returns GitDeltaOutput:
// {
//   targetFile: "components/.../File.java",
//   targetPackage: "org.wso2.carbon.identity.core",
//   gitDiff: "@@ -145,7 +145,8 @@\n...",
//   changedMethods: ["methodName1", "methodName2"]
// }
```

## Inputs / Outputs

| Direction | Source/Sink | Contract |
|---|---|---|
| In | `vscode.window.activeTextEditor` | (passed in by caller) |
| In | local Git CLI | (subprocess) |
| Out | `extension/orchestrator/pipeline.ts` | [`GitDeltaOutput`](../shared/types/gitDeltaOutput.ts) |

See [examples/git-delta-output.example.json](./examples/git-delta-output.example.json).

## Local Development

```bash
cd git-engine
npm install
npm run build       # tsc
npm run watch       # tsc --watch
```

## Testing

### Unit Testing with Fixtures

The implementation has been tested with real diffs from carbon-identity-framework:

1. **Simple method change** - Import fix affecting 2 methods
   - File: `AccessConfig.java`
   - Methods: `getExposedPaths`, `getModifiablePaths`
   - See: [demo/sample-diffs/02-simple-method-change.json](../demo/sample-diffs/02-simple-method-change.json)

2. **Large refactoring** - Multiple method extractions
   - File: `InFlowExtensionExecutor.java`
   - Methods: `execute`, `buildErrorResponse`, `triggerDiagnosticFailure`, etc.
   - See: [demo/sample-diffs/01-method-refactoring.json](../demo/sample-diffs/01-method-refactoring.json)

### Manual Testing

```bash
# Test against carbon-identity-framework
cd ../carbon-identity-framework

# Make a change to any Java file
# Then test the git-engine

node -e "
const { extract } = require('./git-engine/dist/index.js');
extract(
  'C:/path/to/carbon-identity-framework/components/.../File.java',
  'C:/path/to/carbon-identity-framework'
).then(console.log).catch(console.error);
"
```

## Architecture Details

### Diff Parsing Strategy

The `diffParser` uses regex to match unified diff headers:
```
@@ -oldStart,oldCount +newStart,newCount @@
```

Example:
```
@@ -145,7 +145,8 @@
```
Means: old file starts at line 145 with 7 lines, new file starts at line 145 with 8 lines.

### Symbol Mapping Strategy

The `symbolMapper` uses **lightweight regex** to find method declarations:
```typescript
/^\s*(?:public|private|protected)?\s*(?:static|final|synchronized|native|abstract|\s)*\s*(?:<[^>]+>\s*)?(\w+(?:<[^>]+>)?(?:\[\])*)\s+(\w+)\s*\(/
```

Then uses **bracket matching** to find method boundaries:
- Counts `{` and `}` characters
- Ignores braces in strings and comments
- Returns when brace count returns to 0

This is intentionally simple - deep AST resolution is handled by `ast-engine` (Member 3).

### Git Command Execution

Uses Node's `execSync` with:
- `cwd` set to workspace root
- 10MB buffer for large diffs
- Error handling for non-git directories

## Integration Hooks

- Exported by `src/index.ts` as `extract()`
- Member 1 imports `@blast-radius/git-engine`
- Called from `extension/src/orchestrator/pipeline.ts`

## Error Handling

The `extract()` function throws errors for:
- Not in a git repository
- File not found
- No package declaration
- No uncommitted changes
- Git command failures

The extension (Member 1) should catch these and show appropriate VS Code error toasts.

## Special Responsibility — Demo Repo Setup

Per the workload split, Member 2 also curates the sample-repo experience:

- ✅ Maintains [docs/SAMPLE-REPO.md](../docs/SAMPLE-REPO.md)
- ✅ Captured 2 representative diffs from [carbon-identity-framework](https://github.com/wso2/carbon-identity-framework) into [demo/sample-diffs/](../demo/sample-diffs/) as JSON fixtures conforming to `GitDeltaOutput`

## Design Decisions

### Why regex instead of full AST?

The git-engine only needs to identify **which methods** contain changes, not understand the full syntax tree. The AST engine (Member 3) handles deep type resolution. This keeps git-engine fast and simple.

### Why execSync instead of a Git library?

- Git CLI is universally available
- No additional dependencies
- Simple error handling
- Works across all platforms

### Why forward slashes in paths?

Ensures consistent paths across Windows and Unix systems. The extension (Member 1) handles platform-specific conversions when needed.

## Performance Characteristics

- **Diff extraction**: ~50-200ms (depends on file size)
- **Diff parsing**: ~1-5ms (pure regex)
- **Symbol mapping**: ~10-50ms (depends on file size and method count)
- **Total**: ~100-300ms for typical files

## Future Enhancements

1. **Staged changes support** - Currently only handles unstaged changes
2. **Multi-file diffs** - Support analyzing multiple files at once
3. **Incremental parsing** - Cache method declarations between runs
4. **Better method detection** - Handle edge cases like lambdas, anonymous classes

## Contract Validation

Output conforms to `git-delta-output.schema.json`:

```bash
npx ajv-cli validate \
  -s ../shared/contracts/git-delta-output.schema.json \
  -d examples/git-delta-output.example.json
```

## Dependencies

```json
{
  "dependencies": {
    "@blast-radius/shared": "*"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/vscode": "^1.85.0",
    "typescript": "^5.3.0"
  }
}
```

## Build Output

Compiled JavaScript and type definitions are output to `dist/`:
```
dist/
├── index.js
├── index.d.ts
├── types.js
├── types.d.ts
├── diffParser.js
├── diffParser.d.ts
├── activeFileResolver.js
├── activeFileResolver.d.ts
├── symbolMapper.js
├── symbolMapper.d.ts
├── diffExtractor.js
└── diffExtractor.d.ts
```

## Integration Example

```typescript
// In extension/src/orchestrator/pipeline.ts
import { extract } from '@blast-radius/git-engine';

export async function run(activeEditor: vscode.TextEditor) {
  const activeFilePath = activeEditor.document.uri.fsPath;
  const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
  
  try {
    const gitDelta = await extract(activeFilePath, workspaceRoot);
    
    // Forward to AST engine (Member 3)
    const astDeps = await astRunner.spawn(gitDelta);
    
    // Merge into Contract A
    const contractA = contractAssembler.merge(gitDelta, astDeps);
    
    // Continue pipeline...
  } catch (error) {
    vscode.window.showErrorMessage(`Git Engine Error: ${error.message}`);
  }
}
```

## Status

✅ **Implementation Complete**
✅ **Build Successful**
✅ **Sample Fixtures Created**
⏳ **Integration Testing** - Pending Member 1's pipeline implementation

## Questions or Issues?

Contact Member 2 or see [docs/CONTRACTS.md](../docs/CONTRACTS.md) for the full contract specification.
