import * as fs from 'fs';
import { DiffHunk, MethodDeclaration } from './types';
import { getChangedLineNumbers } from './diffParser';

/**
 * Maps changed line ranges to Java method names.
 * Uses lightweight regex and bracket matching - deep AST resolution is handled by ast-engine (M3).
 * 
 * @param filePath - Absolute path to the Java file
 * @param hunks - Parsed diff hunks
 * @returns Array of method names that contain changed lines
 */
export function mapSymbols(filePath: string, hunks: DiffHunk[]): string[] {
  if (hunks.length === 0) {
    return [];
  }
  
  // Read the current file content
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Find all method declarations in the file
  const methods = findMethodDeclarations(content);
  
  // Get all changed line numbers
  const changedLines = getChangedLineNumbers(hunks);
  
  // Find which methods contain the changed lines
  const changedMethods = new Set<string>();
  
  for (const method of methods) {
    // Check if any changed line falls within this method's range
    for (const lineNum of changedLines) {
      if (lineNum >= method.startLine && lineNum <= method.endLine) {
        changedMethods.add(method.name);
        break;
      }
    }
  }
  
  return Array.from(changedMethods);
}

/**
 * Finds all method declarations in Java source code.
 * Uses regex to match method signatures and bracket matching to find method boundaries.
 * 
 * Pattern matches:
 * - public/private/protected (optional)
 * - static/final/synchronized/native (optional, multiple)
 * - return type
 * - method name
 * - parameters in parentheses
 * 
 * @param content - Java file content
 * @returns Array of method declarations with line ranges
 */
export function findMethodDeclarations(content: string): MethodDeclaration[] {
  const methods: MethodDeclaration[] = [];
  const lines = content.split('\n');
  
  // Regex to match Java method declarations
  // Matches: [modifiers] returnType methodName(params)
  // This is a simplified pattern - it won't catch all edge cases but is good enough for our needs
  const methodRegex = /^\s*(?:public|private|protected)?\s*(?:static|final|synchronized|native|abstract|\s)*\s*(?:<[^>]+>\s*)?(\w+(?:<[^>]+>)?(?:\[\])*)\s+(\w+)\s*\(/;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(methodRegex);
    
    if (match) {
      const returnType = match[1];
      const methodName = match[2];
      
      // Skip if this looks like a class declaration (class name starts with uppercase)
      // or if it's a constructor (method name matches class name pattern)
      if (returnType === 'class' || returnType === 'interface' || returnType === 'enum') {
        continue;
      }
      
      // Find the method's closing brace
      const startLine = i + 1; // 1-based line numbers
      const endLine = findMethodEndLine(lines, i);
      
      if (endLine > startLine) {
        methods.push({
          name: methodName,
          startLine,
          endLine
        });
      }
    }
  }
  
  return methods;
}

/**
 * Finds the ending line of a method by matching braces.
 * Starts from the method declaration line and counts opening/closing braces.
 * 
 * @param lines - Array of file lines
 * @param startIndex - Index of the method declaration line (0-based)
 * @returns 1-based line number of the method's closing brace
 */
function findMethodEndLine(lines: string[], startIndex: number): number {
  let braceCount = 0;
  let foundOpenBrace = false;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    
    // Count braces, but ignore braces in strings and comments
    const cleanedLine = removeStringsAndComments(line);
    
    for (const char of cleanedLine) {
      if (char === '{') {
        braceCount++;
        foundOpenBrace = true;
      } else if (char === '}') {
        braceCount--;
        
        // When we return to 0, we've found the method's closing brace
        if (foundOpenBrace && braceCount === 0) {
          return i + 1; // Return 1-based line number
        }
      }
    }
  }
  
  // If we didn't find a closing brace, return the last line
  return lines.length;
}

/**
 * Removes string literals and comments from a line to avoid counting braces inside them.
 * This is a simplified implementation - it won't handle all edge cases but works for most code.
 * 
 * @param line - Source code line
 * @returns Line with strings and comments removed
 */
function removeStringsAndComments(line: string): string {
  let result = '';
  let inString = false;
  let inChar = false;
  let stringChar = '';
  let escaped = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = i < line.length - 1 ? line[i + 1] : '';
    
    // Handle escape sequences
    if (escaped) {
      escaped = false;
      continue;
    }
    
    if (char === '\\' && (inString || inChar)) {
      escaped = true;
      continue;
    }
    
    // Handle strings
    if (char === '"' && !inChar) {
      if (!inString) {
        inString = true;
        stringChar = '"';
      } else if (stringChar === '"') {
        inString = false;
      }
      continue;
    }
    
    // Handle char literals
    if (char === "'" && !inString) {
      if (!inChar) {
        inChar = true;
      } else {
        inChar = false;
      }
      continue;
    }
    
    // Handle single-line comments
    if (char === '/' && nextChar === '/' && !inString && !inChar) {
      break; // Rest of line is a comment
    }
    
    // Handle multi-line comments (simplified - doesn't track across lines)
    if (char === '/' && nextChar === '*' && !inString && !inChar) {
      // Skip until we find */
      let j = i + 2;
      while (j < line.length - 1) {
        if (line[j] === '*' && line[j + 1] === '/') {
          i = j + 1;
          break;
        }
        j++;
      }
      continue;
    }
    
    // Only include characters that are not in strings or comments
    if (!inString && !inChar) {
      result += char;
    }
  }
  
  return result;
}

/**
 * Checks if a line is likely a method declaration.
 * Used for quick filtering before applying the full regex.
 * 
 * @param line - Source code line
 * @returns true if line might be a method declaration
 */
export function looksLikeMethodDeclaration(line: string): boolean {
  const trimmed = line.trim();
  
  // Must contain parentheses (for parameters)
  if (!trimmed.includes('(')) {
    return false;
  }
  
  // Skip obvious non-methods
  if (trimmed.startsWith('//') || 
      trimmed.startsWith('/*') || 
      trimmed.startsWith('*') ||
      trimmed.startsWith('@') ||
      trimmed.includes('class ') ||
      trimmed.includes('interface ') ||
      trimmed.includes('enum ')) {
    return false;
  }
  
  return true;
}

// Made with Bob
