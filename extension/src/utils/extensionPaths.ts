import * as vscode from "vscode";

let extensionPath: string | undefined;

/**
 * Captures the install path of the extension. Called once from activate().
 * After bundling, __dirname is unreliable for resolving sibling resources
 * (lib/, examples/, etc.) — use this instead.
 */
export function setExtensionContext(context: vscode.ExtensionContext): void {
  extensionPath = context.extensionUri.fsPath;
}

/**
 * Absolute path of the installed extension's root directory.
 * Equivalent to context.extensionUri.fsPath captured during activate().
 */
export function getExtensionPath(): string {
  if (!extensionPath) {
    throw new Error("Extension context not initialized: call setExtensionContext in activate()");
  }
  return extensionPath;
}

/**
 * Absolute path of the user's first workspace folder, or undefined when none is open.
 */
export function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}
