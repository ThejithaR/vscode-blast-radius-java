import type { ContractA } from '@blast-radius/shared';

/**
 * Token manager for context window management.
 * Ensures the total prompt size stays under the model's context window
 * by truncating usageContextLine fields when necessary.
 */

export interface TokenLimits {
  maxContextWindow: number;    // e.g., 8192 for Granite-13b
  systemPromptTokens: number;  // Estimated from prompt builder
  reserveForResponse: number;  // e.g., 2048 tokens for Contract B
}

/**
 * Default token limits for Granite-13b-chat model.
 */
export const DEFAULT_TOKEN_LIMITS: TokenLimits = {
  maxContextWindow: 8192,
  systemPromptTokens: 1500,  // Will be calculated dynamically
  reserveForResponse: 2048
};

/**
 * Estimate token count from text.
 * Uses a simple heuristic: 1 token ≈ 4 characters.
 * This is conservative for English text.
 * 
 * For production, consider using a proper tokenizer like tiktoken.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Truncate Contract A to fit within token budget.
 * 
 * Strategy:
 * - Never drop entire dependencies (preserves graph structure)
 * - Truncate usageContextLine proportionally across all dependencies
 * - Preserve filePath, packageName, importedSymbols (critical for risk classification)
 * - Add '...' suffix to indicate truncation
 * 
 * @param contractA - The input contract to potentially truncate
 * @param limits - Token budget limits
 * @returns Truncated contract that fits within budget
 */
export function truncateContractA(
  contractA: ContractA,
  limits: TokenLimits
): ContractA {
  // Calculate available tokens for Contract A (user message)
  const availableTokens = limits.maxContextWindow 
    - limits.systemPromptTokens 
    - limits.reserveForResponse;
  
  // Estimate current token usage
  const currentTokens = estimateTokens(JSON.stringify(contractA));
  
  // If under budget, return as-is
  if (currentTokens <= availableTokens) {
    return contractA;
  }
  
  // Calculate how much we need to reduce
  const targetTokens = Math.floor(availableTokens * 0.95); // 5% safety margin
  
  // If no dependencies, we can't truncate further
  if (contractA.dependencies.length === 0) {
    return contractA;
  }
  
  // Calculate target size for each usageContextLine
  // We'll truncate all lines proportionally
  const baseStructureSize = estimateTokens(JSON.stringify({
    ...contractA,
    dependencies: contractA.dependencies.map(dep => ({
      ...dep,
      usageContextLine: ''
    }))
  }));
  
  const availableForLines = targetTokens - baseStructureSize;
  const maxLineLength = Math.floor(
    (availableForLines * 4) / contractA.dependencies.length
  );
  
  // Ensure minimum line length
  const effectiveMaxLength = Math.max(maxLineLength, 50);
  
  // Truncate usageContextLine fields
  return {
    ...contractA,
    dependencies: contractA.dependencies.map(dep => ({
      ...dep,
      usageContextLine: dep.usageContextLine.length > effectiveMaxLength
        ? dep.usageContextLine.slice(0, effectiveMaxLength) + '...'
        : dep.usageContextLine
    }))
  };
}

/**
 * Calculate the actual token limits based on the system prompt size.
 * 
 * @param systemPrompt - The concatenated system prompt
 * @param maxContextWindow - Maximum context window (default: 8192)
 * @returns Token limits with calculated system prompt tokens
 */
export function calculateTokenLimits(
  systemPrompt: string,
  maxContextWindow: number = 8192
): TokenLimits {
  return {
    maxContextWindow,
    systemPromptTokens: estimateTokens(systemPrompt),
    reserveForResponse: 2048
  };
}

// Made with Bob
