import * as vscode from "vscode";

const channel = vscode.window.createOutputChannel("Blast Radius");

export const logger = {
  info(message: string) {
    const timestamp = new Date().toISOString();
    channel.appendLine(`[${timestamp}] [INFO] ${message}`);
  },

  success(message: string) {
    const timestamp = new Date().toISOString();
    channel.appendLine(`[${timestamp}] [SUCCESS] ✓ ${message}`);
  },

  error(message: string, error?: any) {
    const timestamp = new Date().toISOString();
    channel.appendLine(`[${timestamp}] [ERROR] ✗ ${message}`);
    
    if (error) {
      if (error instanceof Error) {
        channel.appendLine(`  Message: ${error.message}`);
        if (error.stack) {
          channel.appendLine(`  Stack: ${error.stack}`);
        }
      } else {
        channel.appendLine(`  Details: ${JSON.stringify(error, null, 2)}`);
      }
    }
  },

  warn(message: string) {
    const timestamp = new Date().toISOString();
    channel.appendLine(`[${timestamp}] [WARN] ⚠ ${message}`);
  },

  show() {
    channel.show();
  },

  clear() {
    channel.clear();
  }
};