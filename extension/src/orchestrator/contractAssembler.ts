import { logger } from "../utils/logger.js";
import { GitDeltaOutput, AstDependenciesOutput } from "../services/astEngineService.js";

// Types matching shared/types/contractA.ts
export interface CallSite {
  callerMethod: string;
  lineNumber: number;
  usageContextLine: string;
}

export interface ContractADependency {
  filePath: string;
  packageName: string;
  importedSymbols: string[];
  callSites: CallSite[];
}

export interface ContractA {
  targetFile: string;
  targetPackage: string;
  gitDiff: string;
  changedMethods: string[];
  dependencies: ContractADependency[];
}

/**
 * Assemble Contract A from git and AST outputs
 */
export function assembleContractA(
  gitOutput: GitDeltaOutput,
  astOutput: AstDependenciesOutput
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
    if (!gitOutput.targetPackage) {
      throw new Error("Git output missing targetPackage");
    }
    if (!gitOutput.gitDiff) {
      throw new Error("Git output missing gitDiff");
    }

    const contractA: ContractA = {
      targetFile: gitOutput.targetFile,
      targetPackage: gitOutput.targetPackage,
      gitDiff: gitOutput.gitDiff,
      changedMethods: gitOutput.changedMethods || [],
      dependencies: astOutput.dependencies || []
    };

    // Validate assembled contract
    if (contractA.changedMethods.length === 0) {
      logger.warn("No changed methods detected - will use class-sweep mode");
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
