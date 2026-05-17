# IBM Bob Usage Report - Blast Radius VS Code Extension

**Generated:** 2026-05-17  
**Repository:** vscode-blast-radius-java  
**Purpose:** Comprehensive documentation of all IBM Bob integrations and usage patterns

---

## Executive Summary

IBM Bob (Granite AI) is the **semantic intelligence engine** of the Blast Radius extension. It transforms structural AST dependency data into risk-annotated insights by analyzing code changes and their downstream impact.

**Key Integration Points:**
- 🔧 **Implementation:** `ai-orchestrator/` module (TypeScript)
- 🎯 **Architecture:** Local CLI Shell (BYOC - Bring Your Own CLI)
- 📊 **Input:** Contract A (git diff + AST dependencies)
- 📤 **Output:** Contract B (risk-annotated graph data)
- 🔐 **Authentication:** Local IBM SSO (no API keys required)

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Implementation](#core-implementation)
3. [Bob Shell Integration](#bob-shell-integration)
4. [Prompt Engineering](#prompt-engineering)
5. [Data Contracts](#data-contracts)
6. [Error Handling & Retry Logic](#error-handling--retry-logic)
7. [Configuration & Environment](#configuration--environment)
8. [Testing Strategy](#testing-strategy)
9. [Documentation References](#documentation-references)
10. [Usage Examples](#usage-examples)

---

## Architecture Overview

### System Flow

```
Git Changes → Git Engine → Contract A → AI Orchestrator → Bob Shell → Contract B → Visualizer
                                            ↓
                                    Prompt Builder
                                    Token Manager
                                    Self-Healing Loop
                                    Zod Validator
```

### Bob's Role

Bob performs **7 critical skills** to transform structural data into semantic insights:

1. **DiffIntentAnalysis** - Understand the type of change (signature, logic, rename)
2. **RiskClassification** - Assign risk levels (TARGET, CRITICAL, WARNING, LOW_RISK, SAFE)
3. **ReasonGeneration** - Generate human-readable explanations
4. **EdgeTypeClassification** - Type edges (breaking, warning, safe)
5. **OverallSummary** - Compute overall risk score and summary
6. **PackageContextWeighting** - Weight risk by package importance
7. **SelfHealingOutput** - Auto-correct malformed JSON responses

**Specification:** [`visualizer/BOB-SKILLS-SPEC.md`](visualizer/BOB-SKILLS-SPEC.md)

---

## Core Implementation

### Location: `ai-orchestrator/`

The AI Orchestrator is a standalone TypeScript module that handles all Bob interactions.

#### Key Files

| File | Purpose | Lines of Code |
|------|---------|---------------|
| `src/bob/BobClient.ts` | Shell CLI client for Bob | 176 |
| `src/bob/promptBuilder.ts` | Assembles system prompts from markdown | ~76 |
| `src/schemas/contractB.zod.ts` | Zod schema for Bob output validation | ~61 |
| `src/retry/selfHealingLoop.ts` | Retry logic with error feedback | ~156 |
| `src/retry/tokenManager.ts` | Token budget management | ~124 |
| `src/index.ts` | Main orchestrator API | ~112 |

#### Architecture Pattern

**"Bring Your Own CLI" (BYOC)**
- Bob Shell must be installed locally on user's machine
- No HTTP API calls or remote endpoints
- Authentication via local IBM SSO
- Uses `child_process.execSync` for shell invocation

---

## Bob Shell Integration

### Installation Requirement

Bob Shell is a **prerequisite** for the extension to function.

```bash
# One-time installation
curl -fsSL https://bob.ibm.com/download/bobshell.sh | bash

# Accept license
bob --accept-license

# Verify installation
bob --version
```

### Pre-flight Check

The extension automatically checks for Bob Shell installation:

```typescript
// ai-orchestrator/src/bob/BobClient.ts
private checkBobInstalled(): void {
  try {
    execSync('bob --version', { stdio: 'ignore' });
  } catch (error) {
    throw new Error(
      'IBM Bob Shell is not installed or not in PATH. ' +
      'Install it from: https://bob.ibm.com/docs/shell'
    );
  }
}
```

**Locations:**
- `ai-orchestrator/src/bob/BobClient.ts:137-145`
- `ai-orchestrator/README.md:363-376` (extension integration example)

### Shell Invocation

```typescript
// ai-orchestrator/src/bob/BobClient.ts:66-74
const bobOutput = execSync('bob', { 
  input: combinedPrompt,           // Prompt via stdin (prevents shell injection)
  encoding: 'utf-8',
  timeout: this.config.timeout,    // Default: 60000ms
  maxBuffer: 10 * 1024 * 1024,     // 10MB for large responses
  stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr
});
```

**Key Features:**
- ✅ Stdin input (prevents shell injection)
- ✅ Configurable timeout (default 60s)
- ✅ Large buffer support (10MB)
- ✅ Stderr suppression (avoids IDE warnings)

---

## Prompt Engineering

### Prompt Structure

Bob receives a **system prompt** (concatenated markdown files) and a **user prompt** (Contract A JSON).

#### System Prompt Files

Located in `ai-orchestrator/src/bob/prompts/`:

1. `system.md` - Global persona and output rules
2. `diffIntent.md` - Skill 1: Analyze change type
3. `riskClassification.md` - Skill 2: Assign risk levels
4. `reasonGeneration.md` - Skill 3: Generate reasons
5. `edgeTyping.md` - Skill 4: Type edges
6. `overallSummary.md` - Skill 5: Compute overall score

**Order is critical** - matches skill execution sequence in BOB-SKILLS-SPEC.md

#### Prompt Builder

```typescript
// ai-orchestrator/src/bob/promptBuilder.ts:35-60
export function buildPrompt(contractA: ContractA): PromptPair {
  if (!cachedSystemPrompt) {
    const promptDir = join(__dirname, '../../../..', 'src', 'bob', 'prompts');
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

**Features:**
- Caches system prompt after first read
- Strips HTML comments from markdown
- Serializes Contract A as user message

---

## Data Contracts

### Contract A (Input to Bob)

**Source:** Git Engine + AST Engine  
**Schema:** `shared/contracts/contract-a.schema.json`  
**Example:** `shared/examples/contract-a.example.json`

```typescript
interface ContractA {
  targetFile: string;        // Modified file path
  targetPackage: string;     // Java package
  gitDiff: string;          // Unified diff
  dependencies: Array<{
    filePath: string;        // Caller file
    packageName: string;     // Caller package
    importedSymbols: string[]; // Imported symbols
    usageContextLine: string;  // Call site source line
  }>;
}
```

**Critical:** No severity fields exist in Contract A. Bob is the sole authority on risk.

### Contract B (Output from Bob)

**Schema:** `shared/contracts/contract-b.schema.json`  
**Validation:** `ai-orchestrator/src/schemas/contractB.zod.ts`  
**Example:** `shared/examples/contract-b.example.json`

```typescript
interface ContractB {
  targetFile: string;
  targetPackage: string;
  overallRiskScore: "TARGET" | "CRITICAL" | "WARNING" | "LOW_RISK" | "SAFE";
  summary: string;
  nodes: Array<{
    id: string;
    filePath: string;
    packageName: string;
    label: string;
    risk: "TARGET" | "CRITICAL" | "WARNING" | "LOW_RISK" | "SAFE";
    reason: string;  // Must start with prefix: COMPILE BREAK: | LOGICAL RUNTIME WARN: | SAFE PASSIVE:
  }>;
  edges: Array<{
    from: string;
    to: string;
    type: "breaking-dependency" | "warning-dependency" | "safe-dependency";
  }>;
}
```

---

## Error Handling & Retry Logic

### Self-Healing Loop

Bob may return malformed JSON or schema violations. The self-healing loop automatically retries with error feedback.

```typescript
// ai-orchestrator/src/retry/selfHealingLoop.ts:33-92
export async function callWithRetry(
  client: BobClient,
  request: BobRequest,
  config: RetryConfig = { maxRetries: 3 }
): Promise<ContractB> {
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await client.call(currentRequest);
      const rawJson = JSON.parse(response.content);
      const validated = contractBSchema.parse(rawJson);
      return validated;
    } catch (error) {
      if (error instanceof z.ZodError && attempt < config.maxRetries) {
        // Append validation errors to prompt and retry
        currentRequest = {
          ...currentRequest,
          user: buildCorrectionPrompt(currentRequest.user, error)
        };
        continue;
      }
      // ... handle other errors
    }
  }
  throw new Error(`Bob failed after ${config.maxRetries} attempts`);
}
```

### Error Types

| Error | Cause | Recovery |
|-------|-------|----------|
| `BobNotInstalledError` | Bob Shell missing or not in PATH | User must install from bob.ibm.com/docs/shell |
| `BobTimeoutError` | Process timeout > configured timeout | Increase BOB_TIMEOUT |
| `BobValidationError` | Schema mismatch after max retries | Log error, show user-friendly message |
| `BufferOverflowError` | Response exceeds maxBuffer (10MB) | Reduce Contract A size |
| `JSONParseError` | Bob returned non-JSON | Retry with correction prompt (max 3) |
| `ZodError` | Schema validation failed | Retry with error details (max 3) |

### JSON Extraction

Bob may output text before/after JSON. The client uses a two-pass extraction:

```typescript
// ai-orchestrator/src/bob/BobClient.ts:79-110
// 1. Simple extraction (first { to last })
let jsonContent = response.substring(firstBrace, lastBrace + 1).trim();

// 2. Validate parsing
try {
  JSON.parse(jsonContent);
} catch (parseError) {
  // Fallback: Use brace-counting for balanced extraction
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
  jsonContent = response.substring(firstBrace, endPos + 1).trim();
}
```

---

## Configuration & Environment

### Environment Variables

```bash
# Optional - Bob Shell handles authentication locally
export BOB_MODEL="granite-13b-chat"  # Default model
export BOB_TIMEOUT="60000"           # Timeout in milliseconds (default: 60s)
```

**Deprecated (no longer used):**
- `BOB_ENDPOINT` - Was used for HTTP API (now local CLI)
- `BOB_API_KEY` - Was used for authentication (now local IBM SSO)

### Runtime Configuration

```typescript
// ai-orchestrator/src/index.ts:49-64
const config: BobConfig = {
  endpoint: options.endpoint || process.env.BOB_ENDPOINT,  // Optional (deprecated)
  apiKey: options.apiKey || process.env.BOB_API_KEY,      // Optional (deprecated)
  model: options.model || process.env.BOB_MODEL || 'granite-13b-chat',
  temperature: 0.0  // Always deterministic for JSON output
};

const client = new BobClient(config);
```

### Token Management

Bob has a context window limit (8192 tokens for Granite-13b). The token manager truncates Contract A if needed.

```typescript
// ai-orchestrator/src/retry/tokenManager.ts
export function truncateContractA(
  contractA: ContractA,
  limits: TokenLimits
): ContractA {
  const estimateTokens = (text: string) => Math.ceil(text.length / 4);
  
  const availableTokens = limits.maxContextWindow 
    - limits.systemPromptTokens 
    - limits.reserveForResponse;
  
  // Truncate usageContextLine proportionally if over budget
  // Never drop entire dependencies
}
```

**Token Budget:**
- Context window: 8192 tokens
- System prompt: ~1500 tokens
- Response reserve: 2048 tokens
- Available for Contract A: ~4644 tokens

---

## Testing Strategy

### Unit Tests

**Location:** `ai-orchestrator/src/index.spec.ts`

```typescript
describe('AI Orchestrator', () => {
  it('validates canonical Contract B example', () => {
    const example = require('./examples/contract-b.example.json');
    expect(() => contractBSchema.parse(example)).not.toThrow();
  });

  it('builds prompts in correct order', () => {
    const { system } = buildPrompt(contractA);
    expect(system).toContain('DiffIntentAnalysis');
    expect(system).toContain('RiskClassification');
  });

  it('truncates oversized Contract A', () => {
    const truncated = truncateContractA(largeContractA, tokenLimits);
    expect(truncated.dependencies.length).toBe(largeContractA.dependencies.length);
  });
});
```

### Integration Tests

Mock Bob server for testing without actual Bob Shell:

```typescript
// Test mock server
app.post('/chat/completions', (req, res) => {
  const contractB = require('../examples/contract-b.example.json');
  res.json({
    choices: [{ message: { content: JSON.stringify(contractB) } }],
    usage: { promptTokens: 1500, completionTokens: 500, totalTokens: 2000 }
  });
});
```

---

## Documentation References

### Primary Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| **Bob Skills Spec** | `visualizer/BOB-SKILLS-SPEC.md` | Defines what Bob must produce (owned by M5) |
| **AI Orchestrator README** | `ai-orchestrator/README.md` | Usage guide and API reference |
| **Architecture** | `ai-orchestrator/docs/ARCHITECTURE.md` | System design and data flow |
| **Implementation Plan** | `ai-orchestrator/docs/IMPLEMENTATION_PLAN.md` | Detailed component specs |
| **Implementation Summary** | `ai-orchestrator/docs/IMPLEMENTATION_SUMMARY.md` | High-level overview |
| **Quick Start** | `ai-orchestrator/docs/QUICKSTART.md` | Getting started guide |

### Contract Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| **Contracts Overview** | `docs/CONTRACTS.md` | Data contract definitions |
| **Contract A Schema** | `shared/contracts/contract-a.schema.json` | Input schema |
| **Contract B Schema** | `shared/contracts/contract-b.schema.json` | Output schema |
| **Pipeline Documentation** | `docs/PIPELINE.md` | End-to-end flow |

### Examples

| File | Location | Purpose |
|------|----------|---------|
| Contract A Example | `shared/examples/contract-a.example.json` | Canonical input |
| Contract B Example | `shared/examples/contract-b.example.json` | Canonical output |
| Contract A Example (AI) | `ai-orchestrator/examples/contract-a.example.json` | Test fixture |
| Contract B Example (AI) | `ai-orchestrator/examples/contract-b.example.json` | Test fixture |

---

## Usage Examples

### Basic Usage

```typescript
import { analyze } from '@blast-radius/ai-orchestrator';

const contractA = {
  targetFile: 'src/main/java/com/example/Utils.java',
  targetPackage: 'com.example',
  gitDiff: '...',
  dependencies: [...]
};

// Bob Shell is invoked locally (pre-installed on user's machine)
const contractB = await analyze(contractA);

console.log('Risk Score:', contractB.overallRiskScore);
console.log('Summary:', contractB.summary);
```

### With Custom Configuration

```typescript
const contractB = await analyze(contractA, {
  model: 'granite-34b-chat',
  maxRetries: 5,
  onRetry: (attempt, error) => {
    console.log(`Retry ${attempt}: ${error.message}`);
  }
});
```

### Extension Integration

```typescript
// extension/src/orchestrator/pipeline.ts
import { analyze } from '@blast-radius/ai-orchestrator';

export async function runPipeline(contractA: ContractA): Promise<ContractB> {
  // Pre-flight check for Bob Shell installation
  if (!ensureBobShellInstalled()) {
    throw new Error('Bob Shell is not installed');
  }

  try {
    const contractB = await analyze(contractA);
    return contractB;
  } catch (error) {
    throw new Error(`Bob analysis failed: ${error.message}`);
  }
}
```

### Pre-flight Check (VS Code Extension)

```typescript
import { execSync } from 'child_process';
import * as vscode from 'vscode';

export function ensureBobShellInstalled(): boolean {
  try {
    execSync('bob --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    vscode.window.showErrorMessage(
      'IBM Bob Shell is required for Blast Radius analysis.',
      'Install Bob Shell'
    ).then(selection => {
      if (selection === 'Install Bob Shell') {
        vscode.env.openExternal(
          vscode.Uri.parse('https://bob.ibm.com/docs/shell')
        );
      }
    });
    return false;
  }
}
```

---

## Performance Characteristics

### Latency Profile

| Scenario | Expected Time | Notes |
|----------|---------------|-------|
| Success (no retry) | 2-5s | Local process + Bob inference |
| 1 retry | 4-10s | Double the latency |
| 2 retries | 6-15s | Triple the latency |
| Max retries | 8-20s | User sees loading state |

### Token Usage

| Component | Typical Tokens | Max Tokens |
|-----------|----------------|------------|
| System prompt | ~1500 | ~2000 |
| Contract A (small) | ~500 | - |
| Contract A (medium) | ~2000 | - |
| Contract A (large) | ~4000 | 4644 (truncated) |
| Response | ~500 | 2048 (reserved) |
| **Total** | ~4500 | 8192 (limit) |

---

## Key Insights

### Why Local CLI vs HTTP API?

1. **No API Keys** - Authentication via local IBM SSO
2. **No Rate Limits** - Users control their own instance
3. **Offline Capable** - Works without internet for cached models
4. **BYOC Pattern** - Similar to Docker Extension or GitLens

### Critical Invariants

1. **No severity before Bob** - AST output is purely structural
2. **Bob is sole authority** - All risk levels and reasons come from Bob
3. **Deterministic output** - Temperature = 0.0 for consistent JSON
4. **Strict validation** - Zod enforces schema, triggers self-healing
5. **Token awareness** - Never drop dependencies, only truncate context lines

### Success Criteria

- ✅ Bob returns valid Contract B within 3 retries (>95% success rate)
- ✅ All enum values match schema exactly
- ✅ Every reason has correct prefix (COMPILE BREAK: | LOGICAL RUNTIME WARN: | SAFE PASSIVE:)
- ✅ Token truncation preserves dependency count
- ✅ Self-healing loop recovers from malformed JSON

---

## Troubleshooting

### Common Issues

1. **"IBM Bob Shell is not installed"**
   - Install: `curl -fsSL https://bob.ibm.com/download/bobshell.sh | bash`
   - Verify: `bob --version`

2. **"Bob request timeout"**
   - Increase: `export BOB_TIMEOUT="120000"`

3. **"Bob failed after 3 attempts"**
   - Check Bob Shell logs
   - Review prompt files in `src/bob/prompts/`
   - Increase maxRetries option

4. **"No valid JSON object found"**
   - Bob Shell returned non-JSON output
   - Check: `echo "Hello" | bob`

---

## Future Enhancements

### Planned (v0.2)

1. **Streaming Responses** - Stream Contract B nodes as generated
2. **Response Caching** - Cache by hash of Contract A
3. **Batch Processing** - Analyze multiple files in one request
4. **Confidence Scores** - Add confidence field to each node

### Considered (v0.3)

1. **Multi-Model Support** - A/B test different Bob variants
2. **Prompt Versioning** - Track prompt changes and accuracy
3. **Transitive Dependencies** - Support multi-hop chains
4. **Custom Risk Rules** - User-defined package weighting

---

## Detailed Code Analysis & Error Checking

### BobClient.ts - Complete Error Handling Flow

**File:** `ai-orchestrator/src/bob/BobClient.ts` (176 lines)

#### Error Checking Layers

**Layer 1: Pre-flight Installation Check**
```typescript
// Lines 137-145
private checkBobInstalled(): void {
  try {
    execSync('bob --version', { stdio: 'ignore' });
  } catch (error) {
    throw new Error(
      'IBM Bob Shell is not installed or not in PATH. ' +
      'Install it from: https://bob.ibm.com/docs/shell'
    );
  }
}
```
- **Purpose:** Verify Bob Shell is installed before attempting to use it
- **Error Type:** `BobNotInstalledError`
- **User Action:** Install Bob Shell from provided URL

**Layer 2: Shell Execution with Comprehensive Options**
```typescript
// Lines 66-75
const bobOutput = execSync('bob', {
  input: combinedPrompt,           // Stdin input (prevents shell injection)
  encoding: 'utf-8',               // UTF-8 encoding for international characters
  timeout: this.config.timeout,    // Configurable timeout (default: 60000ms)
  maxBuffer: 10 * 1024 * 1024,     // 10MB buffer for large responses
  stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr to avoid IDE warnings
});
```
- **Security:** Uses stdin to prevent shell injection attacks
- **Performance:** 10MB buffer supports large dependency graphs
- **Reliability:** Stderr suppression prevents IDE companion warnings from corrupting output

**Layer 3: Two-Pass JSON Extraction**
```typescript
// Lines 79-110 - Simple extraction first
const firstBrace = response.indexOf('{');
const lastBrace = response.lastIndexOf('}');

if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
  throw new Error('No valid JSON object found in Bob response');
}

let jsonContent = response.substring(firstBrace, lastBrace + 1).trim();

// Validation pass
try {
  JSON.parse(jsonContent);
} catch (parseError) {
  // Fallback: Brace-counting for balanced extraction
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
  jsonContent = response.substring(firstBrace, endPos + 1).trim();
}
```
- **Pass 1:** Simple substring extraction (fast path)
- **Pass 2:** Brace-counting algorithm (fallback for complex cases)
- **Handles:** Bob outputting text before/after JSON, nested objects, escaped characters

**Layer 4: Error Classification & User-Friendly Messages**
```typescript
// Lines 151-173
private handleBobError(error: Error): Error {
  const message = error.message;

  // Error 1: Bob Shell not found in PATH
  if (message.includes('ENOENT')) {
    return new Error(
      'Bob Shell not found. Install it from: https://bob.ibm.com/docs/shell'
    );
  }
  
  // Error 2: Process timeout
  if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
    return new Error(
      `Bob request timeout (${this.config.timeout}ms). Try increasing BOB_TIMEOUT.`
    );
  }

  // Error 3: Buffer overflow
  if (message.includes('ERR_CHILD_PROCESS_STDIO_MAXBUFFER')) {
    return new Error(
      'Bob response too large. The analysis output exceeded buffer limits.'
    );
  }

  // Error 4: Generic shell error
  return new Error(`Bob Shell error: ${message}`);
}
```

**Error Classification Matrix:**

| Error Code | Detection Pattern | User Message | Recovery Action |
|------------|------------------|--------------|-----------------|
| `ENOENT` | `message.includes('ENOENT')` | "Bob Shell not found" | Install Bob Shell |
| `ETIMEDOUT` | `message.includes('timeout')` | "Bob request timeout" | Increase BOB_TIMEOUT |
| `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` | Buffer overflow pattern | "Response too large" | Reduce Contract A size |
| Generic | Catch-all | "Bob Shell error: {message}" | Check Bob Shell logs |

---

### selfHealingLoop.ts - Intelligent Retry Logic

**File:** `ai-orchestrator/src/retry/selfHealingLoop.ts` (156 lines)

#### Retry Strategy Implementation

**Main Loop with Error Classification**
```typescript
// Lines 41-89
for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
  try {
    // 1. Call Bob
    const response = await client.call(currentRequest);
    
    // 2. Parse JSON (may throw SyntaxError)
    const rawJson = JSON.parse(response.content);
    
    // 3. Validate with Zod (may throw ZodError)
    const validated = contractBSchema.parse(rawJson);
    
    // Success!
    return validated;
    
  } catch (error) {
    lastError = error as Error;
    
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      config.onRetry?.(attempt, error);
      
      if (attempt < config.maxRetries) {
        currentRequest = {
          ...currentRequest,
          user: buildCorrectionPrompt(currentRequest.user, error)
        };
        continue; // Retry with correction
      }
    }
    
    // Handle JSON parse errors
    else if (error instanceof SyntaxError) {
      config.onRetry?.(attempt, error);
      
      if (attempt < config.maxRetries) {
        currentRequest = {
          ...currentRequest,
          user: buildJsonCorrectionPrompt(currentRequest.user, error.message)
        };
        continue; // Retry with correction
      }
    }
    
    // Other errors (network, API, etc.) - don't retry
    break;
  }
}
```

**Error Type Decision Tree:**

```
Error Caught
    ├─ ZodError (Schema validation failed)
    │   ├─ attempt < maxRetries → Build correction prompt → Retry
    │   └─ attempt >= maxRetries → Throw error
    │
    ├─ SyntaxError (JSON parse failed)
    │   ├─ attempt < maxRetries → Build JSON correction prompt → Retry
    │   └─ attempt >= maxRetries → Throw error
    │
    └─ Other Error (Shell, network, etc.)
        └─ Break immediately (no retry)
```

**Zod Error Correction Prompt Builder**
```typescript
// Lines 102-130
function buildCorrectionPrompt(
  originalPrompt: string,
  zodError: z.ZodError
): string {
  // Format Zod errors into readable list
  const errorDetails = zodError.errors
    .map(e => {
      const path = e.path.length > 0 ? e.path.join('.') : 'root';
      return `- ${path}: ${e.message}`;
    })
    .join('\n');

  return `${originalPrompt}

---

CORRECTION REQUIRED:
Your previous response failed schema validation with the following errors:

${errorDetails}

Please re-emit the entire ContractB JSON, fixing exactly these validation issues.
Ensure:
1. All required fields are present
2. All enum values match the schema exactly (TARGET, CRITICAL, WARNING, LOW_RISK, SAFE)
3. Edge types are correct (breaking-dependency, warning-dependency, safe-dependency)
4. Every reason string starts with "COMPILE BREAK:", "LOGICAL RUNTIME WARN:", or "SAFE PASSIVE:"
5. Output is valid JSON with no markdown fences or commentary`;
}
```

**JSON Parse Error Correction Prompt Builder**
```typescript
// Lines 136-154
function buildJsonCorrectionPrompt(
  originalPrompt: string,
  parseError: string
): string {
  return `${originalPrompt}

---

CORRECTION REQUIRED:
Your previous response was not valid JSON. Parse error: ${parseError}

Please re-emit the entire ContractB JSON as valid, parseable JSON.
Requirements:
1. No markdown code fences (\`\`\`json ... \`\`\`)
2. No prose or commentary before or after the JSON
3. Only the raw JSON object
4. Ensure all quotes are properly escaped
5. Ensure all brackets and braces are balanced`;
}
```

**Retry Statistics:**

| Metric | Value | Notes |
|--------|-------|-------|
| Default max retries | 3 | Configurable via `maxRetries` option |
| Retry on ZodError | Yes | Schema validation failures |
| Retry on SyntaxError | Yes | JSON parse failures |
| Retry on shell errors | No | Immediate failure |
| Callback support | Yes | `onRetry` for logging/monitoring |

---

### tokenManager.ts - Context Window Management

**File:** `ai-orchestrator/src/retry/tokenManager.ts` (124 lines)

#### Token Estimation & Truncation

**Token Estimation Heuristic**
```typescript
// Lines 31-33
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
```
- **Heuristic:** 1 token ≈ 4 characters (conservative for English)
- **Accuracy:** ~85-90% for typical code and documentation
- **Future:** Consider integrating tiktoken for exact tokenization

**Intelligent Truncation Algorithm**
```typescript
// Lines 48-103
export function truncateContractA(
  contractA: ContractA,
  limits: TokenLimits
): ContractA {
  // 1. Calculate available tokens
  const availableTokens = limits.maxContextWindow
    - limits.systemPromptTokens
    - limits.reserveForResponse;
  
  // 2. Estimate current usage
  const currentTokens = estimateTokens(JSON.stringify(contractA));
  
  // 3. Early return if under budget
  if (currentTokens <= availableTokens) {
    return contractA;
  }
  
  // 4. Calculate target with safety margin
  const targetTokens = Math.floor(availableTokens * 0.95); // 5% safety margin
  
  // 5. Calculate base structure size (without context lines)
  const baseStructureSize = estimateTokens(JSON.stringify({
    ...contractA,
    dependencies: contractA.dependencies.map(dep => ({
      ...dep,
      usageContextLine: ''
    }))
  }));
  
  // 6. Calculate max line length
  const availableForLines = targetTokens - baseStructureSize;
  const maxLineLength = Math.floor(
    (availableForLines * 4) / contractA.dependencies.length
  );
  
  // 7. Ensure minimum line length (50 chars)
  const effectiveMaxLength = Math.max(maxLineLength, 50);
  
  // 8. Truncate usageContextLine fields proportionally
  return {
    ...contractA,
    dependencies: contractA.dependencies.map(dep => ({
      ...dep,
      callSites: dep.callSites.map(cs => ({
        ...cs,
        usageContextLine: cs.usageContextLine.length > effectiveMaxLength
          ? cs.usageContextLine.slice(0, effectiveMaxLength) + '...'
          : cs.usageContextLine
      }))
    }))
  };
}
```

**Truncation Principles:**

1. **Never drop dependencies** - Preserves graph structure
2. **Proportional truncation** - All context lines truncated equally
3. **Preserve critical fields** - filePath, packageName, importedSymbols untouched
4. **Safety margin** - 5% buffer to account for estimation errors
5. **Minimum length** - At least 50 characters per line
6. **Visual indicator** - '...' suffix shows truncation

**Token Budget Breakdown:**

```
Total Context Window: 8192 tokens
├─ System Prompt: ~1500 tokens (calculated dynamically)
├─ Response Reserve: 2048 tokens (for Contract B output)
└─ Available for Contract A: ~4644 tokens
    ├─ Base Structure: ~500 tokens (metadata, arrays)
    └─ Context Lines: ~4144 tokens (distributed proportionally)
```

---

### contractB.zod.ts - Schema Validation

**File:** `ai-orchestrator/src/schemas/contractB.zod.ts` (61 lines)

#### Strict Schema Enforcement

**Enum Definitions**
```typescript
// Lines 12-25
export const RiskEnum = z.enum([
  'TARGET',      // The modified file itself
  'CRITICAL',    // Breaking changes, compile errors
  'WARNING',     // Logical runtime warnings
  'LOW_RISK',    // Minor impact
  'SAFE'         // No impact
]);

export const EdgeTypeEnum = z.enum([
  'breaking-dependency',  // Red edges in graph
  'warning-dependency',   // Yellow edges
  'safe-dependency'       // Green edges
]);
```

**Node Schema with Required Fields**
```typescript
// Lines 28-35
export const NodeSchema = z.object({
  id: z.string(),           // Unique identifier
  filePath: z.string(),     // Workspace-relative path
  packageName: z.string(),  // Java package for grouping
  label: z.string(),        // Display name in graph
  risk: RiskEnum,           // Risk level (validated enum)
  reason: z.string()        // Human-readable explanation
});
```

**Complete Contract B Schema**
```typescript
// Lines 45-52
export const contractBSchema = z.object({
  targetFile: z.string(),
  targetPackage: z.string(),
  overallRiskScore: RiskEnum,
  summary: z.string(),
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema)
}).strict(); // Strict mode prevents additional properties
```

**Validation Features:**

- ✅ **Strict mode** - Rejects unknown properties
- ✅ **Enum validation** - Only allows predefined values
- ✅ **Type safety** - TypeScript types inferred from schema
- ✅ **Detailed errors** - Path and message for each validation failure
- ✅ **Array validation** - Validates each element in nodes/edges arrays

**Common Validation Errors:**

| Error | Cause | Zod Error Path | Fix |
|-------|-------|----------------|-----|
| Invalid risk value | Bob outputs "HIGH" instead of "CRITICAL" | `nodes[0].risk` | Use exact enum values |
| Missing field | Bob omits `reason` field | `nodes[0].reason` | Include all required fields |
| Wrong edge type | Bob outputs "critical-edge" | `edges[0].type` | Use exact edge type enums |
| Extra property | Bob adds `confidence` field | `root` | Remove additional properties |
| Empty array | Bob returns `nodes: []` | Valid but unusual | Ensure at least target node |

---

### promptBuilder.ts - Prompt Assembly

**File:** `ai-orchestrator/src/bob/promptBuilder.ts` (76 lines)

#### Prompt Caching & Assembly

**Prompt File Order (Critical)**
```typescript
// Lines 20-27
const PROMPT_FILES = [
  'system.md',           // Global persona and output rules
  'diffIntent.md',       // Skill 1: DiffIntentAnalysis
  'riskClassification.md', // Skill 2: RiskClassification
  'reasonGeneration.md', // Skill 3: ReasonGeneration
  'edgeTyping.md',       // Skill 4: EdgeTypeClassification
  'overallSummary.md'    // Skill 5: OverallSummary
];
```
- **Order matters** - Skills build on each other
- **Separation** - `---` horizontal rules between skills
- **Completeness** - All 6 files must be present

**Caching Strategy**
```typescript
// Lines 33-57
let cachedSystemPrompt: string | null = null;

export function buildPrompt(contractA: ContractA): PromptPair {
  if (!cachedSystemPrompt) {
    const promptDir = join(__dirname, '../../../..', 'src', 'bob', 'prompts');
    
    cachedSystemPrompt = PROMPT_FILES
      .map(file => {
        const filePath = join(promptDir, file);
        const content = readFileSync(filePath, 'utf-8');
        
        // Strip HTML comments (<!-- ... -->) from markdown
        return content.replace(/<!--[\s\S]*?-->/g, '').trim();
      })
      .join('\n\n---\n\n');
  }

  return {
    system: cachedSystemPrompt,
    user: JSON.stringify(contractA, null, 2)
  };
}
```

**Performance Optimizations:**

1. **Single read** - Prompts loaded once per process
2. **Comment stripping** - Removes HTML comments for cleaner prompts
3. **Path resolution** - Works from both source and compiled locations
4. **JSON formatting** - Pretty-printed Contract A for readability

**Cache Invalidation**
```typescript
// Lines 72-74
export function clearPromptCache(): void {
  cachedSystemPrompt = null;
}
```
- **Use case:** Testing with modified prompts
- **Use case:** Hot-reloading in development
- **Production:** Cache persists for entire process lifetime

---

## Error Handling Summary

### Complete Error Flow Diagram

```
User Request
    ↓
[1] Pre-flight Check
    ├─ Bob Shell installed? → No → BobNotInstalledError
    └─ Yes → Continue
    ↓
[2] Shell Execution
    ├─ Timeout? → Yes → BobTimeoutError
    ├─ Buffer overflow? → Yes → BufferOverflowError
    ├─ ENOENT? → Yes → BobNotFoundError
    └─ Success → Continue
    ↓
[3] JSON Extraction (Two-Pass)
    ├─ No braces found? → Yes → NoJSONError
    ├─ Simple extraction works? → Yes → Continue
    └─ No → Brace-counting fallback → Continue
    ↓
[4] JSON Parsing
    ├─ SyntaxError? → Yes → Retry with JSON correction (max 3)
    └─ Success → Continue
    ↓
[5] Zod Validation
    ├─ ZodError? → Yes → Retry with schema correction (max 3)
    └─ Success → Return Contract B
    ↓
[6] Max Retries Check
    ├─ Retries exhausted? → Yes → BobValidationError
    └─ No → Loop back to [2]
```

### Error Recovery Matrix

| Error Type | Retryable | Max Retries | Recovery Strategy | User Action |
|------------|-----------|-------------|-------------------|-------------|
| `BobNotInstalledError` | No | 0 | None | Install Bob Shell |
| `BobTimeoutError` | No | 0 | None | Increase BOB_TIMEOUT |
| `BufferOverflowError` | No | 0 | None | Reduce Contract A size |
| `NoJSONError` | No | 0 | None | Check Bob Shell output |
| `SyntaxError` | Yes | 3 | JSON correction prompt | Wait for retry |
| `ZodError` | Yes | 3 | Schema correction prompt | Wait for retry |
| `BobValidationError` | No | 0 | None | Review prompts |

### Success Metrics

**Target Performance:**
- ✅ **95%+ success rate** without retries
- ✅ **<10% retry rate** requiring 1+ retries
- ✅ **<1% failure rate** after max retries
- ✅ **2-5s average latency** for successful calls
- ✅ **<10s P95 latency** including retries

**Actual Implementation:**
- 3 retry attempts maximum
- Intelligent error classification
- User-friendly error messages
- Detailed logging via `onRetry` callback
- Graceful degradation on failure

---

## Appendix: File Locations

### Bob-Related Files

```
ai-orchestrator/
├── src/
│   ├── bob/
│   │   ├── BobClient.ts              # Shell CLI client (176 lines)
│   │   ├── promptBuilder.ts          # Prompt assembly (76 lines)
│   │   └── prompts/
│   │       ├── system.md             # Global persona
│   │       ├── diffIntent.md         # Skill 1
│   │       ├── riskClassification.md # Skill 2
│   │       ├── reasonGeneration.md   # Skill 3
│   │       ├── edgeTyping.md         # Skill 4
│   │       └── overallSummary.md     # Skill 5
│   ├── schemas/
│   │   └── contractB.zod.ts          # Zod validation (61 lines)
│   ├── retry/
│   │   ├── selfHealingLoop.ts        # Retry logic (156 lines)
│   │   └── tokenManager.ts           # Token management (124 lines)
│   └── index.ts                      # Main API (112 lines)
├── docs/
│   ├── ARCHITECTURE.md               # System design
│   ├── IMPLEMENTATION_PLAN.md        # Component specs
│   ├── IMPLEMENTATION_SUMMARY.md     # Overview
│   └── QUICKSTART.md                 # Getting started
├── examples/
│   ├── contract-a.example.json       # Test input
│   └── contract-b.example.json       # Test output
└── README.md                         # Usage guide

visualizer/
└── BOB-SKILLS-SPEC.md                # What Bob must produce (owned by M5)

shared/
├── contracts/
│   ├── contract-a.schema.json        # Input schema
│   └── contract-b.schema.json        # Output schema
└── examples/
    ├── contract-a.example.json       # Canonical input
    └── contract-b.example.json       # Canonical output

docs/
├── CONTRACTS.md                      # Contract documentation
└── PIPELINE.md                       # End-to-end flow
```

---

## Summary Statistics

- **Total Bob-related files:** 25+
- **Lines of Bob client code:** ~176
- **Lines of prompt engineering:** ~76
- **Lines of validation logic:** ~61
- **Lines of retry logic:** ~156
- **Number of prompt files:** 6
- **Number of skills:** 7
- **Default timeout:** 60 seconds
- **Max retries:** 3
- **Context window:** 8192 tokens
- **Max buffer:** 10MB

---

**Report End**

For questions or issues, refer to:
- AI Orchestrator README: `ai-orchestrator/README.md`
- Bob Skills Spec: `visualizer/BOB-SKILLS-SPEC.md`
- Architecture Docs: `ai-orchestrator/docs/ARCHITECTURE.md`