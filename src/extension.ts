import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { ContractA } from './contracts';
import { evaluateBlastRadius } from './aiOrchestrator';
import { extractModifiedLines, getGitDiff } from './gitEngine';

function getWebviewHtml(context: vscode.ExtensionContext): string {
  const indexPath = path.join(context.extensionPath, 'webview-ui', 'dist', 'index.html');

  if (fs.existsSync(indexPath)) {
    return fs.readFileSync(indexPath, 'utf8');
  }

  return `<!doctype html><html><body><h2>webview-ui build missing</h2><p>Run npm run compile:webview.</p></body></html>`;
}

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand('blastRadius.start', async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('Open a file to run Blast Radius analysis.');
      return;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
    if (!workspaceFolder) {
      vscode.window.showWarningMessage('No workspace folder found for the active file.');
      return;
    }

    const relativeFile = path.relative(workspaceFolder.uri.fsPath, editor.document.uri.fsPath);
    const gitDiff = await getGitDiff(relativeFile, workspaceFolder.uri.fsPath);
    const modifiedLines = extractModifiedLines(gitDiff);

    const contractA: ContractA = {
      targetFile: relativeFile,
      gitDiff,
      dependencies: modifiedLines.map((line) => ({
        filePath: relativeFile,
        usageContextLine: line
      }))
    };

    const contractB = await evaluateBlastRadius(contractA);

    const panel = vscode.window.createWebviewPanel(
      'blastRadiusPanel',
      'Blast Radius',
      vscode.ViewColumn.Beside,
      { enableScripts: true }
    );

    panel.webview.html = getWebviewHtml(context);
    panel.webview.postMessage(contractB);
  });

  context.subscriptions.push(disposable);
}

export function deactivate(): void {
  // no-op
}
