# Integration Runbook — Hour ~35

Each member has been building against `examples/*.json` mocks in their own folder. This document is the playbook for stitching the real pipeline together.

## Dependency order

Components must be wired in the order they appear in the pipeline. Each step verifies the seam with the next.

| # | Seam | Owner pair | Verify with |
|---|---|---|---|
| 1 | M2 → M1 | Members 2 + 1 | `pipeline.ts` invokes `gitEngine.extract()` and logs the `GitDeltaOutput` to the Output Channel; compare against `git-engine/examples/git-delta-output.example.json` |
| 2 | M1 → M3 | Members 1 + 3 | `astRunner.spawn(gitDelta)` succeeds; compare stdout against `ast-engine/examples/ast-dependencies-output.example.json` |
| 3 | M1 (merge) | Member 1 | `contractAssembler.merge(...)` output deep-equals `extension/examples/contract-a.example.json` for the canonical inputs |
| 4 | M1 → M4 | Members 1 + 4 | `aiOrchestrator.analyze(contractA)` returns a Zod-valid `ContractB`; first end-to-end Bob call |
| 5 | M1 → M5 | Members 1 + 5 | Webview receives `CONTRACT_B` message, renders a Mermaid graph |

## Smoke test

After all five seams are wired:

1. Boot the Extension Development Host (F5).
2. Open `demo/repo-under-test/carbon-identity-framework/` in the host window.
3. Edit any method in `components/identity-mgt/src/main/java/.../UserIdentityValidator.java`.
4. Run *Blast Radius: Map*.
5. **Pass criteria:** the webview opens within 15 seconds with at least one CRITICAL or WARNING node visible.

## Mock-swap-out checklist

For each member, the integration boundary is:

- **M1:** Replace `loadExampleGitDelta()` and `loadExampleAstDeps()` in `pipeline.ts` with the real `gitEngine.extract()` and `astRunner.spawn()` calls.
- **M2:** Ensure `git-engine/src/index.ts` exports `extractDiff` and `mapSymbols` with the exact signatures declared in `git-engine/README.md`.
- **M3:** Ensure `mvn package` produces `ast-engine/target/blast-radius-ast.jar`; `scripts/build-ast-engine.sh` copies it to `extension/dist/`.
- **M4:** Ensure `ai-orchestrator/src/index.ts` exports `analyze(contractA: ContractA): Promise<ContractB>`. The `BOB_ENDPOINT` env var must work.
- **M5:** Ensure `vite build` produces `visualizer/dist/index.html` plus a single bundled JS; `scripts/build-visualizer.sh` copies it to `extension/dist/webview/`. The `htmlTemplate.ts` must reference the bundle path.

## Windows-specific notes

- `scripts/*.sh` files require Git Bash or WSL.
- PowerShell equivalents are documented inline in each script as a comment block.
- `execSync('git diff ...')` works identically on PowerShell, cmd, and Bash.
- Java fat-jar invocation uses forward slashes for paths; Node spawns it correctly on all platforms.

## Common integration failures

| Symptom | Likely cause |
|---|---|
| `Cannot find module '@blast-radius/shared'` | Workspace not installed — re-run `./scripts/setup.sh` |
| AST process hangs > 30 s | Type solver scanning too many JARs — check `~/.m2` size, or limit to `target/dependency/` |
| Bob returns malformed JSON consistently | Prompt is exceeding the model's context window — `tokenManager.ts` truncation not aggressive enough |
| Webview is blank | CSP violation; check the dev tools console in the webview (`Help > Toggle Developer Tools` on the webview itself) |
| Mermaid render error | Node IDs contain characters Mermaid can't parse (e.g. dots); `mermaidCompiler.ts` must sanitize |
