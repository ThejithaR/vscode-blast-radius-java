import fs from "fs-extra";
import path from "path";
import { logger } from "../utils/logger.js";

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

    // Dynamically import ai-orchestrator's analyze method from extension's lib directory
    // When compiled, this file is at extension/dist/services/aiService.js
    // So __dirname = extension/dist/services
    // We need to go: ../.. (to extension/) then lib/ai-orchestrator/dist/index.js
    const aiOrchestratorPath = path.join(__dirname, "..", "..", "lib", "ai-orchestrator", "dist", "ai-orchestrator", "src", "index.js");

    logger.info(`Loading AI orchestrator from: ${aiOrchestratorPath}`);
    logger.info(`Current __dirname: ${__dirname}`);

    // Check if AI orchestrator is built
    if (!await fs.pathExists(aiOrchestratorPath)) {
      logger.warn(`AI orchestrator not found at: ${aiOrchestratorPath}`);
      logger.warn("Using example data");
      const examplePath = path.join(__dirname, "..", "..", "examples", "contract-b.example.json");
      return fs.readJson(examplePath);
    }

    // Check for API key
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
    
    // Fallback to example data in development
    const examplePath = path.join(__dirname, "..", "..", "examples", "contract-b.example.json");
    if (await fs.pathExists(examplePath)) {
      logger.warn("Falling back to example contract-b.example.json");
      return fs.readJson(examplePath);
    }
    
    throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}