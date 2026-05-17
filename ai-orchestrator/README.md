# ai-orchestrator — IBM Bob Shell Client & Payload Manager

## Mission

Integrate with IBM Bob Shell (local CLI). Convert `ContractA` into a system prompt, get a response, validate it against the Zod schema for `ContractB`, retry with error context if Bob hallucinates the format. Bob Shell must be installed locally on the user's machine ("Bring Your Own CLI" pattern).

## Owner

**Member 4.**

> **Critical**: All severity, reasoning, and edge typing is produced by this component (via Bob). The AST engine emits no severity. The contract describing what Bob must produce is **owned by Member 5** in [visualizer/BOB-SKILLS-SPEC.md](../visualizer/BOB-SKILLS-SPEC.md). M4 implements; M5 specifies.

## Tech Stack

- TypeScript 5.x
- Node.js `child_process.execSync` for Bob Shell CLI
- [Zod](https://zod.dev/) for response validation
- Bob Shell must be installed locally on user's machine
- IBM SSO authentication handled locally (no API keys needed)

## Installation

### Prerequisites

1. **Bob Shell** (local installation required):
```bash
curl -fsSL https://bob.ibm.com/download/bobshell.sh | bash
bob --accept-license
bob --version  # Verify installation
```

2. **Node.js 22.15+** (Bob Shell requirement)

### Setup

```bash
cd ai-orchestrator
npm install
npm run build
```

## Quick Start

```typescript
import { analyze } from '@blast-radius/ai-orchestrator';
import type { ContractA } from '@blast-radius/shared';

// Prepare Contract A
const contractA: ContractA = {
  targetFile: 'src/main/java/com/example/Utils.java',
  targetPackage: 'com.example',
  gitDiff: '...',
  dependencies: [...]
};

// Analyze and get Contract B
// Bob Shell is invoked locally (pre-installed on user's machine)
const contractB = await analyze(contractA);

console.log(contractB.overallRiskScore); // CRITICAL, WARNING, etc.
console.log(contractB.summary);
console.log(contractB.nodes);
console.log(contractB.edges);
```

## Environment Variables

> **Note**: Bob Shell authentication is handled locally via IBM SSO. No API keys or HTTP endpoints needed.

### Optional

```bash
# Model selection (default: granite-13b-chat)
export BOB_MODEL="granite-13b-chat"

# Request timeout in milliseconds (default: 60000)
export BOB_TIMEOUT="60000"
```

## API Reference

### `analyze(contractA, options?)`

Main entry point for analyzing Contract A and producing Contract B.

**Parameters:**

- `contractA: ContractA` - Input contract with git diff and dependencies
- `options?: AnalyzeOptions` - Optional configuration overrides

**Returns:** `Promise<ContractB>` - Validated Contract B with risk annotations

**Throws:** `Error` if Bob Shell not installed or max retries exhausted

**Example:**

```typescript
const contractB = await analyze(contractA, {
  model: 'granite-34b-chat',
  maxRetries: 5,
  onRetry: (attempt, error) => {
    console.log(`Retry ${attempt}: ${error.message}`);
  }
});
```

### `AnalyzeOptions`

```typescript
interface AnalyzeOptions {
  model?: string;         // Override BOB_MODEL (default: granite-13b-chat)
  maxRetries?: number;    // Override max retries (default: 3)
  onRetry?: (attempt: number, error: Error) => void;  // Retry callback
}
```

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     analyze() Function                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Prompt Builder                          │
│  Concatenates: system.md + diffIntent.md + ...              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Token Manager                           │
│  Truncates usageContextLine if over 8192 token limit        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Self-Healing Loop                         │
│  Retries up to 3 times with error feedback                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Bob Client                             │
│  execSync('bob') - Local CLI invocation                     │
│  (Bob Shell must be installed on user's machine)            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Zod Validator                           │
│  Validates response against Contract B schema               │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Input**: Contract A (git diff + dependencies)
2. **Prompt Building**: Concatenate skill prompts + serialize Contract A
3. **Token Management**: Truncate if over budget (8192 tokens)
4. **Bob Call**: HTTP POST with system + user messages
5. **Validation**: Parse JSON and validate with Zod
6. **Retry**: On failure, append error details and retry (max 3)
7. **Output**: Validated Contract B

## Bob's Skills

The seven skills Bob must perform are spec'd in [visualizer/BOB-SKILLS-SPEC.md](../visualizer/BOB-SKILLS-SPEC.md). Implementation lives under [src/bob/prompts/](./src/bob/prompts/):

| Skill | Prompt File | Output |
|-------|-------------|--------|
| System Persona | `system.md` | Global rules and output format |
| DiffIntentAnalysis | `diffIntent.md` | Categorize change type |
| RiskClassification | `riskClassification.md` | Assign risk levels to nodes |
| ReasonGeneration | `reasonGeneration.md` | Generate human-readable reasons |
| EdgeTypeClassification | `edgeTyping.md` | Type edges based on risk |
| OverallSummary | `overallSummary.md` | Compute overall score and summary |
| SelfHealingOutput | `selfHealingLoop.ts` | Retry with error feedback |

## Error Handling

### Error Types

| Error | Cause | Recovery |
|-------|-------|----------|
| Bob Shell not installed | `bob` command not found in PATH | Install from https://bob.ibm.com/docs/shell |
| Timeout | Request > configured timeout | Check network or increase BOB_TIMEOUT |
| Validation error | Schema mismatch after max retries | Check Bob output format |
| JSON parse error | Bob returned non-JSON or extra text | Retry with correction prompt |
| Shell error | Unexpected Bob Shell CLI error | Check Bob Shell logs and version |

### Retry Strategy

- **Attempt 1**: Original prompt
- **Attempt 2+**: Original prompt + validation error details
- **Max retries**: 3 (configurable)
- **Retry on**: ZodError, SyntaxError
- **No retry on**: Network errors, authentication errors

## Token Management

### Token Budget

| Component | Tokens | Notes |
|-----------|--------|-------|
| Context window | 8192 | Granite-13b limit |
| System prompt | ~1500 | Calculated dynamically |
| Response reserve | 2048 | For Contract B output |
| **Available for Contract A** | **~4644** | Remaining budget |

### Truncation Strategy

When Contract A exceeds the token budget:

1. **Never drop dependencies** - Preserves graph structure
2. **Truncate `usageContextLine`** - Proportionally across all dependencies
3. **Preserve critical fields** - `filePath`, `packageName`, `importedSymbols`
4. **Add `...` suffix** - Indicates truncation

## Testing

### Unit Tests

```bash
npm test
```

Tests cover:
- ✅ Zod schema validates canonical example
- ✅ Zod schema rejects invalid enums
- ✅ Prompt builder concatenates in correct order
- ✅ Token manager truncates oversized inputs
- ✅ Self-healing loop retries on validation error

### Integration Tests

Mock Bob server for local testing:

```typescript
import express from 'express';

const app = express();
app.use(express.json());

app.post('/chat/completions', (req, res) => {
  const contractB = require('./examples/contract-b.example.json');
  res.json({
    choices: [{ message: { content: JSON.stringify(contractB) } }],
    usage: { promptTokens: 1500, completionTokens: 500, totalTokens: 2000 }
  });
});

app.listen(8080);
```

Then test with:

```bash
BOB_ENDPOINT=http://localhost:8080 npm test
```

## Performance

### Latency

| Scenario | Expected Time |
|----------|---------------|
| Success (no retry) | 2-5s |
| 1 retry | 4-10s |
| 2 retries | 6-15s |
| Max retries | 8-20s |

### Success Rate

- **Target**: >95% success without retry
- **Retry rate**: <10% requiring 1+ retries
- **Failure rate**: <1% after max retries

## Troubleshooting

### "IBM Bob Shell is not installed"

**Cause**: Bob Shell command not found in PATH.

**Solution**:
```bash
curl -fsSL https://bob.ibm.com/download/bobshell.sh | bash
bob --accept-license
bob --version  # Verify
```

### "Node.js version 22.15 or higher is required"

**Cause**: Bob Shell requires Node.js 22.15+.

**Solution**:
```bash
node --version  # Check current version
nvm install 22  # Use nvm to install Node.js 22
nvm use 22
```

### "Bob failed after 3 attempts"

**Cause**: Bob consistently returns invalid JSON or schema violations.

**Solution**:
1. Verify Bob Shell is installed and working: `bob --version`
2. Review prompt files for clarity in `src/bob/prompts/`
3. Increase `maxRetries` option
4. Enable retry callback to see error details:

```typescript
await analyze(contractA, {
  onRetry: (attempt, error) => {
    console.error(`Retry ${attempt}:`, error.message);
  }
});
```

### "Bob request timeout"

**Cause**: Request took longer than default 60 seconds.

**Solution**:
```bash
export BOB_TIMEOUT="120000"  # 2 minutes
```

## Advanced Usage

### Custom Retry Logic

```typescript
import { BobClient, buildPrompt, callWithRetry } from '@blast-radius/ai-orchestrator';

const client = new BobClient({
  model: 'granite-13b-chat'
});

const prompts = buildPrompt(contractA);

const contractB = await callWithRetry(
  client,
  {
    system: prompts.system,
    user: prompts.user,
    model: 'granite-13b-chat',
    temperature: 0.0
  },
  {
    maxRetries: 5,
    onRetry: (attempt, error) => {
      // Custom logging or metrics
      console.log(`Retry ${attempt}:`, error);
    }
  }
);
```

### Verifying Bob Shell Installation

```typescript
import { execSync } from 'child_process';

function ensureBobShellInstalled(): boolean {
  try {
    execSync('bob --version', { stdio: 'ignore' });
    console.log('✓ Bob Shell is installed');
    return true;
  } catch (error) {
    console.error('✗ Bob Shell is not installed');
    console.error('Install from: https://bob.ibm.com/docs/shell');
    return false;
  }
}
```

## Integration

### With Extension Pipeline

```typescript
// extension/src/orchestrator/pipeline.ts
import { analyze } from '@blast-radius/ai-orchestrator';
import { execSync } from 'child_process';

export function ensureBobShellInstalled(): boolean {
  try {
    execSync('bob --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    // Show user-friendly error and install link
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

export async function runPipeline(contractA: ContractA): Promise<ContractB> {
  // Pre-flight check for Bob Shell installation
  if (!ensureBobShellInstalled()) {
    throw new Error('Bob Shell is not installed');
  }

  try {
    const contractB = await analyze(contractA);
    return contractB;
  } catch (error) {
    // Handle error in extension's error boundary
    throw error;
  }
}
```

## Documentation

- [Implementation Plan](./IMPLEMENTATION_PLAN.md) - Detailed component specifications
- [Architecture](./ARCHITECTURE.md) - System design and data flow
- [Bob Skills Spec](../visualizer/BOB-SKILLS-SPEC.md) - What Bob must produce
- [Contract Documentation](../docs/CONTRACTS.md) - Data contract definitions

## Contributing

When updating prompts:

1. Edit markdown files in `src/bob/prompts/`
2. Clear prompt cache: `clearPromptCache()`
3. Test against canonical fixture
4. Verify all enum values are valid
5. Ensure reasons have correct prefixes

## License

See [LICENSE](../LICENSE) in the root directory.
