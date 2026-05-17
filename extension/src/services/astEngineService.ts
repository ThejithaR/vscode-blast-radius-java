import fs from "fs-extra";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.js";
import { getExtensionPath, getWorkspaceRoot } from "../utils/extensionPaths.js";

const execAsync = promisify(exec);

// Types matching shared/types/astDependenciesOutput.ts
export interface CallSite {
  callerMethod: string;
  lineNumber: number;
  usageContextLine: string;
}

export interface AstDependency {
  filePath: string;
  packageName: string;
  importedSymbols: string[];
  callSites: CallSite[];
}

export interface AstDependenciesOutput {
  dependencies: AstDependency[];
}

// Type matching shared/types/gitDeltaOutput.ts
export interface GitDeltaOutput {
  targetFile: string;
  targetPackage: string;
  gitDiff: string;
  changedMethods: string[];
}

/**
 * Run AST engine to analyze dependencies
 */
export async function runAstEngine(gitOutput: GitDeltaOutput): Promise<AstDependenciesOutput> {
  try {
    logger.info("Running AST engine");

    // Validate input
    if (!gitOutput || !gitOutput.targetFile) {
      throw new Error("Invalid git output: missing targetFile");
    }
    if (!gitOutput.targetPackage) {
      throw new Error("Invalid git output: missing targetPackage");
    }

    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error("No workspace folder is open");
    }
    // The fat-jar ships inside the extension (see scripts/build-extension.vsix.sh).
    // --workspace= passed to the jar still points at the user's open repo below.
    const astEngineJar = path.join(
      getExtensionPath(),
      "lib",
      "ast-engine",
      "blast-radius-ast.jar"
    );

    // Check if AST engine JAR exists
    if (!await fs.pathExists(astEngineJar)) {
      logger.warn(`AST engine JAR not found at ${astEngineJar}, using example data`);
      const examplePath = path.join(getExtensionPath(), "examples", "ast-output.json");
      return fs.readJson(examplePath);
    }

    // Build methods CSV (empty string if no methods)
    const methodsCsv = gitOutput.changedMethods?.join(',') || '';

    // Build CLI command
    const command = [
      'java',
      '-Xmx4g',  // Heap size for large repos
      '-jar',
      `"${astEngineJar}"`,
      `--workspace="${workspaceRoot}"`,
      `--target="${gitOutput.targetFile}"`,
      `--target-package="${gitOutput.targetPackage}"`,
      `--methods="${methodsCsv}"`
    ].join(' ');

    // Execute AST engine
    logger.info(`Executing AST engine with command:`);
    logger.info(command);
    
    const { stdout, stderr } = await execAsync(command, {
      maxBuffer: 50 * 1024 * 1024,  // 50MB for large output
      timeout: 300000,  // 5 minutes
      cwd: workspaceRoot
    });

    // Log stderr (contains progress messages and warnings)
    if (stderr) {
      logger.info(`AST engine logs:\n${stderr}`);
    }

    // Parse stdout as JSON
    if (!stdout || stdout.trim().length === 0) {
      throw new Error("AST engine produced no output on stdout");
    }

    const output: AstDependenciesOutput = JSON.parse(stdout);

    // Validate output structure
    if (!output.dependencies || !Array.isArray(output.dependencies)) {
      throw new Error("Invalid AST engine output: missing dependencies array");
    }

    logger.info(`AST analysis complete: ${output.dependencies.length} dependencies found`);
    return output;

  } catch (error: any) {
    // Handle specific exit codes
    if (error.code === 1) {
      logger.error("AST engine usage error - check CLI arguments");
      throw new Error("AST engine usage error: invalid arguments");
    } else if (error.code === 2) {
      logger.error("Workspace not found or no pom.xml files");
      throw new Error("AST engine error: workspace not found or no Maven projects");
    } else if (error.code === 3) {
      logger.error("AST engine internal exception");
      if (error.stderr) {
        logger.error(`Exception details:\n${error.stderr}`);
      }
      throw new Error("AST engine internal error - see logs for details");
    }

    logger.error("Failed to run AST engine", error);

    // Fallback to example data shipped with the extension
    const examplePath = path.join(getExtensionPath(), "examples", "ast-output.json");
    if (await fs.pathExists(examplePath)) {
      logger.warn("Falling back to example ast-output.json");
      return fs.readJson(examplePath);
    }
    
    throw new Error(`AST engine execution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}