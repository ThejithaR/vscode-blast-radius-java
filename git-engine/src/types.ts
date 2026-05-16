/**
 * Internal types for git-engine.
 * Public contract (GitDeltaOutput) is defined in @blast-radius/shared.
 */

/**
 * Represents a single hunk in a unified diff.
 * A hunk is a contiguous block of changes marked by @@ headers.
 */
export interface DiffHunk {
  /** Starting line number in the old file (1-based) */
  oldStart: number;
  /** Number of lines in the old file */
  oldCount: number;
  /** Starting line number in the new file (1-based) */
  newStart: number;
  /** Number of lines in the new file */
  newCount: number;
  /** The actual diff lines (including +, -, and context lines) */
  lines: string[];
}

/**
 * Represents a Java method declaration found in source code.
 */
export interface MethodDeclaration {
  /** Method name */
  name: string;
  /** Starting line number (1-based) */
  startLine: number;
  /** Ending line number (1-based) */
  endLine: number;
}

/**
 * Result of resolving the active file.
 */
export interface FileInfo {
  /** Workspace-relative path with forward slashes */
  filePath: string;
  /** Fully-qualified Java package name (e.g., "org.wso2.carbon.identity.core") */
  packageName: string;
}

// Made with Bob
