import fs from "fs-extra";
import path from "path";
import { logger } from "../utils/logger.js";
import { getExtensionPath, getWorkspaceRoot } from "../utils/extensionPaths.js";

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
export async function analyzeRisk(contractA: any, uri?: string): Promise<ContractB> {
  try {
    logger.info("Running AI risk analysis");

    if (uri && !(await fs.pathExists(uri))) {
      throw new Error(`URI path does not exist: ${uri}`);
    }

    // Validate input
    if (!contractA || !contractA.targetFile) {
      throw new Error("Invalid Contract A: missing targetFile");
    }

    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      throw new Error("No workspace folder is open");
    }
    const aiOrchestratorPath = path.join(
      workspaceRoot,
      "ai-orchestrator",
      "dist",
      "index.js"
    );

    // Check if AI orchestrator is built
    if (!await fs.pathExists(aiOrchestratorPath)) {
      logger.warn("AI orchestrator not found, using example data");
      const examplePath = path.join(getExtensionPath(), "examples", "contract-b.example.json");
      return fs.readJson(examplePath);
    }

    // Create temp directory
    const tempDir = path.join(workspaceRoot, "temp");
    await fs.ensureDir(tempDir);

    const inputPath = path.join(tempDir, "contract-a.json");
  
    // Write Contract A as input
    await fs.writeJson(inputPath, contractA, { spaces: 2 });
    logger.info(`Contract A written to: ${inputPath}`);
    
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.BOB_API_KEY;
    if (!apiKey) {
      logger.warn("No API key found, using example data");
      const examplePath = path.join(__dirname, "..", "..", "examples", "contract-b.example.json");
      return fs.readJson(examplePath);
    }
    // Import and call ai-orchestrator's analyze method
    const aiOrchestrator = await import(aiOrchestratorPath);
    const output: ContractB = await aiOrchestrator.analyze(contractA, {
      apiKey,
      maxRetries: 3
    });

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

    // Fallback to example data shipped with the extension
    const examplePath = path.join(getExtensionPath(), "examples", "contract-b.example.json");
    if (await fs.pathExists(examplePath)) {
      logger.warn("Falling back to example contract-b.example.json");
      return fs.readJson(examplePath);
    }
    
    throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}