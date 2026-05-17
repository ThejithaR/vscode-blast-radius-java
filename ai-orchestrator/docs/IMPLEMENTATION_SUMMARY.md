# IBM Bob AI Orchestrator - Implementation Summary

## Executive Overview

The AI Orchestrator is the **semantic intelligence bridge** in the Blast Radius pipeline. It transforms structural AST dependency data (Contract A) into risk-annotated graph insights (Contract B) by leveraging IBM Bob's language understanding capabilities.

**Key Responsibilities:**
- 🎯 **Prompt Engineering** - Design system prompts for senior-architect risk evaluation
- 📥 **Context Injection** - Feed Contract A into Bob for downstream impact analysis
- 📦 **Payload Management** - Enforce Contract B output with strict validation
- 🔄 **Self-Healing Loop** - Catch malformed JSON and auto-retry in non-interactive mode

## Implementation Approach

### Phase 1: Core Infrastructure (Priority: HIGH)

#### 1.1 Zod Schema (`schemas/contractB.zod.ts`)
**Purpose:** Runtime validation of Bob's JSON output

**Key Features:**
- Mirror [`contract-b.schema.json`](../shared/contracts/contract-b.schema.json) exactly
- Strict enum validation for `risk` and `edge.type` fields
- Detailed error messages for self-healing loop
- Type-safe exports for TypeScript consumers

**Implementation:**
```typescript
import { z } from 'zod';

const RiskEnum = z.enum(["TARGET", "CRITICAL", "WARNING", "LOW_RISK", "SAFE"]);
const EdgeTypeEnum = z.enum(["breaking-dependency", "warning-dependency", "safe-dependency"]);

export const contractBSchema = z.object({
  targetFile: z.string(),
  targetPackage: z.string(),
  overallRiskScore: RiskEnum,
  summary: z.string(),
  nodes: z.array(z.object({
    id: z.string(),
    filePath: z.string(),
    packageName: z.string(),
    label: z.string(),
    risk: RiskEnum,
    reason: z.string()
  })),
  edges: z.array(z.object({
    from: z.string(),
    to: z.string(),
    type: EdgeTypeEnum
  }))
}).strict();

export type ContractB = z.infer<typeof contractBSchema>;
```

**Validation Strategy:**
- Throws `ZodError` with detailed path and message on failure
- Self-healing loop uses error details to guide Bob's correction
- Strict mode prevents additional properties

---

#### 1.2 Prompt Builder (`bob/promptBuilder.ts`)
**Purpose:** Assemble complete system prompt from markdown files

**Key Features:**
- Concatenate all skill prompts in correct order
- Cache prompt content after first read
- Strip HTML comments from markdown
- Serialize Contract A as user message

**Implementation:**
```typescript
import { readFileSync } from 'fs';
import { join } from 'path';
import type { ContractA } from '@blast-radius/shared';

export interface PromptPair {
  system: string;
  user: string;
}

const PROMPT_FILES = [
  'system.md',
  'diffIntent.md',
  'riskClassification.md',
  'reasonGeneration.md',
  'edgeTyping.md',
  'overallSummary.md'
];

let cachedSystemPrompt: string | null = null;

export function buildPrompt(contractA: ContractA): PromptPair {
  if (!cachedSystemPrompt) {
    const promptDir = join(__dirname, 'prompts');
    cachedSystemPrompt = PROMPT_FILES
      .map(file => readFileSync(join(promptDir, file), 'utf-8'))
      .map(content => content.replace(/<!--.*?-->/gs, '').trim())
      .join('\n\n---\n\n');
  }

  return {
    system: cachedSystemPrompt,
    user: JSON.stringify(contractA, null, 2)
  };
}
```

**Prompt Order (Critical):**
1. `system.md` - Global persona and output rules
2. `diffIntent.md` - Skill 1: Analyze change type
3. `riskClassification.md` - Skill 2: Assign risk levels
4. `reasonGeneration.md` - Skill 3: Generate reasons
5. `edgeTyping.md` - Skill 4: Type edges
6. `overallSummary.md` - Skill 5: Compute overall score

---

#### 1.3 Bob Client (`bob/BobClient.ts`)
**Purpose:** Shell CLI client for IBM Bob (local installation)

**Architecture:** "Bring Your Own CLI" (BYOC) pattern - Bob Shell must be installed on user's machine.

**Key Features:**
- `child_process.execSync` for Bob Shell invocation
- Configurable timeout and model selection
- Robust JSON extraction (handles text before/after JSON)
- Pre-flight installation check
- Stderr suppression (prevents IDE warnings)

**Implementation:**
```typescript
import { execSync } from 'child_process';

export interface BobConfig {
  model?: string;
  temperature?: number;
  timeout?: number;
}

export interface BobRequest {
  system: string;
  user: string;
  model: string;
  temperature: number;
}

export interface BobResponse {
  content: string;  // Clean JSON extracted from Bob output
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class BobClient {
  private config: Required<BobConfig>;

  constructor(config: BobConfig) {
    this.config = {
      model: 'granite-13b-chat',
      temperature: 0.0,
      timeout: 60000,
      ...config
    };
  }

  async call(request: BobRequest): Promise<BobResponse> {
    // 1. Verify Bob Shell is installed
    this.checkBobInstalled();

    // 2. Combine system and user prompts
    const combinedPrompt = `${request.system}\n\n${request.user}`;

    // 3. Execute Bob Shell CLI with prompt via stdin
    const bobOutput = execSync('bob', { 
      input: combinedPrompt,
      encoding: 'utf-8',
      timeout: this.config.timeout,
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'ignore']  // Suppress stderr for IDE companion warnings
    });

    // 4. Extract JSON from response (Bob may output text before/after)
    const response = bobOutput.trim();
    const firstBrace = response.indexOf('{');
    const lastBrace = response.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('No valid JSON found in Bob response');
    }
    
    // Use brace-counting to find matching closing brace
    let braceCount = 0;
    let endPos = firstBrace;
    for (let i = firstBrace; i < response.length; i++) {
      if (response[i] === '{') braceCount++;
      if (response[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          endPos = i;
          break;
        }
      }
    }
    
    const jsonContent = response.substring(firstBrace, endPos + 1).trim();

    return {
      content: jsonContent,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    };
  }

  private checkBobInstalled(): void {
    try {
      execSync('bob --version', { stdio: 'ignore' });
    } catch (error) {
      throw new Error(
        'IBM Bob Shell is not installed. ' +
        'Install from: https://bob.ibm.com/docs/shell'
      );
    }
  }
}
```

**Error Handling:**
- Bob Shell not installed: Clear installation link
- Shell injection prevention: Uses stdin instead of string interpolation
- Timeout: Configurable, default 60s
- JSON extraction: Handles text before/after JSON via brace-counting
- stderr suppressed: Prevents IDE companion warnings from corrupting output
- 500: Bob service error
- Timeout: Configurable, default 60s

---

### Phase 2: Resilience & Optimization (Priority: HIGH)

#### 2.1 Token Manager (`retry/tokenManager.ts`)
**Purpose:** Keep prompts under context window limit

**Key Features:**
- Estimate token count (1 token ≈ 4 chars)
- Truncate `usageContextLine` proportionally
- Never drop entire dependencies
- Preserve critical fields

**Implementation:**
```typescript
import type { ContractA } from '@blast-radius/shared';

export interface TokenLimits {
  maxContextWindow: number;
  systemPromptTokens: number;
  reserveForResponse: number;
}

export function truncateContractA(
  contractA: ContractA,
  limits: TokenLimits
): ContractA {
  const estimateTokens = (text: string) => Math.ceil(text.length / 4);
  
  const availableTokens = limits.maxContextWindow 
    - limits.systemPromptTokens 
    - limits.reserveForResponse;
  
  const currentTokens = estimateTokens(JSON.stringify(contractA));
  
  if (currentTokens <= availableTokens) {
    return contractA;
  }
  
  const maxLineLength = Math.floor(
    (availableTokens * 4) / contractA.dependencies.length
  );
  
  return {
    ...contractA,
    dependencies: contractA.dependencies.map(dep => ({
      ...dep,
      usageContextLine: dep.usageContextLine.length > maxLineLength
        ? dep.usageContextLine.slice(0, maxLineLength) + '...'
        : dep.usageContextLine
    }))
  };
}
```

**Token Budget:**
- Context window: 8192 tokens (Granite-13b)
- System prompt: ~1500 tokens
- Response reserve: 2048 tokens
- Available for Contract A: ~4644 tokens

---

#### 2.2 Self-Healing Loop (`retry/selfHealingLoop.ts`)
**Purpose:** Retry with error feedback on validation failure

**Key Features:**
- Max 3 retry attempts
- Append validation errors to prompt
- Handle both JSON parse and schema errors
- Configurable retry callback

**Implementation:**
```typescript
import { z } from 'zod';
import { BobClient, BobRequest } from '../bob/BobClient';
import { contractBSchema } from '../schemas/contractB.zod';
import type { ContractB } from '@blast-radius/shared';

export interface RetryConfig {
  maxRetries: number;
  onRetry?: (attempt: number, error: z.ZodError) => void;
}

export async function callWithRetry(
  client: BobClient,
  request: BobRequest,
  config: RetryConfig = { maxRetries: 3 }
): Promise<ContractB> {
  let lastError: Error | null = null;
  let currentRequest = request;

  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await client.call(currentRequest);
      const rawJson = JSON.parse(response.content);
      const validated = contractBSchema.parse(rawJson);
      return validated;
      
    } catch (error) {
      lastError = error as Error;
      
      if (error instanceof z.ZodError && attempt < config.maxRetries) {
        config.onRetry?.(attempt, error);
        currentRequest = {
          ...currentRequest,
          user: buildCorrectionPrompt(currentRequest.user, error)
        };
        continue;
      }
      
      if (error instanceof SyntaxError && attempt < config.maxRetries) {
        currentRequest = {
          ...currentRequest,
          user: buildJsonCorrectionPrompt(currentRequest.user, error.message)
        };
        continue;
      }
      
      break;
    }
  }

  throw new Error(
    `Bob failed after ${config.maxRetries} attempts: ${lastError?.message}`
  );
}

function buildCorrectionPrompt(original: string, error: z.ZodError): string {
  const errors = error.errors
    .map(e => `- ${e.path.join('.')}: ${e.message}`)
    .join('\n');

  return `${original}

---

CORRECTION REQUIRED:
Your previous response failed schema validation:

${errors}

Please re-emit the entire ContractB JSON, fixing these validation issues.`;
}
```

**Retry Strategy:**
- Attempt 1: Original prompt
- Attempt 2+: Original + validation error details
- Each retry includes full context

---

### Phase 3: Integration & API (Priority: HIGH)

#### 3.1 Main Orchestrator (`index.ts`)
**Purpose:** Public API that composes all components

**Key Features:**
- Single `analyze()` function export
- Environment variable configuration
- Optional runtime overrides
- Comprehensive error handling

**Implementation:**
```typescript
import type { ContractA, ContractB } from '@blast-radius/shared';
import { BobClient, BobConfig } from './bob/BobClient';
import { buildPrompt } from './bob/promptBuilder';
import { truncateContractA } from './retry/tokenManager';
import { callWithRetry } from './retry/selfHealingLoop';

export interface AnalyzeOptions {
  model?: string;
  maxRetries?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function analyze(
  contractA: ContractA,
  options: AnalyzeOptions = {}
): Promise<ContractB> {
  // Bob Shell authentication is handled locally - no API keys needed
  const config: BobConfig = {
    model: options.model || process.env.BOB_MODEL || 'granite-13b-chat',
    temperature: 0.0,  // Always deterministic for JSON output
    timeout: parseInt(process.env.BOB_TIMEOUT || '60000', 10)
  };

  const client = new BobClient(config);
  const prompts = buildPrompt(contractA);
  
  const truncated = truncateContractA(contractA, {
    maxContextWindow: 8192,
    systemPromptTokens: 1500,
    reserveForResponse: 2048
  });

  const finalPrompts = {
    system: prompts.system,
    user: JSON.stringify(truncated, null, 2)
  };

  return await callWithRetry(
    client,
    {
      system: finalPrompts.system,
      user: finalPrompts.user,
      model: config.model,
      temperature: config.temperature
    },
    { maxRetries: options.maxRetries || 3, onRetry: options.onRetry }
  );
}

export type { ContractA, ContractB } from '@blast-radius/shared';
export { contractBSchema } from './schemas/contractB.zod';
```

**Configuration Priority:**
1. Explicit options passed to `analyze()`
2. Environment variables (BOB_MODEL, BOB_TIMEOUT only)
3. Defaults (granite-13b-chat, 60000ms timeout)

---

## Testing Strategy

### Unit Tests

**Test Coverage:**
- ✅ Zod schema validates canonical example
- ✅ Zod schema rejects invalid enums
- ✅ Prompt builder concatenates in correct order
- ✅ Token manager truncates oversized inputs
- ✅ Token manager preserves dependency count
- ✅ Self-healing loop retries on ZodError
- ✅ Self-healing loop throws after max retries

**Test Files:**
```
ai-orchestrator/src/
├── schemas/
│   └── contractB.zod.spec.ts
├── bob/
│   └── promptBuilder.spec.ts
├── retry/
│   ├── tokenManager.spec.ts
│   └── selfHealingLoop.spec.ts
└── index.spec.ts
```

### Integration Tests

**Mock Bob Server:**
```typescript
import express from 'express';

const app = express();
app.use(express.json());

app.post('/chat/completions', (req, res) => {
  const contractB = require('../examples/contract-b.example.json');
  res.json({
    choices: [{ message: { content: JSON.stringify(contractB) } }],
    usage: { promptTokens: 1500, completionTokens: 500, totalTokens: 2000 }
  });
});

export const mockServer = app.listen(8080);
```

**Test Scenarios:**
1. Valid Contract A → Valid Contract B
2. Malformed JSON → Retry → Valid Contract B
3. Schema violation → Retry → Valid Contract B
4. Max retries exhausted → Error thrown
5. Large Contract A → Truncation → Valid Contract B

---

## Environment Configuration

### Installation Requirement

Bob Shell must be installed locally before use. Authentication is handled via local IBM SSO - no API keys needed.

```bash
# Install Bob Shell (one-time setup)
curl -fsSL https://bob.ibm.com/download/bobshell.sh | bash

# Accept license
bob --accept-license

# Verify installation
bob --version
```

### Optional Environment Variables

```bash
# Model selection (default: granite-13b-chat)
export BOB_MODEL="granite-13b-chat"

# Request timeout in milliseconds (default: 60000)
export BOB_TIMEOUT="60000"
```

### Usage Example

```typescript
import { analyze } from '@blast-radius/ai-orchestrator';
import type { ContractA } from '@blast-radius/shared';

const contractA: ContractA = {
  targetFile: 'src/main/java/com/example/Utils.java',
  targetPackage: 'com.example',
  gitDiff: '...',
  dependencies: [...]
};

// Use environment variables and defaults
const contractB = await analyze(contractA);

// Or override model and retry configuration
const contractB = await analyze(contractA, {
  model: 'granite-34b-chat',
  maxRetries: 5,
  onRetry: (attempt, error) => {
    console.log(`Retry ${attempt}: ${error.message}`);
  }
});
```

---

## Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create `schemas/contractB.zod.ts` with strict validation
- [ ] Implement `bob/promptBuilder.ts` with caching
- [ ] Create `bob/BobClient.ts` with Axios
- [ ] Write unit tests for each component

### Phase 2: Resilience
- [ ] Implement `retry/tokenManager.ts` with truncation logic
- [ ] Create `retry/selfHealingLoop.ts` with retry mechanism
- [ ] Add integration tests with mock Bob server
- [ ] Test with large Contract A fixtures

### Phase 3: Integration
- [ ] Create `index.ts` with public API
- [ ] Add TypeScript type exports
- [ ] Document environment variables
- [ ] Create end-to-end integration test

### Phase 4: Documentation
- [ ] Update README with usage examples
- [ ] Document error handling patterns
- [ ] Add troubleshooting guide
- [ ] Create deployment checklist

---

## Success Criteria

The implementation is complete when:

1. ✅ Running `analyze()` against [`contract-a.example.json`](./examples/contract-a.example.json) returns valid Contract B
2. ✅ Zod validation passes for canonical example
3. ✅ All unit tests pass with 100% coverage
4. ✅ Integration test with mock Bob succeeds
5. ✅ Token truncation works for large inputs
6. ✅ Self-healing loop recovers from malformed JSON
7. ✅ Error messages are clear and actionable
8. ✅ Environment variables are documented

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Success rate | >95% | Without retry |
| Retry rate | <10% | Requiring 1+ retries |
| Average latency | <5s | Network + inference |
| P95 latency | <10s | Including retries |
| Token efficiency | >90% | Of available budget used |

---

## Next Steps

### Immediate Actions

1. **Review this plan** with the team
2. **Validate Bob API access** - Test endpoint and credentials
3. **Set up development environment** - Install dependencies
4. **Create feature branch** - `feature/ai-orchestrator-implementation`

### Implementation Order

1. Start with Zod schema (foundation for validation)
2. Build prompt builder (needed for testing)
3. Implement Bob client (core HTTP layer)
4. Add token manager (optimization)
5. Create self-healing loop (resilience)
6. Integrate in main orchestrator (public API)
7. Write comprehensive tests
8. Document and deploy

### Questions to Resolve

- [ ] Confirm Bob API endpoint format
- [ ] Verify authentication mechanism (Bearer token?)
- [ ] Determine model name for Granite-13b
- [ ] Clarify rate limits and quotas
- [ ] Decide on logging strategy

---

## References

- [Implementation Plan](./IMPLEMENTATION_PLAN.md) - Detailed component specifications
- [Architecture](./ARCHITECTURE.md) - System design and data flow
- [Bob Skills Spec](../visualizer/BOB-SKILLS-SPEC.md) - What Bob must produce
- [Contract Documentation](../docs/CONTRACTS.md) - Data contract definitions
- [README](./README.md) - Usage and API documentation

---

## Contact & Support

**Owner:** Member 4 (AI Orchestrator)  
**Dependencies:** Member 5 (Bob Skills Spec), Member 1 (Extension Integration)  
**Tech Stack:** TypeScript, Axios, Zod, IBM Bob API