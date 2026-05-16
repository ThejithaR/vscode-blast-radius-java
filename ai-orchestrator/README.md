# ai-orchestrator/ — IBM Bob Client & Payload Manager

## Mission

Talk to IBM Bob. Convert `ContractA` into a system prompt, get a response, validate it against the Zod schema for `ContractB`, retry with error context if Bob hallucinates the format. Be model-agnostic so the endpoint can be swapped from Bob to AntiGravity / Claude via an env var.

## Owner

**Member 4.**

> **Critical**: All severity, reasoning, and edge typing is produced by this component (via Bob). The AST engine emits no severity. The contract describing what Bob must produce is **owned by Member 5** in [visualizer/BOB-SKILLS-SPEC.md](../visualizer/BOB-SKILLS-SPEC.md). M4 implements; M5 specifies.

## Tech Stack

- TypeScript 5.x
- [Axios](https://axios-http.com/) for HTTP
- [Zod](https://zod.dev/) for response validation
- Env var `BOB_ENDPOINT` + `BOB_API_KEY`

## Inputs / Outputs

| Direction | Source/Sink | Contract |
|---|---|---|
| In | `extension/orchestrator/pipeline.ts` | [`ContractA`](../shared/types/contractA.ts) |
| Out | IBM Bob HTTP | system + user prompt |
| In | IBM Bob HTTP | raw JSON (untrusted) |
| Out | `pipeline.ts` | [`ContractB`](../shared/types/contractB.ts) (Zod-validated) |

## Public API

```ts
import type { ContractA, ContractB } from "@blast-radius/shared";

export async function analyze(
  contractA: ContractA,
  options?: { endpoint?: string; apiKey?: string; maxRetries?: number }
): Promise<ContractB>;
```

## Bob's Skills (Implementation)

The seven skills Bob must perform are spec'd in [visualizer/BOB-SKILLS-SPEC.md](../visualizer/BOB-SKILLS-SPEC.md). M4's implementation lives under [src/bob/prompts/](./src/bob/prompts/):

| Skill | Prompt file |
|---|---|
| `system` (persona + global rules) | `prompts/system.md` |
| DiffIntentAnalysis | `prompts/diffIntent.md` |
| RiskClassification | `prompts/riskClassification.md` |
| ReasonGeneration | `prompts/reasonGeneration.md` |
| EdgeTypeClassification | `prompts/edgeTyping.md` |
| OverallSummary | `prompts/overallSummary.md` |
| SelfHealingOutput (in code) | `retry/selfHealingLoop.ts` |

`promptBuilder.ts` composes these into a single system message + Contract A as the user message.

## Validation & Retry

`schemas/contractB.zod.ts` mirrors [shared/contracts/contract-b.schema.json](../shared/contracts/contract-b.schema.json) as a Zod schema. On parse failure, `retry/selfHealingLoop.ts` re-prompts Bob with the Zod error message inlined, up to `maxRetries` (default 3). On final failure, throws — caught by `extension/errorBoundary.ts`.

`retry/tokenManager.ts` truncates oversize `usageContextLine` values to keep total prompt under the model context window. The dependency *count* is preserved; only individual lines are trimmed.

## Local Development

```bash
cd ai-orchestrator
npm install
npm run build
npm test            # uses examples/contract-a.example.json as fixture
```

Mock Bob via `BOB_ENDPOINT=http://localhost:8080/mock-bob` pointing at a local stub server that returns `examples/contract-b.example.json`.

## Mocking Upstream

Read [examples/contract-a.example.json](./examples/contract-a.example.json) to drive `analyze()` locally. The matching expected output is [examples/contract-b.example.json](./examples/contract-b.example.json).

## Integration Hooks

- Exported from `src/index.ts` as `analyze()`.
- Member 1 imports `@blast-radius/ai-orchestrator`.

## Open Questions

- Streaming vs. non-streaming response — non-streaming keeps Zod validation simple.
- Should the model name be configurable (Bob Granite-13b vs Granite-34b)? Likely yes via env var.
- Caching: same Contract A → same Contract B; consider keyed by hash of `gitDiff + dependencies` for repeated calls.
