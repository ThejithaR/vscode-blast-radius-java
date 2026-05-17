# Bob Skills Specification

> **Owner:** Member 5 (Visualizer). **Implementer:** Member 4 (AI Orchestrator).
>
> This file is the contract from M5 to M4. M5 knows what the UI needs; M4 implements the prompts that make Bob produce it.

---

## Why This Document Exists

The AST engine (Member 3) emits *only structural* information — `dependencies[]` with `filePath`, `packageName`, `importedSymbols`, and `usageContextLine`. **No severity. No reasoning. No edge typing.**

Every field of [`ContractB`](../shared/types/contractB.ts) that drives the visual rendering — `overallRiskScore`, `summary`, each node's `risk` and `reason`, each edge's `type` — is produced by **IBM Bob**.

The visualizer is therefore the downstream consumer that defines what Bob must deliver. This file enumerates the seven skills Bob must perform, with input/output schemas, examples, edge cases, and acceptance criteria.

---

## The Seven Skills

### Skill 1 — `DiffIntentAnalysis`

**Purpose:** Before classifying any dependency, Bob must understand *what kind* of change was made.

**Input:** the `gitDiff` field of Contract A.

**Output (Bob's internal reasoning — not part of Contract B output, but informs Skill 2):**

```ts
{
  intent: "SIGNATURE_CHANGE" | "LOGIC_CHANGE" | "CONSTANT_TUNING" |
          "EXCEPTION_HANDLING" | "CONCURRENCY_CHANGE" | "SECURITY_LOGIC" | "RENAME_ONLY",
  description: string  // one sentence, e.g. "Added mandatory boolean parameter 'strictMode'."
}
```

**Intent definitions:**

| Intent | Trigger |
|---|---|
| `SIGNATURE_CHANGE` | Parameter list, return type, throws clause, or visibility modifiers changed |
| `LOGIC_CHANGE` | Method body changed, signature unchanged |
| `CONSTANT_TUNING` | Only numeric/string literals changed (timeouts, thresholds, URLs) |
| `EXCEPTION_HANDLING` | try/catch/throws added, removed, or rethrown differently |
| `CONCURRENCY_CHANGE` | `synchronized`, locks, async, thread primitives added or removed |
| `SECURITY_LOGIC` | Auth, crypto, validation, or sanitization logic touched |
| `RENAME_ONLY` | Identifiers renamed, no semantic change (rare but trivially safe) |

**Edge case:** If multiple intents apply, choose the one with the greatest blast-radius (e.g. SIGNATURE_CHANGE > LOGIC_CHANGE > CONSTANT_TUNING).

**Failure mode:** If Bob cannot determine an intent, default to `LOGIC_CHANGE` and add a `LOGICAL RUNTIME WARN:` prefix to all dependency reasons.

---

### Skill 2 — `RiskClassification`

**Purpose:** For each dependency, assign a `risk` level that drives the Mermaid node color.

**Input:** the intent from Skill 1 + each `dependencies[i].usageContextLine` and `packageName`.

**Output:** `risk` enum on each Contract B node:

| Value | Meaning | Mermaid color (visualizer applies) |
|---|---|---|
| `TARGET` | The modified file itself. Exactly one node. | Blue `#3b82f6` |
| `CRITICAL` | Compile break or certain runtime failure | Red `#ef4444` |
| `WARNING` | Logical bug likely — compiles but semantics diverge | Amber `#f59e0b` |
| `LOW_RISK` | Peripheral usage (logging, analytics, metrics) | Orange `#fb923c` |
| `SAFE` | No observable change in behavior | Green `#22c55e` |

**Classification rules:**

| Intent | Default risk (callers) | Reduced to |
|---|---|---|
| SIGNATURE_CHANGE | CRITICAL | LOW_RISK if caller is in `*.analytics.*` / `*.logging.*` / `*.metrics.*` |
| LOGIC_CHANGE | WARNING | LOW_RISK if call result is discarded or only logged |
| CONSTANT_TUNING | WARNING | SAFE if tuning is documented as backward-compatible |
| EXCEPTION_HANDLING | WARNING | CRITICAL if caller's signature doesn't declare the new exception |
| CONCURRENCY_CHANGE | WARNING | CRITICAL if caller is in a request-handling path (`*.controllers.*`, `*.middleware.*`) |
| SECURITY_LOGIC | CRITICAL | (rarely reduced; security regressions are always CRITICAL) |
| RENAME_ONLY | SAFE | — |

**Edge case:** Reflective callers (e.g. `Method.invoke`) are invisible to AST; if Bob spots a reflective call in `usageContextLine` it flags as WARNING with a reason mentioning reflection.

**Failure mode:** If neither caller nor target package can be determined, default to WARNING.

---

### Skill 3 — `ReasonGeneration`

**Purpose:** Produce a short, technically specific human-readable string for each node's `reason` field.

**Input:** the dependency + its assigned risk + the diff intent.

**Output:** a string ≤ 280 characters, prefixed:

- `COMPILE BREAK:` for CRITICAL with compile-time failure
- `LOGICAL RUNTIME WARN:` for WARNING or LOW_RISK
- `SAFE PASSIVE:` for SAFE

**Tone:** Match the canonical example in [shared/examples/contract-b.example.json](../shared/examples/contract-b.example.json). Mention the exact parameter, method, or behavior change. Avoid vague phrases like "may cause issues."

**Acceptance examples:**

> ✅ "COMPILE BREAK: The method call verifyTokenStructure(rawToken) is missing the new mandatory 'strictMode' parameter. This will completely halt compilation."

> ✅ "LOGICAL RUNTIME WARN: While compile-breaking parameters apply here too, this is an analytics sink. Less runtime business threat than billing or auth failures."

> ❌ "There may be a problem with this call." (too vague)
> ❌ "Method signature changed." (no specificity about the symbol)

---

### Skill 4 — `EdgeTypeClassification`

**Purpose:** Type each Contract B edge so the visualizer can style it.

**Input:** the destination node's risk.

**Output:** the `type` field on each edge:

| Destination node risk | Edge type | Visualizer style |
|---|---|---|
| CRITICAL | `breaking-dependency` | solid red arrow |
| WARNING | `warning-dependency` | solid amber arrow |
| LOW_RISK | `warning-dependency` | solid orange arrow (same type as WARNING) |
| SAFE | `safe-dependency` | dotted gray arrow |
| TARGET | — (TARGET is the source; no incoming edges) |

Every edge has `from = node_target` for the MVP. Future scope: transitive edges between callers.

---

### Skill 5 — `OverallSummary`

**Purpose:** Populate the top-of-graph summary panel.

**Input:** the full set of classified nodes.

**Output:** `overallRiskScore` + `summary`:

- `overallRiskScore` = the worst risk among non-TARGET nodes, ordered `CRITICAL > WARNING > LOW_RISK > SAFE`. If only TARGET exists (no dependencies), output `SAFE`.
- `summary` = 2-3 sentences. Lead with what changed. Follow with how many downstream files are affected and at what severity. End with the headline action ("Urgent refactoring required." / "Review before merging." / "Safe to merge.").

**Acceptance example:**

> "The addition of a mandatory 'strictMode' boolean parameter to verifyTokenStructure() creates breaking compile-time errors in 2 downstream files. Urgent refactoring required."

---

### Skill 6 — `PackageContextWeighting`

**Purpose:** A weighting heuristic that informs Skill 2 (not a separately serialized field).

**Input:** each dependency's `packageName`.

**Output:** an implicit weight that nudges the risk classification.

**Heuristics:**

| Package pattern | Weight | Effect |
|---|---|---|
| `*.api.controllers.*`, `*.middleware.*`, `*.filters.*` | High | Skills 2's "reduced to" column does not apply — stays CRITICAL |
| `*.service.*`, `*.business.*`, `*.domain.*` | Medium | Default classification |
| `*.analytics.*`, `*.logging.*`, `*.metrics.*`, `*.audit.*` | Low | Reduces CRITICAL → LOW_RISK |
| `*.test.*`, `*.testing.*`, `*Test.java`, `*Tests.java` | None | Excluded from graph entirely |

**This is why** the canonical example shows `InternalBillingController.java` as CRITICAL but `AuditLogger.java` as LOW_RISK despite both having the same compile-break signature mismatch.

---

### Skill 7 — `SelfHealingOutput`

**Purpose:** Recover from format errors without breaking the pipeline.

**Implementation:** lives in Member 4's `ai-orchestrator/src/retry/selfHealingLoop.ts` — not a prompt-only skill.

**Behavior:**

1. M4 sends Contract A + system prompt to Bob.
2. Bob returns raw JSON.
3. Zod (`schemas/contractB.zod.ts`) validates.
4. **On failure:** M4 re-prompts Bob with the validation error appended:
   ```
   Your previous response failed schema validation: <ZodError.message>.
   Please re-emit the entire ContractB JSON, fixing exactly this issue.
   ```
5. Repeat up to `maxRetries = 3`.
6. After exhaustion, M4 throws → M1's `errorBoundary.ts` shows an error toast.

**M5's stake:** The UI may briefly show a loading state for up to ~3 × (Bob latency) on retries. `EmptyState.tsx` shows a spinner + "Bob is refining the analysis…" message during retries.

---

## Worked Example

Using the canonical inputs:

**Contract A (input to Bob)** — see [shared/examples/contract-a.example.json](../shared/examples/contract-a.example.json).

The relevant signals:

- `gitDiff` shows `verifyTokenStructure(String token)` becoming `verifyTokenStructure(String token, boolean strictMode)`.
- Three dependencies: a JWT filter, an internal billing controller, and an audit logger.

**Skill 1 (DiffIntentAnalysis)** classifies this as `SIGNATURE_CHANGE` — added a mandatory parameter.

**Skill 6 (PackageContextWeighting)** marks:
- `com.example.api.middleware` → High weight (request-path)
- `com.example.api.controllers` → High weight (request-path)
- `com.example.analytics.logging` → Low weight (analytics sink)

**Skill 2 (RiskClassification)** then assigns:
- Target file (`ValidationUtils.java`) → `TARGET`
- `JwtAuthFilter.java` → `CRITICAL` (high weight + SIGNATURE_CHANGE default)
- `InternalBillingController.java` → `CRITICAL` (same)
- `AuditLogger.java` → `LOW_RISK` (low-weight package reduces CRITICAL → LOW_RISK)

**Skill 3 (ReasonGeneration)** produces the exact strings shown in [shared/examples/contract-b.example.json](../shared/examples/contract-b.example.json).

**Skill 4 (EdgeTypeClassification)** types edges:
- node_target → node_filter: `breaking-dependency`
- node_target → node_billing: `breaking-dependency`
- node_target → node_logger: `warning-dependency` (LOW_RISK destination)

**Skill 5 (OverallSummary)** sets `overallRiskScore = CRITICAL` and writes the summary.

**Skill 7 (SelfHealingOutput)** would activate only if Bob produced malformed JSON — for this canonical example, no retries.

The final `Contract B` is identical to [shared/examples/contract-b.example.json](../shared/examples/contract-b.example.json).

---

## Acceptance Criteria — M4 must satisfy before M5 considers integration done

M5 will accept M4's implementation as complete when:

1. ✅ Running M4's `analyze()` against [examples/contract-a.example.json](./examples/contract-a.example.json) returns a payload that passes [Zod validation](../ai-orchestrator/src/schemas/contractB.zod.ts).
2. ✅ For the canonical input, the returned Contract B has:
   - `overallRiskScore = "CRITICAL"`
   - exactly 4 nodes (1 TARGET + 3 dependencies)
   - `node_filter.risk = "CRITICAL"` and `node_billing.risk = "CRITICAL"`
   - `node_logger.risk = "LOW_RISK"` (proving package-context weighting works)
   - Every `reason` is prefixed with `COMPILE BREAK:`, `LOGICAL RUNTIME WARN:`, or `SAFE PASSIVE:`
3. ✅ Bob returns valid JSON within 3 retries on at least 95% of runs in the smoke-test corpus (M2's [demo/sample-diffs/](../demo/sample-diffs/)).
4. ✅ When given a `RENAME_ONLY` diff (identifiers only, no semantic change), `overallRiskScore = "SAFE"`.
5. ✅ Total prompt size stays under the model's context window on the largest fixture in [demo/sample-diffs/](../demo/sample-diffs/) — `tokenManager.ts` truncates `usageContextLine` if needed but never drops dependencies.

If any of these fail, the visual output breaks (wrong colors, missing reasons, broken legends). The graph is only as good as the data Bob produces.

---

## Open Spec Questions

- Should `RiskClassification` distinguish *transitive* risks for indirect callers (M3 only finds direct callers in MVP)? Deferred to v0.2.
- Do we need a `confidence` field on each node? Useful for the UI but adds Bob output complexity. Deferring.
- Should `reason` support Markdown? Currently plain text; if M5 needs links, we'd need a render-safe subset.
