import { execSync } from 'child_process';

/**
 * Extracts the git diff for a specific file.
 * Runs: git diff HEAD -- <file>
 * 
 * @param filePath - Workspace-relative path to the file
 * @param workspaceRoot - Absolute path to the workspace root (used as cwd)
 * @returns Raw unified diff string
 * @throws Error if git command fails or file is not in a git repository
 */
export function extractDiff(filePath: string, workspaceRoot: string): string {
  try {
    // Run git diff HEAD -- <file>
    // This compares the working directory version with the last commit
    const command = `git diff HEAD -- "${filePath}"`;
    
    const output = execSync(command, {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large diffs
      stdio: ['pipe', 'pipe', 'pipe'] // Capture stdout and stderr
    });
    
    return output;
  } catch (error: any) {
    // Check if it's a git-related error
    if (error.message?.includes('not a git repository')) {
      throw new Error(`Not a git repository: ${workspaceRoot}`);
    }
    
    if (error.message?.includes('fatal')) {
      throw new Error(`Git error: ${error.message}`);
    }
    
    // If the command succeeded but returned empty, that's okay
    // (means no changes or file not tracked)
    if (error.status === 0) {
      return '';
    }
    
    throw new Error(`Failed to extract diff: ${error.message}`);
  }
}

/**
 * Checks if a directory is a git repository.
 * 
 * @param workspaceRoot - Path to check
 * @returns true if directory is a git repository
 */
export function isGitRepository(workspaceRoot: string): boolean {
  try {
    execSync('git rev-parse --git-dir', {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a file has uncommitted changes.
 * 
 * @param filePath - Workspace-relative path to the file
 * @param workspaceRoot - Absolute path to the workspace root
 * @returns true if file has changes compared to HEAD
 */
export function hasUncommittedChanges(filePath: string, workspaceRoot: string): boolean {
  try {
    const diff = extractDiff(filePath, workspaceRoot);
    return diff.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Gets the current git branch name.
 * 
 * @param workspaceRoot - Absolute path to the workspace root
 * @returns Branch name or 'HEAD' if detached
 */
export function getCurrentBranch(workspaceRoot: string): string {
  try {
    const output = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return output.trim();
  } catch {
    return 'HEAD';
  }
}

/**
 * Extracts diff for staged changes (git diff --cached).
 * Useful if we want to support analyzing staged but not committed changes.
 * 
 * @param filePath - Workspace-relative path to the file
 * @param workspaceRoot - Absolute path to the workspace root
 * @returns Raw unified diff string for staged changes
 */
export function extractStagedDiff(filePath: string, workspaceRoot: string): string {
  try {
    const command = `git diff --cached HEAD -- "${filePath}"`;
    
    const output = execSync(command, {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    return output;
  } catch (error: any) {
    if (error.status === 0) {
      return '';
    }
    throw new Error(`Failed to extract staged diff: ${error.message}`);
  }
}

// Made with Bob
