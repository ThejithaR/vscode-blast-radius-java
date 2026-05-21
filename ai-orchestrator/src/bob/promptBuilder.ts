import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { ContractA } from '@blast-radius/shared';

/**
 * Prompt builder for IBM Bob.
 * Assembles the complete system prompt from markdown skill files and
 * serializes Contract A as the user message.
 */

export interface PromptPair {
  system: string;
  user: string;
}

/**
 * Ordered list of prompt files to concatenate.
 * Order is critical - matches the skill execution sequence in BOB-SKILLS-SPEC.md
 */
const PROMPT_FILES = [
  'system.md',           // Global persona and output rules
  'diffIntent.md',       // Skill 1: DiffIntentAnalysis
  'riskClassification.md', // Skill 2: RiskClassification
  'reasonGeneration.md', // Skill 3: ReasonGeneration
  'edgeTyping.md',       // Skill 4: EdgeTypeClassification
  'overallSummary.md'    // Skill 5: OverallSummary
];

/**
 * Cached system prompt to avoid repeated file I/O.
 * Prompts don't change at runtime, so we cache after first read.
 */
let cachedSystemPrompt: string | null = null;

function resolvePromptDir(): string {
  const candidates = [
    join(__dirname, 'prompts'),
    join(__dirname, '..', '..', 'src', 'bob', 'prompts'),
    join(__dirname, '..', '..', '..', '..', 'src', 'bob', 'prompts'),
    join(__dirname, '..', '..', '..', '..', '..', 'src', 'bob', 'prompts')
  ];

  const promptDir = candidates.find(dir =>
    PROMPT_FILES.every(file => existsSync(join(dir, file)))
  );

  if (!promptDir) {
    throw new Error(`AI orchestrator prompt files not found. Checked: ${candidates.join(', ')}`);
  }

  return promptDir;
}

/**
 * Build the complete prompt pair for IBM Bob.
 * 
 * @param contractA - The input contract containing git diff and dependencies
 * @returns PromptPair with system and user messages
 */
export function buildPrompt(contractA: ContractA): PromptPair {
  // Build system prompt (cached after first call)
  if (!cachedSystemPrompt) {
    const promptDir = resolvePromptDir();
    
    cachedSystemPrompt = PROMPT_FILES
      .map(file => {
        const filePath = join(promptDir, file);
        const content = readFileSync(filePath, 'utf-8');
        
        // Strip HTML comments (<!-- ... -->) from markdown
        return content.replace(/<!--[\s\S]*?-->/g, '').trim();
      })
      .join('\n\n---\n\n'); // Separate skills with horizontal rules
  }

  // Serialize Contract A as the user message
  const userPrompt = JSON.stringify(contractA, null, 2);

  return {
    system: cachedSystemPrompt,
    user: userPrompt
  };
}

/**
 * Clear the cached system prompt.
 * Useful for testing or if prompts are updated at runtime.
 */
export function clearPromptCache(): void {
  cachedSystemPrompt = null;
}

// Made with Bob
