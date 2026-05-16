import fs from "fs-extra";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);

export interface AstDependenciesOutput {
  dependencies: Array<{
    sourceFile: string;
    sourceLine: number;
    sourceSymbol: string;
    targetFile: string;
    targetSymbol: string;
    dependencyType: string;
    context?: string;
  }>;
  metadata: {
    projectRoot: string;
    analyzedFiles: number;
    timestamp: string;
  };
}

/**
 * Run AST engine to analyze dependencies
 */
export async function runAstEngine(gitOutput: any): Promise<AstDependenciesOutput> {
  try {
    logger.info("Running AST engine");

    // Validate input
    if (!gitOutput || !gitOutput.targetFile) {
      throw new Error("Invalid git output: missing targetFile");
    }

    const workspaceRoot = process.cwd();
    const astEngineJar = path.join(
      workspaceRoot,
      "ast-engine",
      "target",
      "blast-radius-ast-1.0-SNAPSHOT-jar-with-dependencies.jar"
    );

    // Check if AST engine JAR exists
    if (!await fs.pathExists(astEngineJar)) {
      logger.warn("AST engine JAR not found, using example data");
      const examplePath = path.join(workspaceRoot, "extension", "src", "examples", "ast-output.json");
      return fs.readJson(examplePath);
    }

    // Create temp directory for input/output
    const tempDir = path.join(workspaceRoot, "temp");
    await fs.ensureDir(tempDir);

    const inputPath = path.join(tempDir, "ast-input.json");
    const outputPath = path.join(tempDir, "ast-dependencies-output.json");

    // Write git output as input for AST engine
    await fs.writeJson(inputPath, gitOutput, { spaces: 2 });
    logger.info(`AST input written to: ${inputPath}`);

    // Execute AST engine
    logger.info(`Executing AST engine: ${astEngineJar}`);
    const { stdout, stderr } = await execAsync(
      `java -jar "${astEngineJar}" "${inputPath}" "${outputPath}"`,
      {
        maxBuffer: 20 * 1024 * 1024, // 20MB
        timeout: 120000, // 2 minutes
        cwd: workspaceRoot
      }
    );

    if (stderr) {
      logger.warn(`AST engine stderr: ${stderr}`);
    }

    if (stdout) {
      logger.info(`AST engine stdout: ${stdout}`);
    }

    // Read output
    if (!await fs.pathExists(outputPath)) {
      throw new Error(`AST engine did not produce output file: ${outputPath}`);
    }

    const output: AstDependenciesOutput = await fs.readJson(outputPath);

    // Validate output structure
    if (!output.dependencies || !Array.isArray(output.dependencies)) {
      throw new Error("Invalid AST engine output: missing dependencies array");
    }

    logger.info(`AST analysis complete: ${output.dependencies.length} dependencies found`);
    return output;

  } catch (error) {
    logger.error("Failed to run AST engine", error);
    
    // Fallback to example data in development
    const examplePath = path.join(process.cwd(), "extension", "src", "examples", "ast-output.json");
    if (await fs.pathExists(examplePath)) {
      logger.warn("Falling back to example ast-output.json");
      return fs.readJson(examplePath);
    }
    
    throw new Error(`AST engine execution failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}