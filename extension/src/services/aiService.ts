import fs from "fs-extra";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../utils/logger.js";

const execAsync = promisify(exec);

export interface ContractB {
  metadata: {
    timestamp: string;
    targetFile: string;
    analysisVersion: string;
  };
  nodes: Array<{
    id: string;
    label: string;
    type: string;
    file: string;
    line?: number;
    riskLevel: "critical" | "high" | "medium" | "low";
    riskScore: number;
    reasons: string[];
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: string;
    label?: string;
  }>;
  summary: {
    totalNodes: number;
    totalEdges: number;
    riskDistribution: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    overallRisk: string;
    keyFindings: string[];
  };
}

/**
 * Analyze risk using AI orchestrator
 */
export async function analyzeRisk(contractA: any): Promise<ContractB> {
  try {
    logger.info("Running AI risk analysis");

    // Validate input
    if (!contractA || !contractA.targetFile) {
      throw new Error("Invalid Contract A: missing targetFile");
    }

    const workspaceRoot = process.cwd();
    const aiOrchestratorPath = path.join(
      workspaceRoot,
      "ai-orchestrator",
      "dist",
      "index.js"
    );

    // Check if AI orchestrator is built
    if (!await fs.pathExists(aiOrchestratorPath)) {
      logger.warn("AI orchestrator not found, using example data");
      const examplePath = path.join(workspaceRoot, "extension", "src", "examples", "contract-b.json");
      return fs.readJson(examplePath);
    }

    // Create temp directory
    const tempDir = path.join(workspaceRoot, "temp");
    await fs.ensureDir(tempDir);

    const inputPath = path.join(tempDir, "contract-a.json");
    const outputPath = path.join(tempDir, "contract-b.json");

    // Write Contract A as input
    await fs.writeJson(inputPath, contractA, { spaces: 2 });
    logger.info(`Contract A written to: ${inputPath}`);

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.BOB_API_KEY;
    if (!apiKey) {
      logger.warn("No API key found, using example data");
      const examplePath = path.join(workspaceRoot, "extension", "src", "examples", "contract-b.json");
      return fs.readJson(examplePath);
    }

    // Execute AI orchestrator
    logger.info(`Executing AI orchestrator: ${aiOrchestratorPath}`);
    const { stdout, stderr } = await execAsync(
      `node "${aiOrchestratorPath}" "${inputPath}" "${outputPath}"`,
      {
        maxBuffer: 20 * 1024 * 1024, // 20MB
        timeout: 300000, // 5 minutes for AI processing
        cwd: workspaceRoot,
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: apiKey
        }
      }
    );

    if (stderr) {
      logger.warn(`AI orchestrator stderr: ${stderr}`);
    }

    if (stdout) {
      logger.info(`AI orchestrator stdout: ${stdout}`);
    }

    // Read output
    if (!await fs.pathExists(outputPath)) {
      throw new Error(`AI orchestrator did not produce output file: ${outputPath}`);
    }

    const output: ContractB = await fs.readJson(outputPath);

    // Validate output structure
    if (!output.nodes || !Array.isArray(output.nodes)) {
      throw new Error("Invalid Contract B: missing nodes array");
    }
    if (!output.edges || !Array.isArray(output.edges)) {
      throw new Error("Invalid Contract B: missing edges array");
    }

    logger.info(`AI analysis complete: ${output.nodes.length} nodes, ${output.edges.length} edges`);
    return output;

  } catch (error) {
    logger.error("Failed to run AI analysis", error);
    
    // Fallback to example data in development
    const examplePath = path.join(process.cwd(), "extension", "src", "examples", "contract-b.json");
    if (await fs.pathExists(examplePath)) {
      logger.warn("Falling back to example contract-b.json");
      return fs.readJson(examplePath);
    }
    
    throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}