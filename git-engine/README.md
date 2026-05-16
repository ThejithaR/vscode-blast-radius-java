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

## Inputs / Outputs

| Direction | Source/Sink | Contract |
|---|---|---|
| In | `vscode.window.activeTextEditor` | (passed in by caller) |
| In | local Git CLI | (subprocess) |
| Out | `extension/orchestrator/pipeline.ts` | [`GitDeltaOutput`](../shared/types/gitDeltaOutput.ts) |

See [examples/git-delta-output.example.json](./examples/git-delta-output.example.json).

## Public API

```ts
import type { GitDeltaOutput } from "@blast-radius/shared";

// One-shot: resolve active editor + run git diff + map symbols.
export async function extract(
  activeFile: vscode.TextDocument,
  workspaceRoot: string
): Promise<GitDeltaOutput>;
```

Internal helpers (not part of the public surface, but documented for review):

- `extractDiff(filePath: string): string` — runs `git diff HEAD -- <file>`.
- `parseDiff(rawDiff: string): DiffHunk[]` — parses unified diff into hunks with old/new line ranges.
- `mapSymbols(filePath: string, hunks: DiffHunk[]): string[]` — light regex over the file's current content to identify which Java method names contain the changed line ranges. The deep type-aware resolution is M3's job; this only needs to be good enough to feed M3 candidate method names.

## Local Development

```bash
cd git-engine
npm install
npm run build       # tsc
npm test            # runs fixture-based tests
```

## Mocking Upstream

This component has **no upstream** — it's the start of the pipeline. To test in isolation, run `extract()` against any Java file in a Git repo (use [demo/sample-diffs/](../demo/sample-diffs/) or your own repo).

## Integration Hooks

- Exported by `src/index.ts` as `extract()`.
- Member 1 imports `@blast-radius/git-engine`.

## Special Responsibility — Demo Repo Setup

Per the workload split, Member 2 also curates the sample-repo experience:

- Maintains [docs/SAMPLE-REPO.md](../docs/SAMPLE-REPO.md).
- Captures 3–5 representative diffs from [carbon-identity-framework](https://github.com/wso2/carbon-identity-framework) into [demo/sample-diffs/](../demo/sample-diffs/) as JSON fixtures conforming to `GitDeltaOutput`.

## Open Questions

- Should `extract()` also handle staged-but-not-committed changes (`git diff --cached`)? Currently planning unstaged only.
- How to handle the case where the developer hasn't saved the file yet — fall back to in-memory `document.getText()` diffed against `git show HEAD:file`?
