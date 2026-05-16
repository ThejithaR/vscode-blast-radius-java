# visualizer/ — React Webview & Mermaid Renderer

## Mission

Turn `ContractB` into an interactive, color-coded Mermaid flowchart inside a VS Code webview. Group nodes by Java package, color by risk, link interactively to file details. Also **own the specification for Bob's skills** that drive the data the UI needs — see [BOB-SKILLS-SPEC.md](./BOB-SKILLS-SPEC.md).

## Owner

**Member 5.**

> **Special responsibility:** Member 5 specifies *what Bob must produce* (in [BOB-SKILLS-SPEC.md](./BOB-SKILLS-SPEC.md)). Member 4 implements those prompts under `ai-orchestrator/src/bob/prompts/`. Member 5's spec is the contract; Member 4's prompts are the implementation.

## Tech Stack

- React 18
- [Vite 5](https://vitejs.dev/) — bundler producing a single ES module + HTML for the webview
- Tailwind CSS 3 — themed via VS Code's CSS variables (`var(--vscode-editor-background)` etc.)
- [Mermaid.js 10](https://mermaid.js.org/) — declarative graph rendering
- TypeScript 5

## Inputs / Outputs

| Direction | Source/Sink | Contract |
|---|---|---|
| In | `window.addEventListener('message')` from `extension/webview/messageBridge.ts` | [`ContractB`](../shared/types/contractB.ts) |
| Out | DOM render | (visual) |

See [examples/contract-b.example.json](./examples/contract-b.example.json) for the canonical input.

## Local Development (standalone mode)

```bash
cd visualizer
npm install
npm run dev          # vite dev server on http://localhost:5173/
```

In dev mode, `hooks/useVsCodeMessage.ts` falls back to loading `examples/contract-b.example.json` when no VS Code postMessage arrives within 500 ms. This lets M5 iterate on UI without depending on M1/M4.

## Production Build

```bash
npm run build        # vite build → visualizer/dist/
```

The output is copied to `extension/dist/webview/` by [scripts/build-visualizer.sh](../scripts/build-visualizer.sh).

## Mermaid Compilation

`lib/mermaidCompiler.ts` turns `ContractB` into a Mermaid `flowchart` string:

1. `packageGrouper.ts` builds `subgraph` blocks by Java package — so callers in `com.example.api.*` cluster visually.
2. `riskColorMap.ts` returns a hex color per `risk` enum (Critical → red, Warning → amber, Low-Risk → orange, Safe → green, Target → blue).
3. `edgeStyler.ts` returns Mermaid `linkStyle` modifiers per edge `type`.

Node IDs in Contract B are passed directly into the Mermaid graph — `mermaidCompiler.ts` sanitizes any characters Mermaid can't parse.

## Theming

`theme/vsCodeTheme.css` binds Tailwind tokens to VS Code CSS variables, so the webview matches the user's VS Code theme (dark / light / high-contrast) automatically.

## Integration Hooks

- Build output: `dist/index.html` + `dist/assets/index-*.js` (Vite default).
- Loaded by `extension/webview/htmlTemplate.ts`.
- Receives messages of shape `{ type: 'CONTRACT_B', payload: ContractB }`.

## Open Questions

- Should clicking a node open the file in VS Code? (Requires a reverse `postMessage` back to the extension host with `{ type: 'OPEN_FILE', payload: filePath }`.)
- Pinch-zoom on the graph: Mermaid itself doesn't ship zoom; should we wrap with `react-zoom-pan-pinch`?
- Re-running map: clear current graph or stack history of runs?
