import fs from "fs-extra";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);

export interface GitDeltaOutput {
  targetFile: string;
  gitDiff: string;
  changedMethods: Array<{
    methodName: string;
    startLine: number;
    endLine: number;
  }>;
}

/**
 * Get git delta for the target file using git-engine
 */
export async function getGitDelta(targetFile: string): Promise<GitDeltaOutput> {
  try {
    logger.info(`Getting git delta for: ${targetFile}`);

    // Validate target file exists
    if (!await fs.pathExists(targetFile)) {
      throw new Error(`Target file does not exist: ${targetFile}`);
    }

    // Get workspace root (go up from extension directory)
    const workspaceRoot = process.cwd();
    const gitEnginePath = path.join(workspaceRoot, "git-engine", "dist", "index.js");

    // Check if git-engine is built
    if (!await fs.pathExists(gitEnginePath)) {
      logger.warn("Git engine not found, using example data");
      return fs.readJson(path.join(workspaceRoot, "extension", "src", "examples", "git-output.json"));
    }

    // Execute git-engine
    logger.info(`Executing git-engine: ${gitEnginePath}`);
    const { stdout, stderr } = await execAsync(
      `node "${gitEnginePath}" "${targetFile}"`,
      {
        maxBuffer: 10 * 1024 * 1024, // 10MB
        timeout: 30000, // 30 seconds
        cwd: workspaceRoot
      }
    );

    if (stderr) {
      logger.warn(`Git engine stderr: ${stderr}`);
    }

    if (!stdout || stdout.trim().length === 0) {
      throw new Error("Git engine produced no output");
    }

    const output: GitDeltaOutput = JSON.parse(stdout);

    // Validate output structure
    if (!output.targetFile || !output.gitDiff) {
      throw new Error("Invalid git-engine output structure");
    }

    logger.info(`Git delta extracted: ${output.changedMethods?.length || 0} changed methods`);
    return output;

  } catch (error) {
    logger.error("Failed to get git delta", error);
    
    // Fallback to example data in development
    const examplePath = path.join(process.cwd(), "extension", "src", "examples", "git-output.json");
    if (await fs.pathExists(examplePath)) {
      logger.warn("Falling back to example git-output.json");
      return fs.readJson(examplePath);
    }
    
    throw new Error(`Git delta extraction failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Made with Bob
