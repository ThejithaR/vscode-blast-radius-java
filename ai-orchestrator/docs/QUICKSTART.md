# Quick Start Guide - IBM Bob AI Orchestrator

## Prerequisites

- Node.js 20+ installed
- **IBM Bob Shell installed locally** (see installation below)
- Git repository cloned

## Bob Shell Installation

**Required:** Bob Shell must be installed on your system before using the AI Orchestrator.

```bash
# Install Bob Shell (one-time setup)
curl -fsSL https://bob.ibm.com/download/bobshell.sh | bash

# Accept license
bob --accept-license

# Verify installation
bob --version
```

**Authentication:** Bob Shell handles authentication via local IBM SSO - no API keys needed!

## AI Orchestrator Installation

```bash
# Navigate to the ai-orchestrator directory
cd ai-orchestrator

# Install dependencies
npm install

# Build the TypeScript code
npm run build
```

## Configuration

### Optional Environment Variables

```bash
# Optional: Model selection (default: granite-13b-chat)
export BOB_MODEL="granite-13b-chat"

# Optional: Request timeout in milliseconds (default: 60000)
export BOB_TIMEOUT="60000"
```

Or create a `.env` file in the ai-orchestrator directory:

```bash
BOB_MODEL=granite-13b-chat
BOB_TIMEOUT=60000
```

**Note:** `BOB_ENDPOINT` and `BOB_API_KEY` are no longer required. Bob Shell handles authentication locally.

## Usage Examples

### Example 1: Basic Usage

Create a file `test-analyze.js`:

```javascript
// Load environment variables if using .env file
require('dotenv').config();

const { analyze } = require('./dist/src/index.js');

// Example Contract A
const contractA = {
  targetFile: 'src/main/java/com/example/core/security/ValidationUtils.java',
  targetPackage: 'com.example.core.security',
  gitDiff: `@@ -24,8 +24,9 @@
 public class ValidationUtils {
-    public static boolean verifyTokenStructure(String token) {
-        return token != null && token.split("\\.").length == 3;
+    public static boolean verifyTokenStructure(String token, boolean strictMode) {
+        // Strict mode forces signature validation
+        if (strictMode) { return CryptographyEngine.validateSignature(token); }
+        return token != null && token.contains("Bearer ");
     }
 }`,
  dependencies: [
    {
      filePath: 'src/main/java/com/example/api/middleware/JwtAuthFilter.java',
      packageName: 'com.example.api.middleware',
      importedSymbols: ['ValidationUtils'],
      usageContextLine: 'if (!ValidationUtils.verifyTokenStructure(rawToken)) { response.setStatus(401); return; }'
    },
    {
      filePath: 'src/main/java/com/example/api/controllers/InternalBillingController.java',
      packageName: 'com.example.api.controllers',
      importedSymbols: ['ValidationUtils'],
      usageContextLine: 'boolean isValidPartner = ValidationUtils.verifyTokenStructure(header.getAuthToken());'
    }
  ]
};

// Analyze and get Contract B
analyze(contractA)
  .then(contractB => {
    console.log('Analysis complete!');
    console.log('Overall Risk:', contractB.overallRiskScore);
    console.log('Summary:', contractB.summary);
    console.log('Nodes:', contractB.nodes.length);
    console.log('Edges:', contractB.edges.length);
    console.log('\nFull Contract B:');
    console.log(JSON.stringify(contractB, null, 2));
  })
  .catch(error => {
    console.error('Analysis failed:', error.message);
    process.exit(1);
  });
```

Run it:

```bash
node test-analyze.js
```

### Example 2: Using the Canonical Example

```bash
# Use the provided example Contract A
node -e "
const { analyze } = require('./dist/src/index.js');
const contractA = require('./examples/contract-a.example.json');

analyze(contractA)
  .then(contractB => {
    console.log(JSON.stringify(contractB, null, 2));
  })
  .catch(error => {
    console.error('Error:', error.message);
  });
"
```

### Example 3: TypeScript Usage

Create `test-analyze.ts`:

```typescript
import { analyze } from './dist/src/index.js';
import type { ContractA, ContractB } from './dist/src/index.js';

const contractA: ContractA = {
  targetFile: 'src/main/java/com/example/Utils.java',
  targetPackage: 'com.example',
  gitDiff: '...',
  dependencies: []
};

async function main() {
  try {
    const contractB: ContractB = await analyze(contractA);
    console.log('Risk Score:', contractB.overallRiskScore);
    console.log('Summary:', contractB.summary);
  } catch (error) {
    console.error('Failed:', error);
  }
}

main();
```

Run with ts-node:

```bash
npx ts-node test-analyze.ts
```

### Example 4: With Custom Configuration

```javascript
const { analyze } = require('./dist/src/index.js');

const contractA = { /* ... */ };

analyze(contractA, {
  model: 'granite-34b-chat',
  maxRetries: 5,
  onRetry: (attempt, error) => {
    console.log(`Retry attempt ${attempt}: ${error.message}`);
  }
})
  .then(contractB => {
    console.log('Success!', contractB);
  })
  .catch(error => {
    console.error('Failed:', error.message);
  });
```

**Note:** `endpoint` and `apiKey` options are deprecated. Bob Shell handles authentication locally.

## Integration with Extension

The AI Orchestrator is designed to be imported by the extension pipeline:

```typescript
// In extension/src/orchestrator/pipeline.ts
import { analyze } from '@blast-radius/ai-orchestrator';
import type { ContractA, ContractB } from '@blast-radius/ai-orchestrator';

export async function runPipeline(contractA: ContractA): Promise<ContractB> {
  try {
    // Environment variables are automatically read
    const contractB = await analyze(contractA);
    return contractB;
  } catch (error) {
    // Handle error in extension's error boundary
    throw new Error(`Bob analysis failed: ${error.message}`);
  }
}
```

## Testing the Implementation

### 1. Validate Zod Schema

```bash
node -e "
const { contractBSchema } = require('./dist/src/index.js');
const example = require('./examples/contract-b.example.json');

try {
  const validated = contractBSchema.parse(example);
  console.log('✅ Schema validation passed');
  console.log('Risk Score:', validated.overallRiskScore);
} catch (error) {
  console.error('❌ Schema validation failed:', error.message);
}
"
```

### 2. Test Prompt Builder

```bash
node -e "
const { buildPrompt } = require('./dist/src/index.js');
const contractA = require('./examples/contract-a.example.json');

const prompts = buildPrompt(contractA);
console.log('System prompt length:', prompts.system.length);
console.log('User prompt length:', prompts.user.length);
console.log('System prompt includes skills:', 
  prompts.system.includes('DiffIntentAnalysis') &&
  prompts.system.includes('RiskClassification')
);
"
```

### 3. Test Token Manager

```bash
node -e "
const { estimateTokens, truncateContractA } = require('./dist/src/index.js');
const contractA = require('./examples/contract-a.example.json');

const tokens = estimateTokens(JSON.stringify(contractA));
console.log('Estimated tokens:', tokens);

const truncated = truncateContractA(contractA, {
  maxContextWindow: 8192,
  systemPromptTokens: 1500,
  reserveForResponse: 2048
});
console.log('Dependencies preserved:', truncated.dependencies.length);
"
```

## Troubleshooting

### Error: "IBM Bob Shell is not installed or not in PATH"

**Solution:** Install Bob Shell:
```bash
curl -fsSL https://bob.ibm.com/download/bobshell.sh | bash
bob --accept-license
bob --version
```

If installed but not in PATH, add Bob Shell to your PATH:
```bash
export PATH="$PATH:$HOME/.bob/bin"
```

### Error: "Cannot find module"

**Solution:** Make sure you've built the project:
```bash
npm run build
```

### Error: "Bob request timeout"

**Solution:** Increase the timeout:
```bash
export BOB_TIMEOUT="120000"  # 2 minutes
```

Or pass it as an option:
```javascript
analyze(contractA, {
  timeout: 120000
})
```

### Error: "Bob failed after 3 attempts"

**Possible causes:**
1. Bob Shell process error - Check Bob Shell logs
2. Invalid prompt format - Review prompt files
3. Process timeout - Increase BOB_TIMEOUT

**Debug with retry callback:**
```javascript
analyze(contractA, {
  onRetry: (attempt, error) => {
    console.error(`Retry ${attempt}:`, error.message);
  }
})
```

### Error: "No valid JSON object found in Bob response"

**Possible causes:**
1. Bob Shell returned non-JSON output
2. Bob Shell error message mixed with output

**Solution:** Check Bob Shell is working correctly:
```bash
echo "Hello" | bob
```

## Development Workflow

### Watch Mode

For development, use watch mode to automatically rebuild on changes:

```bash
npm run watch
```

### Making Changes

1. Edit source files in `src/`
2. Build: `npm run build`
3. Test your changes with example scripts
4. Commit changes

### Updating Prompts

1. Edit markdown files in `src/bob/prompts/`
2. Rebuild: `npm run build`
3. Test with canonical example
4. Verify output matches expected Contract B structure

## Performance Tips

1. **Cache System Prompt**: The prompt builder automatically caches the system prompt after first use
2. **Reuse BobClient**: Create one client instance and reuse it for multiple analyses
3. **Monitor Token Usage**: Use the `onRetry` callback to track token consumption
4. **Batch Requests**: If analyzing multiple files, consider batching (future enhancement)

## Next Steps

1. ✅ Set up environment variables
2. ✅ Build the project
3. ✅ Test with canonical example
4. ✅ Integrate with extension pipeline
5. ✅ Monitor performance and success rate

## Support

- **Documentation**: See [README.md](./README.md) for detailed API reference
- **Architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- **Implementation**: See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for component specs

## Example Output

When successful, you'll see output like:

```json
{
  "targetFile": "src/main/java/com/example/core/security/ValidationUtils.java",
  "targetPackage": "com.example.core.security",
  "overallRiskScore": "CRITICAL",
  "summary": "The addition of a mandatory 'strictMode' boolean parameter to verifyTokenStructure() creates breaking compile-time errors in 2 downstream files. Urgent refactoring required.",
  "nodes": [
    {
      "id": "node_target",
      "filePath": "src/main/java/com/example/core/security/ValidationUtils.java",
      "packageName": "com.example.core.security",
      "label": "ValidationUtils.java (Modified)",
      "risk": "TARGET",
      "reason": "Origin of the breaking signature change."
    },
    {
      "id": "node_filter",
      "filePath": "src/main/java/com/example/api/middleware/JwtAuthFilter.java",
      "packageName": "com.example.api.middleware",
      "label": "JwtAuthFilter.java",
      "risk": "CRITICAL",
      "reason": "COMPILE BREAK: The method call verifyTokenStructure(rawToken) is missing the new mandatory 'strictMode' parameter."
    }
  ],
  "edges": [
    {
      "from": "node_target",
      "to": "node_filter",
      "type": "breaking-dependency"
    }
  ]
}