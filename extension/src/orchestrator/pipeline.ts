import * as vscode from "vscode";
import path from "path";

import { logger } from "../utils/logger.js";

import {
  ensureDirectories,
  writeJson,
  writeMarkdown
} from "../utils/fileManager.js";

import { getGitDelta } from "../services/gitEngineService.js";

import { runAstEngine } from "../services/astEngineService.js";

import { analyzeRisk } from "../services/aiService.js";

import { generateMarkdown, openVisualizer } from "../services/visualizerService.js";

import { assembleContractA } from "./contractAssembler.js";

/**
 * Main pipeline orchestrator
 */
export async function runPipeline(
  targetFile: string,
  context: vscode.ExtensionContext
): Promise<void> {
  const startTime = Date.now();

  try {
    logger.show();
    logger.info("=".repeat(60));
    logger.info("Starting Blast Radius Analysis Pipeline");
    logger.info("=".repeat(60));
    logger.info(`Target file: ${targetFile}`);

    // Get workspace root
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    logger.info(`Workspace root: ${workspaceRoot}`);

    // Ensure output directories exist
    await ensureDirectories();

    // Step 1: Git Engine - Extract changes
    logger.info("");
    logger.info("Step 1/5: Extracting Git changes...");
    const gitOutput = await getGitDelta(targetFile, workspaceRoot);
    
    if (!gitOutput || !gitOutput.targetFile) {
      throw new Error("Git engine failed to produce valid output");
    }

    await writeJson("temp/git-output.json", gitOutput);
    logger.success(`Git changes extracted: ${gitOutput.changedMethods?.length || 0} methods changed`);

    logger.info(`git engine result: ${JSON.stringify(gitOutput, null, 2)}`);


    // Step 2: AST Engine - Analyze dependencies
    logger.info("");
    logger.info("Step 2/5: Analyzing AST dependencies...");
    const astOutput = await runAstEngine(gitOutput, workspaceRoot);
    
    if (!astOutput || !astOutput.dependencies) {
      throw new Error("AST engine failed to produce valid output");
    }

    await writeJson("temp/ast-output.json", astOutput);
    logger.success(`AST analysis complete: ${astOutput.dependencies.length} dependencies found`);

    // Step 3: Assemble Contract A
    logger.info("");
    logger.info("Step 3/5: Assembling Contract A...");
    const contractA = assembleContractA(gitOutput, astOutput);
    
    if (!contractA || !contractA.targetFile) {
      throw new Error("Failed to assemble Contract A");
    }

    await writeJson("temp/contract-a.json", contractA);
    logger.success("Contract A assembled successfully");

    // Step 4: AI Analysis - Generate Contract B
    logger.info("");
    logger.info("Step 4/5: Running AI risk analysis...");
    const contractB = await analyzeRisk(contractA);
    
    if (!contractB || !contractB.nodes) {
      throw new Error("AI analysis failed to produce valid Contract B");
    }

    await writeJson("temp/contract-b.json", contractB);
    logger.success(`AI analysis complete: ${contractB.nodes.length} nodes, ${contractB.edges?.length || 0} edges`);

    // Step 5: Generate Markdown Report
    logger.info("");
    logger.info("Step 5/5: Generating markdown report...");
    const markdown = await generateMarkdown(contractB);
    
    if (!markdown || markdown.length === 0) {
      throw new Error("Failed to generate markdown report");
    }

    const reportPath = path.join(workspaceRoot, "blast-radius-report.md");
    await writeMarkdown(reportPath, markdown);
    logger.success(`Report generated: ${reportPath}`);

    // Step 6: Open Visualizer
    logger.info("");
    logger.info("Step 6/6: Opening visualizer...");
    await openVisualizer(contractB, context);
    logger.success("Visualizer opened successfully");

    // Calculate execution time
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    logger.info("");
    logger.info("=".repeat(60));
    logger.success(`Blast Radius analysis completed in ${duration}s`);
    logger.info("=".repeat(60));

    // Open report in preview
    //const uri = vscode.Uri.file(reportPath);

   // await vscode.commands.executeCommand("markdown.showPreview", uri);
    
    vscode.window.showInformationMessage(
      `Blast Radius analysis completed successfully in ${duration}s`
    );

  } catch (err: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    logger.error("");
    logger.error("=".repeat(60));
    logger.error(`Pipeline failed after ${duration}s`);
    logger.error(`Error: ${errorMessage}`);
    logger.error("=".repeat(60));

    if (err.stack) {
      logger.error("Stack trace:");
      logger.error(err.stack);
    }

    vscode.window.showErrorMessage(
      `Blast Radius analysis failed: ${errorMessage}`
    );

    throw err;
  }
}

// Made with Bob
