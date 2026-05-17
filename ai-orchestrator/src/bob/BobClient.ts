import { execSync } from 'child_process';

/**
 * IBM Bob API client.
 * Handles communication with the local Bob Shell CLI via child_process.execSync.
 * Bob Shell must be installed locally on the user's system.
 */

export interface BobConfig {
  // Note: For local Bob Shell, we no longer need HTTP endpoint/apiKey
  // These are kept for backward compatibility but ignored
  endpoint?: string;      // Deprecated: kept for compatibility
  apiKey?: string;        // Deprecated: kept for compatibility
  model?: string;        // e.g., granite-13b-chat
  temperature?: number;  // 0.0 for deterministic output
  timeout?: number;      // Process timeout in milliseconds
}

export interface BobRequest {
  system: string;
  user: string;
  model: string;
  temperature: number;
}

export interface BobResponse {
  content: string;  // Raw JSON string from Bob
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export class BobClient {
  private config: Required<Omit<BobConfig, 'endpoint' | 'apiKey'>> & { timeout: number };

  constructor(config: BobConfig) {
    // Apply defaults
    this.config = {
      model: 'granite-13b-chat',
      temperature: 0.0,
      timeout: 60000, // 60 seconds
      ...config
    };
  }

  /**
   * Call IBM Bob via local Shell CLI.
   * 
   * @param request - The system and user prompts with model config
   * @returns Bob's response with content and token usage
   * @throws Error on command execution failure or parsing error
   */
  async call(request: BobRequest): Promise<BobResponse> {
    try {
      // 1. Check if bob CLI is installed
      this.checkBobInstalled();

      // 2. Combine the prompts
      const combinedPrompt = `${request.system}\n\n${request.user}`;

      try {
        // 3. Execute Bob Shell CLI, passing prompt via stdin to avoid shell injection
        // Suppress stderr to avoid IDE companion warnings mixing with JSON output
        const bobOutput = execSync(
          'bob',
          { 
            input: combinedPrompt,
            encoding: 'utf-8',
            timeout: this.config.timeout,
            maxBuffer: 10 * 1024 * 1024, // 10MB for large responses
            stdio: ['pipe', 'pipe', 'ignore'] // Ignore stderr
          }
        );

        // 4. Parse and clean the JSON response
        // Bob's response may contain extra text, so extract just the JSON object
        const response = bobOutput.trim();
        
        // Find the first '{' and last '}' to extract the JSON object
        const firstBrace = response.indexOf('{');
        const lastBrace = response.lastIndexOf('}');
        
        if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
          throw new Error('No valid JSON object found in Bob response');
        }
        
        // Extract JSON and remove any trailing whitespace or newlines after it
        let jsonContent = response.substring(firstBrace, lastBrace + 1).trim();
        
        // Additional safety: ensure the extracted content is valid JSON before returning
        try {
          JSON.parse(jsonContent);
        } catch (parseError) {
          // If parsing fails, try to find balanced braces more carefully
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
        
        return {
          content: jsonContent,
          usage: {
            promptTokens: 0,  // Bob Shell doesn't report token usage
            completionTokens: 0,
            totalTokens: 0
          }
        };
      } catch (error) {
        if (error instanceof Error) {
          throw this.handleBobError(error);
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw error;
    }
  }

  /**
   * Verify that Bob Shell is installed on the system.
   */
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

  /**
   * Convert shell execution errors to user-friendly error messages.
   */
  private handleBobError(error: Error): Error {
    const message = error.message;

    if (message.includes('ENOENT')) {
      return new Error(
        'Bob Shell not found. Install it from: https://bob.ibm.com/docs/shell'
      );
    }
    
    if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      return new Error(
        `Bob request timeout (${this.config.timeout}ms). Try increasing BOB_TIMEOUT.`
      );
    }

    if (message.includes('ERR_CHILD_PROCESS_STDIO_MAXBUFFER')) {
      return new Error(
        'Bob response too large. The analysis output exceeded buffer limits.'
      );
    }

    return new Error(`Bob Shell error: ${message}`);
  }
}

// Made with Bob
