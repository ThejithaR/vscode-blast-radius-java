import type { ContractA } from '@blast-radius/shared';
import { BobClient, BobConfig } from './bob/BobClient';
import { buildPrompt } from './bob/promptBuilder';
import { truncateContractA, calculateTokenLimits } from './retry/tokenManager';
import { callWithRetry } from './retry/selfHealingLoop';
import type { ContractB } from './schemas/contractB.zod';

/**
 * IBM Bob AI Orchestrator
 * 
 * Main entry point for analyzing Contract A and producing Contract B.
 * Orchestrates prompt building, token management, Bob API calls, and validation.
 */

export interface AnalyzeOptions {
  endpoint?: string;
  apiKey?: string;
  model?: string;
  maxRetries?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Analyze a Contract A and produce a validated Contract B.
 * 
 * This is the main public API of the AI Orchestrator.
 * 
 * Process:
 * 1. Load configuration from options or environment variables
 * 2. Build system and user prompts
 * 3. Truncate Contract A if needed to fit token budget
 * 4. Call Bob with retry loop
 * 5. Return validated Contract B
 * 
 * @param contractA - Input contract with git diff and dependencies
 * @param options - Optional configuration overrides
 * @returns Validated Contract B with risk annotations
 * @throws Error if Bob endpoint/key missing or max retries exhausted
 * 
 * @example
 * ```typescript
 * const contractB = await analyze(contractA, {
 *   endpoint: 'https://bob.ibm.com/v1',
 *   apiKey: 'your-api-key',
 *   maxRetries: 3
 * });
 * ```
 */
export async function analyze(
  contractA: ContractA,
  options: AnalyzeOptions = {}
): Promise<ContractB> {
  // 1. Load configuration from options or environment
  // Note: For local Bob Shell, endpoint and apiKey are no longer required
  // Bob Shell handles authentication via local IBM SSO
  const config: BobConfig = {
    endpoint: options.endpoint || process.env.BOB_ENDPOINT,  // Optional
    apiKey: options.apiKey || process.env.BOB_API_KEY,      // Optional
    model: options.model || process.env.BOB_MODEL || 'granite-13b-chat',
    temperature: 0.0 // Always deterministic for JSON output
  };

  // Initialize Bob client (will check for Bob Shell installation)
  const client = new BobClient(config);

  // 3. Build prompts from markdown files
  const prompts = buildPrompt(contractA);

  // 4. Calculate token limits based on actual system prompt size
  const tokenLimits = calculateTokenLimits(prompts.system);

  // 5. Truncate Contract A if needed to fit token budget
  const truncatedContractA = truncateContractA(contractA, tokenLimits);

  // 6. Rebuild user prompt with truncated data
  const finalUserPrompt = JSON.stringify(truncatedContractA, null, 2);

  // 7. Call Bob with retry loop
  const contractB = await callWithRetry(
    client,
    {
      system: prompts.system,
      user: finalUserPrompt,
      model: config.model || 'granite-13b-chat',
      temperature: config.temperature ?? 0.0
    },
    {
      maxRetries: options.maxRetries || 3,
      onRetry: options.onRetry
    }
  );

  // 8. Return validated Contract B
  return contractB;
}

// Re-export types for convenience
export type { ContractA } from '@blast-radius/shared';
export type { ContractB, Risk, EdgeType, Node, Edge } from './schemas/contractB.zod';
export { contractBSchema } from './schemas/contractB.zod';

// Re-export components for advanced usage
export { BobClient } from './bob/BobClient';
export type { BobConfig, BobRequest, BobResponse } from './bob/BobClient';
export { buildPrompt, clearPromptCache } from './bob/promptBuilder';
export type { PromptPair } from './bob/promptBuilder';
export { truncateContractA, calculateTokenLimits, estimateTokens } from './retry/tokenManager';
export type { TokenLimits } from './retry/tokenManager';
export { callWithRetry } from './retry/selfHealingLoop';
export type { RetryConfig } from './retry/selfHealingLoop';

// Made with Bob
