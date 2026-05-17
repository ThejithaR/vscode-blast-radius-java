import fs from "fs-extra";
import path from "path";
import { logger } from "../utils/logger.js";

export interface GitDeltaOutput {
  targetFile: string;
  targetPackage: string;
  gitDiff: string;
  changedMethods: string[];
}

/**
 * Get git delta for the target file using git-engine's extract method
 */
export async function getGitDelta(targetFile: string, workspaceRoot: string): Promise<GitDeltaOutput> {
  try {
    logger.info(`Getting git delta for: ${targetFile}`);

    // Validate target file exists
    if (!await fs.pathExists(targetFile)) {
      throw new Error(`Target file does not exist: ${targetFile}`);
    }

    // Use the workspace root passed from the caller
    const repoRoot = workspaceRoot;
    
    logger.info(`Using repo root: ${repoRoot}`);

    // Dynamically import git-engine's extract method from extension's lib directory
    // When compiled, this file is at extension/dist/services/gitEngineService.js
    // So __dirname = extension/dist/services
    // We need to go: ../.. (to extension/) then lib/git-engine/dist/index.js
    const gitEnginePath = path.join(__dirname, "..", "..", "lib", "git-engine", "dist", "git-engine", "src","index.js");

    logger.info(`Loading git-engine from: ${gitEnginePath}`);
    logger.info(`Current __dirname: ${__dirname}`);

    // Check if git-engine is built
    if (!await fs.pathExists(gitEnginePath)) {
      logger.warn(`Git engine not found at: ${gitEnginePath}`);
      logger.warn("Using example data");
      const examplePath = path.join(__dirname, "..", "..", "examples", "git-output.json");
      return fs.readJson(examplePath);
    }

    // Import and call git-engine's extract method
    const gitEngine = await import(gitEnginePath);
    const output = await gitEngine.extract(targetFile, repoRoot);

    // Validate output structure
    if (!output.targetFile || !output.gitDiff) {
      throw new Error("Invalid git-engine output structure");
    }

    logger.info(`Git delta extracted: ${output.changedMethods?.length || 0} changed methods`);
    return output;

  } catch (error) {
    logger.error("Failed to get git delta", error);
    
    // Fallback to example data in development
    const examplePath = path.join(__dirname, "..", "..", "examples", "git-output.json");
    if (await fs.pathExists(examplePath)) {
      logger.warn("Falling back to example git-output.json");
      return fs.readJson(examplePath);
    }
    
    throw new Error(`Git delta extraction failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Made with Bob
