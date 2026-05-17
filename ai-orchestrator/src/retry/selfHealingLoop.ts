import { z } from 'zod';
import { BobClient, BobRequest } from '../bob/BobClient';
import { contractBSchema } from '../schemas/contractB.zod';
import type { ContractB } from '../schemas/contractB.zod';

/**
 * Self-healing retry loop for IBM Bob.
 * Catches validation errors and retries with error feedback to guide Bob's correction.
 */

export interface RetryConfig {
  maxRetries: number;
  onRetry?: (attempt: number, error: z.ZodError | SyntaxError) => void;
}

/**
 * Call Bob with automatic retry on validation failure.
 * 
 * Strategy:
 * 1. Call Bob with original prompt
 * 2. Parse JSON response
 * 3. Validate with Zod schema
 * 4. On failure, append error details to prompt and retry
 * 5. Repeat up to maxRetries
 * 6. Throw after exhaustion
 * 
 * @param client - The Bob client instance
 * @param request - The initial request with system and user prompts
 * @param config - Retry configuration
 * @returns Validated Contract B
 * @throws Error after max retries exhausted
 */
export async function callWithRetry(
  client: BobClient,
  request: BobRequest,
  config: RetryConfig = { maxRetries: 3 }
): Promise<ContractB> {
  let lastError: Error | null = null;
  let currentRequest = request;

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
          // Build correction prompt with validation error details
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
          // Build correction prompt for JSON syntax
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

  // Max retries exhausted or non-retryable error
  throw new Error(
    `Bob failed to produce valid Contract B after ${config.maxRetries} attempts. ` +
    `Last error: ${lastError?.message}`
  );
}

/**
 * Build a correction prompt for Zod validation errors.
 * Appends detailed error information to guide Bob's correction.
 */
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

/**
 * Build a correction prompt for JSON parse errors.
 * Guides Bob to output clean JSON without markdown or prose.
 */
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

// Made with Bob
