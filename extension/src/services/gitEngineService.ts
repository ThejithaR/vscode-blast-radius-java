import fs from "fs-extra";
import path from "path";
import { pathToFileURL } from "url";
import { logger } from "../utils/logger.js";
import { getExtensionPath } from "../utils/extensionPaths.js";

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

    // Resolve from the installed extension root (esbuild bundle means __dirname is unreliable).
    const extensionRoot = getExtensionPath();
    const gitEnginePath = path.join(extensionRoot, "lib", "git-engine", "dist", "git-engine", "src", "index.js");

    logger.info(`Loading git-engine from: ${gitEnginePath}`);

    // Check if git-engine is built
    if (!await fs.pathExists(gitEnginePath)) {
      logger.warn(`Git engine not found at: ${gitEnginePath}`);
      logger.warn("Using example data");
      const examplePath = path.join(extensionRoot, "examples", "git-output.json");
      return fs.readJson(examplePath);
    }

    // Import and call git-engine's extract method.
    // On Windows, await import() requires a file:// URL — a bare "c:\..." path
    // is rejected as ERR_UNSUPPORTED_ESM_URL_SCHEME.
    const gitEngine = await import(pathToFileURL(gitEnginePath).href);
    const output = await gitEngine.extract(targetFile, repoRoot);

    // Validate output structure
    if (!output.targetFile || !output.gitDiff) {
      throw new Error("Invalid git-engine output structure");
    }

    logger.info(`Git delta extracted: ${output.changedMethods?.length || 0} changed methods`);
    return output;

  } catch (error) {
    logger.error("Failed to get git delta", error);
    
    // Fallback to example data shipped with the extension
    const examplePath = path.join(getExtensionPath(), "examples", "git-output.json");
    if (await fs.pathExists(examplePath)) {
      logger.warn("Falling back to example git-output.json");
      return fs.readJson(examplePath);
    }
    
    throw new Error(`Git delta extraction failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Made with Bob
