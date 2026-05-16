# Pipeline — Per-Step Execution Trace

A walk-through of one invocation, end to end. Using the canonical example: a developer modifies `verifyTokenStructure` in [`shared/examples/contract-a.example.json`](../shared/examples/contract-a.example.json).

## Step 0 — Trigger

Developer presses **Cmd/Ctrl+Shift+P** → *Blast Radius: Map*.

- Handler: [`extension/src/commands/mapBlastRadius.ts`](../extension/src/commands/mapBlastRadius.ts)
- The command calls [`extension/src/orchestrator/pipeline.ts:run()`](../extension/src/orchestrator/pipeline.ts).

## Step 1 — Git delta (M2)

`pipeline.ts` calls `gitEngine.extract(activeFilePath)` from `git-engine/`.

1. `activeFileResolver.ts` → `vscode.window.activeTextEditor.document.uri`.
2. `diffExtractor.ts` runs `git diff HEAD -- <file>` via `execSync`.
3. `diffParser.ts` parses unified-diff hunks into line ranges.
4. `symbolMapper.ts` maps line ranges → Java method names (lightweight regex over the *current* file content; full AST resolution is M3's job).

Output: [`GitDeltaOutput`](../shared/examples/git-delta-output.example.json).

## Step 2 — AST dependency discovery (M3)

`pipeline.ts` calls `astRunner.spawn(gitDelta)` from `extension/src/childProcess/astRunner.ts`.

1. Spawns `java -jar extension/dist/blast-radius-ast.jar` with the workspace root, target file, and `changedMethods` as CLI args.
2. The Java process:
   - `ProjectScanner` walks the workspace, finds all `pom.xml` files, unions all `src/main/java` roots.
   - `TypeSolverBuilder` creates `CombinedTypeSolver` = `ReflectionTypeSolver` + `JavaParserTypeSolver` per source root + `JarTypeSolver` per JAR in `~/.m2`.
   - `DependencyFinder` visits every `CompilationUnit`, finds `MethodCallExpr` nodes whose resolved declaration is in the target file with a name in `changedMethods`.
   - `ContextLineExtractor` reads the call-site's source line.
   - `AstOutputBuilder` serializes via Jackson, prints JSON to stdout.
3. The extension reads stdout, parses JSON.

Output: [`AstDependenciesOutput`](../shared/examples/ast-dependencies-output.example.json).

## Step 3 — Merge → Contract A (M1)

`pipeline.ts` calls `contractAssembler.merge(gitDelta, astDeps)`:

```ts
const contractA: ContractA = {
  targetFile: gitDelta.targetFile,
  targetPackage: gitDelta.targetPackage,
  gitDiff: gitDelta.gitDiff,
  dependencies: astDeps.dependencies
};
```

`changedMethods` is dropped — Bob infers it from the diff.

Output: [`ContractA`](../shared/examples/contract-a.example.json).

## Step 4 — Semantic risk analysis (M4)

`pipeline.ts` calls `aiOrchestrator.analyze(contractA)` from `ai-orchestrator/`.

1. `promptBuilder.ts` assembles the system prompt from the 7 skill prompts under `src/bob/prompts/`.
2. `BobClient.ts` POSTs to the IBM Bob endpoint.
3. The response is parsed and validated by `schemas/contractB.zod.ts`.
4. If Zod throws, `retry/selfHealingLoop.ts` re-prompts Bob with the validation error appended, up to N retries.
5. `tokenManager.ts` truncates oversize `usageContextLine` values before sending if total prompt > model context window.

Output: [`ContractB`](../shared/examples/contract-b.example.json).

## Step 5 — Render (M5)

`pipeline.ts` calls `webviewPanel.postContract(contractB)`:

1. `WebviewPanel.ts` ensures the panel exists (creates if first run).
2. `messageBridge.ts` sends `{ type: 'CONTRACT_B', payload: contractB }`.
3. Inside the webview, `useVsCodeMessage.ts` receives the message.
4. `mermaidCompiler.ts` converts Contract B → Mermaid string:
   - `packageGrouper.ts` builds `subgraph` blocks by Java package.
   - `riskColorMap.ts` assigns hex colors per node.
   - `edgeStyler.ts` styles edges by `type`.
5. `BlastRadiusGraph.tsx` calls `mermaid.render()`.
6. `SummaryPanel.tsx` displays `overallRiskScore` and `summary` above the graph.
7. `NodeDetailDrawer.tsx` opens on node click, showing the `reason`.

## Failure modes

| Stage | Failure | Handling |
|---|---|---|
| Step 1 | Not in a Git repo | Show VS Code error toast, abort |
| Step 1 | No diff (file unchanged) | Show info toast: "Nothing to map", abort |
| Step 2 | JavaParser exception | `errorBoundary.ts` catches, shows error in `OutputChannel` |
| Step 4 | Bob returns malformed JSON | `selfHealingLoop.ts` retries with error context, max 3x |
| Step 4 | Bob unreachable | Error toast with retry button |
| Step 5 | Mermaid parse failure | `EmptyState.tsx` shows error and raw Contract B for debugging |
