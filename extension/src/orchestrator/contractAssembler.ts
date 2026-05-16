import { logger } from "../utils/logger.js";

export interface ContractA {
  metadata: {
    timestamp: string;
    targetFile: string;
    analysisVersion: string;
  };
  targetFile: string;
  gitDiff: string;
  changedMethods: Array<{
    methodName: string;
    startLine: number;
    endLine: number;
  }>;
  dependencies: Array<{
    sourceFile: string;
    sourceLine: number;
    sourceSymbol: string;
    targetFile: string;
    targetSymbol: string;
    dependencyType: string;
    context?: string;
  }>;
}

/**
 * Assemble Contract A from git and AST outputs
 */
export function assembleContractA(
  gitOutput: any,
  astOutput: any
): ContractA {
  try {
    logger.info("Assembling Contract A");

    // Validate inputs
    if (!gitOutput) {
      throw new Error("Git output is required");
    }
    if (!astOutput) {
      throw new Error("AST output is required");
    }
    if (!gitOutput.targetFile) {
      throw new Error("Git output missing targetFile");
    }
    if (!gitOutput.gitDiff) {
      throw new Error("Git output missing gitDiff");
    }

    const contractA: ContractA = {
      metadata: {
        timestamp: new Date().toISOString(),
        targetFile: gitOutput.targetFile,
        analysisVersion: "1.0.0"
      },
      targetFile: gitOutput.targetFile,
      gitDiff: gitOutput.gitDiff,
      changedMethods: gitOutput.changedMethods || [],
      dependencies: astOutput.dependencies || []
    };

    // Validate assembled contract
    if (contractA.changedMethods.length === 0) {
      logger.warn("No changed methods detected");
    }
    if (contractA.dependencies.length === 0) {
      logger.warn("No dependencies found");
    }

    logger.info(
      `Contract A assembled: ${contractA.changedMethods.length} methods, ${contractA.dependencies.length} dependencies`
    );

    return contractA;

  } catch (error) {
    logger.error("Failed to assemble Contract A", error);
    throw new Error(
      `Contract A assembly failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Made with Bob
