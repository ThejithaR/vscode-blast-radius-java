import { DiffHunk } from './types';

/**
 * Parses a unified diff string into structured DiffHunk objects.
 * 
 * Unified diff format uses @@ headers like:
 * @@ -oldStart,oldCount +newStart,newCount @@
 * 
 * Example:
 * @@ -145,7 +145,8 @@
 * means: old file starts at line 145 with 7 lines, new file starts at line 145 with 8 lines
 * 
 * @param rawDiff - The output of `git diff HEAD -- <file>`
 * @returns Array of parsed hunks
 */
export function parseDiff(rawDiff: string): DiffHunk[] {
  if (!rawDiff || rawDiff.trim().length === 0) {
    return [];
  }

  const hunks: DiffHunk[] = [];
  const lines = rawDiff.split('\n');
  
  // Regex to match @@ -oldStart,oldCount +newStart,newCount @@
  // The counts are optional (default to 1 if omitted)
  const hunkHeaderRegex = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;
  
  let currentHunk: DiffHunk | null = null;
  
  for (const line of lines) {
    const match = line.match(hunkHeaderRegex);
    
    if (match) {
      // Save previous hunk if exists
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      
      // Parse the hunk header
      const oldStart = parseInt(match[1], 10);
      const oldCount = match[2] ? parseInt(match[2], 10) : 1;
      const newStart = parseInt(match[3], 10);
      const newCount = match[4] ? parseInt(match[4], 10) : 1;
      
      currentHunk = {
        oldStart,
        oldCount,
        newStart,
        newCount,
        lines: []
      };
    } else if (currentHunk) {
      // This is a diff line (starts with +, -, or space for context)
      // or could be a context line after the hunk
      if (line.startsWith('+') || line.startsWith('-') || line.startsWith(' ')) {
        currentHunk.lines.push(line);
      } else if (line.startsWith('\\')) {
        // Handle "\ No newline at end of file" - include it
        currentHunk.lines.push(line);
      }
      // Ignore other lines (like diff headers, file paths, etc.)
    }
  }
  
  // Don't forget the last hunk
  if (currentHunk) {
    hunks.push(currentHunk);
  }
  
  return hunks;
}

/**
 * Extracts the line numbers that were changed in the new file.
 * This includes both added lines and modified lines (context of changes).
 * 
 * @param hunks - Parsed diff hunks
 * @returns Set of line numbers in the new file that were affected
 */
export function getChangedLineNumbers(hunks: DiffHunk[]): Set<number> {
  const changedLines = new Set<number>();
  
  for (const hunk of hunks) {
    let currentNewLine = hunk.newStart;
    
    for (const line of hunk.lines) {
      if (line.startsWith('+')) {
        // Added line
        changedLines.add(currentNewLine);
        currentNewLine++;
      } else if (line.startsWith('-')) {
        // Removed line - doesn't increment new line counter
        // but we mark the position where it was removed
        changedLines.add(currentNewLine);
      } else if (line.startsWith(' ')) {
        // Context line - include it as it's near the change
        changedLines.add(currentNewLine);
        currentNewLine++;
      }
      // Ignore lines starting with '\' (like "\ No newline at end of file")
    }
  }
  
  return changedLines;
}

/**
 * Gets the range of lines affected by all hunks.
 * Returns the minimum and maximum line numbers in the new file.
 * 
 * @param hunks - Parsed diff hunks
 * @returns Object with min and max line numbers, or null if no hunks
 */
export function getChangedLineRange(hunks: DiffHunk[]): { min: number; max: number } | null {
  if (hunks.length === 0) {
    return null;
  }
  
  let min = Infinity;
  let max = -Infinity;
  
  for (const hunk of hunks) {
    const hunkStart = hunk.newStart;
    const hunkEnd = hunk.newStart + hunk.newCount - 1;
    
    min = Math.min(min, hunkStart);
    max = Math.max(max, hunkEnd);
  }
  
  return { min, max };
}

// Made with Bob
