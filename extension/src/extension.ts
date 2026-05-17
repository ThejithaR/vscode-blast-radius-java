import * as vscode from "vscode";

import { runPipeline } from "./orchestrator/pipeline.js";
import { logger } from "./utils/logger.js";

export function activate(context: vscode.ExtensionContext) {
  try {
    logger.info("Blast Radius extension activated");

    const disposable = vscode.commands.registerCommand(
      "blastRadius.map",
      async () => {
        try {
          const editor = vscode.window.activeTextEditor;

          if (!editor) {
            const message = "No active editor found. Please open a file first.";
            logger.error(message);
            vscode.window.showErrorMessage(message);
            return;
          }

          const filePath = editor.document.uri.fsPath;
          logger.info(`Starting analysis for: ${filePath}`);

          await runPipeline(filePath, context);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error(`Command execution failed: ${errorMessage}`, error);
          vscode.window.showErrorMessage(`Blast Radius: ${errorMessage}`);
        }
      }
    );

    context.subscriptions.push(disposable);
  } catch (error) {
    logger.error("Failed to activate extension", error);
    throw error;
  }
}

export function deactivate() {
  logger.info("Blast Radius extension deactivated");
}