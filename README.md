# vscode-blast-radius

`vscode-blast-radius` is a Visual Studio Code extension that calculates and visualizes the semantic blast radius of Java code changes. Instead of only reporting syntax or compile-level breakages, it combines deterministic AST dependency discovery and AI-driven risk reasoning to show downstream impact before changes are merged.

## Why this exists

Traditional IDE feedback is mostly structural: unresolved symbols, type mismatches, or compile-time failures. That is necessary, but it often misses semantic and logical consequences that can still break behavior.

Blast Radius Mapper adds a semantic layer by:

- Parsing Java code with an AST engine to discover deterministic relationships.
- Using an AI orchestrator (IBM Bob / Granite target integration) to score risk and explain likely impact.
- Rendering an impact graph so developers can quickly reason about cascading effects.

## Architecture

The project is structured as a monorepo with three isolated execution environments:

1. **TypeScript VS Code Extension (root)**
   - Entry point for the extension host.
   - Collects git diff context and coordinates analysis.
   - Opens a WebView panel and streams result payloads.

2. **Python AST Engine (`/ast-engine`)**
   - Uses `tree-sitter` + `tree-sitter-java`.
   - Parses Java source files and emits deterministic dependency output.

3. **React WebView UI (`/webview-ui`)**
   - Built with React + Vite + Tailwind + Mermaid.
   - Receives analysis payloads from the extension host.
   - Renders blast radius relationships as a flowchart.

Data flow:

`VS Code Extension -> Python AST Engine -> AI API -> React WebView`

## Data Contracts

Components are intentionally isolated and communicate through strict JSON contracts.

- **Contract A (AST output)**
  - `targetFile`
  - `gitDiff`
  - `dependencies[]` with `filePath` and `usageContextLine`

- **Contract B (AI output)**
  - `overallRiskScore`
  - `summary`
  - `nodes[]`
  - `edges[]`

Keeping contracts explicit ensures each environment can evolve independently while preserving interoperability.

## Local development

### 1) Install root extension dependencies

```bash
cd <project-root>
npm install
```

### 2) Install webview dependencies

```bash
cd <project-root>/webview-ui
npm install
```

### 3) Install AST engine dependencies

```bash
cd <project-root>/ast-engine
pip install -r requirements.txt
```

### Build extension + webview

```bash
cd <project-root>
npm run compile
```

### Run webview in development mode

```bash
cd <project-root>/webview-ui
npm run dev
```
