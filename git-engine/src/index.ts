import type { GitDeltaOutput } from '@blast-radius/shared';
import { resolveActiveFile } from './activeFileResolver';
import { extractDiff, isGitRepository, hasUncommittedChanges } from './diffExtractor';
import { parseDiff } from './diffParser';
import { mapSymbols } from './symbolMapper';

/**
 * Main entry point for git-engine.
 * Extracts git delta information from the active file.
 * 
 * This is the public API consumed by the extension (Member 1).
 * 
 * @param activeFilePath - Absolute path to the active Java file
 * @param workspaceRoot - Absolute path to the workspace root
 * @returns GitDeltaOutput conforming to the contract
 * @throws Error if file is not in a git repo, has no changes, or is not a Java file
 */
export async function extract(
  activeFilePath: string,
  workspaceRoot: string
): Promise<GitDeltaOutput> {
  // Validate that we're in a git repository
  if (!isGitRepository(workspaceRoot)) {
    throw new Error(`Not a git repository: ${workspaceRoot}`);
  }
  
  // Resolve file info (relative path + package name)
  const fileInfo = resolveActiveFile(activeFilePath, workspaceRoot);
  
  // Extract git diff
  const rawDiff = extractDiff(fileInfo.filePath, workspaceRoot);
  
  // Check if there are any changes
  if (!rawDiff || rawDiff.trim().length === 0) {
    throw new Error(`No uncommitted changes found in file: ${fileInfo.filePath}`);
  }
  
  // Parse the diff into structured hunks
  const hunks = parseDiff(rawDiff);
  
  if (hunks.length === 0) {
    throw new Error(`Failed to parse diff for file: ${fileInfo.filePath}`);
  }
  
  // Map changed lines to method names
  const changedMethods = mapSymbols(activeFilePath, hunks);
  
  // Construct the output
  const output: GitDeltaOutput = {
    targetFile: fileInfo.filePath,
    targetPackage: fileInfo.packageName,
    gitDiff: rawDiff,
    changedMethods
  };
  
  return output;
}

/**
 * Validates that a file can be processed by git-engine.
 * Checks:
 * - File is in a git repository
 * - File has uncommitted changes
 * - File is a Java file
 * 
 * @param activeFilePath - Absolute path to the file
 * @param workspaceRoot - Absolute path to the workspace root
 * @returns Object with validation result and error message if invalid
 */
export function validateFile(
  activeFilePath: string,
  workspaceRoot: string
): { valid: boolean; error?: string } {
  // Check if in git repository
  if (!isGitRepository(workspaceRoot)) {
    return {
      valid: false,
      error: 'Not in a git repository'
    };
  }
  
  // Check if file is a Java file
  if (!activeFilePath.toLowerCase().endsWith('.java')) {
    return {
      valid: false,
      error: 'Not a Java file'
    };
  }
  
  // Check if file has changes
  try {
    const fileInfo = resolveActiveFile(activeFilePath, workspaceRoot);
    if (!hasUncommittedChanges(fileInfo.filePath, workspaceRoot)) {
      return {
        valid: false,
        error: 'No uncommitted changes'
      };
    }
  } catch (error: any) {
    return {
      valid: false,
      error: error.message
    };
  }
  
  return { valid: true };
}

// Re-export types for convenience
export type { GitDeltaOutput } from '@blast-radius/shared';
export type { DiffHunk, MethodDeclaration, FileInfo } from './types';

// Re-export utility functions that might be useful for testing
export { parseDiff, getChangedLineNumbers, getChangedLineRange } from './diffParser';
export { extractPackageName, isJavaFile, normalizeFilePath } from './activeFileResolver';
export { isGitRepository, hasUncommittedChanges, getCurrentBranch } from './diffExtractor';
export { findMethodDeclarations, looksLikeMethodDeclaration } from './symbolMapper';

// Made with Bob
