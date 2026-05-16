# Data Contracts

The pipeline passes data between components as **four strict JSON payloads**. Schemas live in [shared/contracts/](../shared/contracts/), TypeScript types in [shared/types/](../shared/types/), and canonical examples in [shared/examples/](../shared/examples/).

**Critical invariant: no severity field exists before Bob.** AST output is purely structural — Bob is the sole authority on risk levels and reasons.

---

## 1. `GitDeltaOutput` — M2 → M1

**Produced by** `git-engine` (Member 2). **Consumed by** `extension` (Member 1) and then forwarded as input to `ast-engine` (Member 3).

```json
{
  "targetFile": "string (workspace-relative path)",
  "targetPackage": "string (Java FQN)",
  "gitDiff": "string (unified diff format)",
  "changedMethods": ["string"]
}
```

### Field commentary

| Field | Notes |
|---|---|
| `targetFile` | Always workspace-relative, forward slashes even on Windows |
| `targetPackage` | Resolved from the `package` declaration in the modified file |
| `gitDiff` | Output of `git diff HEAD -- <file>`, including `@@` hunk headers |
| `changedMethods` | Method names whose lines fall inside the diff hunks. Driven by `symbolMapper.ts` |

Example: [shared/examples/git-delta-output.example.json](../shared/examples/git-delta-output.example.json)

---

## 2. `AstDependenciesOutput` — M3 → M1

**Produced by** `ast-engine` (Member 3). **Consumed by** `extension` (Member 1) for merging into Contract A.

```json
{
  "dependencies": [
    {
      "filePath": "string (workspace-relative)",
      "packageName": "string",
      "importedSymbols": ["string"],
      "usageContextLine": "string (one-line source excerpt)"
    }
  ]
}
```

### Field commentary

| Field | Notes |
|---|---|
| `dependencies[].filePath` | Workspace-relative path to a file that calls one of `changedMethods` |
| `dependencies[].packageName` | The Java package of that caller — drives Bob's package-context weighting |
| `dependencies[].importedSymbols` | Which symbols from the target file the caller imports |
| `dependencies[].usageContextLine` | The exact source line of the call — Bob uses this to judge semantic risk |

**M3 emits only this object — not full Contract A.** The merge with `GitDeltaOutput` happens in `extension/src/orchestrator/contractAssembler.ts`.

Example: [shared/examples/ast-dependencies-output.example.json](../shared/examples/ast-dependencies-output.example.json)

---

## 3. `ContractA` — M1 → M4 (the merge)

**Produced by** `extension/src/orchestrator/contractAssembler.ts` by spreading `GitDeltaOutput` and `AstDependenciesOutput` together. **Consumed by** `ai-orchestrator` (Member 4).

```json
{
  "targetFile": "string",
  "targetPackage": "string",
  "gitDiff": "string",
  "dependencies": [ ... AstDependenciesOutput.dependencies ... ]
}
```

`changedMethods` from `GitDeltaOutput` is *intentionally dropped* — Bob infers the changed methods from the diff itself.

Example: [shared/examples/contract-a.example.json](../shared/examples/contract-a.example.json)

---

## 4. `ContractB` — M4 → M1 → M5

**Produced by** `ai-orchestrator` (Member 4), via IBM Bob. **Validated** by Zod before leaving M4. **Consumed by** `visualizer` (Member 5) via webview `postMessage`.

```json
{
  "targetFile": "string",
  "targetPackage": "string",
  "overallRiskScore": "TARGET | CRITICAL | WARNING | LOW_RISK | SAFE",
  "summary": "string (2-3 sentences)",
  "nodes": [
    {
      "id": "string",
      "filePath": "string",
      "packageName": "string",
      "label": "string",
      "risk": "TARGET | CRITICAL | WARNING | LOW_RISK | SAFE",
      "reason": "string"
    }
  ],
  "edges": [
    {
      "from": "string (node id)",
      "to": "string (node id)",
      "type": "breaking-dependency | warning-dependency | safe-dependency"
    }
  ]
}
```

### Enums

| `risk` value | Meaning | Mermaid color |
|---|---|---|
| `TARGET` | The modified file itself | Blue |
| `CRITICAL` | Compile break or certain runtime failure | Red |
| `WARNING` | Semantic mismatch — logical bug likely | Yellow |
| `LOW_RISK` | Peripheral usage (logging, analytics) | Orange |
| `SAFE` | No observable change in behavior | Green |

| `edge.type` value | Mermaid style |
|---|---|
| `breaking-dependency` | Solid red arrow |
| `warning-dependency` | Solid yellow arrow |
| `safe-dependency` | Dotted gray arrow |

How Bob produces each field is specified in [visualizer/BOB-SKILLS-SPEC.md](../visualizer/BOB-SKILLS-SPEC.md).

Example: [shared/examples/contract-b.example.json](../shared/examples/contract-b.example.json)

---

## Round-trip validation

The four examples in [shared/examples/](../shared/examples/) must validate against their schemas:

```bash
npx ajv-cli validate -s shared/contracts/git-delta-output.schema.json -d shared/examples/git-delta-output.example.json
npx ajv-cli validate -s shared/contracts/ast-dependencies-output.schema.json -d shared/examples/ast-dependencies-output.example.json
npx ajv-cli validate -s shared/contracts/contract-a.schema.json -d shared/examples/contract-a.example.json
npx ajv-cli validate -s shared/contracts/contract-b.schema.json -d shared/examples/contract-b.example.json
```

Additionally, spread-merging `git-delta-output` and `ast-dependencies-output` examples (dropping `changedMethods`) must produce a payload structurally equal to `contract-a.example.json`.
