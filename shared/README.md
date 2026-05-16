# shared/

The **single source of truth** for the four JSON contracts that flow through the pipeline. Components import types from `@blast-radius/shared` via npm workspaces (defined in the root [package.json](../package.json)).

## Layout

```
shared/
├── contracts/                          # JSON Schema definitions (authoritative)
│   ├── git-delta-output.schema.json
│   ├── ast-dependencies-output.schema.json
│   ├── contract-a.schema.json
│   └── contract-b.schema.json
├── types/                              # TypeScript mirror of the schemas
│   ├── index.ts                        # re-exports everything
│   ├── gitDeltaOutput.ts
│   ├── astDependenciesOutput.ts
│   ├── contractA.ts
│   └── contractB.ts
└── examples/                           # canonical example payloads
    ├── git-delta-output.example.json
    ├── ast-dependencies-output.example.json
    ├── contract-a.example.json
    └── contract-b.example.json
```

See [docs/CONTRACTS.md](../docs/CONTRACTS.md) for field-by-field commentary.

## Why duplicated examples?

Each component (`extension/`, `git-engine/`, `ast-engine/`, `ai-orchestrator/`, `visualizer/`) has its own `examples/` folder containing only the payloads it touches. Those are kept in sync with `shared/examples/` — `shared/` is the source. Use it during development to test in isolation without crossing folder boundaries.

## Updating a contract

1. Edit the JSON Schema in `contracts/`.
2. Update the matching TypeScript type in `types/`.
3. Update the canonical example in `examples/`.
4. Re-copy the canonical example to every component `examples/` folder that consumes it (see distribution table in [docs/CONTRACTS.md](../docs/CONTRACTS.md)).
5. Re-run validation: `npx ajv-cli validate -s contracts/<name>.schema.json -d examples/<name>.example.json`.
