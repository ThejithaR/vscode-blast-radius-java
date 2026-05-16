import * as path from 'path';
import * as fs from 'fs';
import { FileInfo } from './types';

/**
 * Resolves the active file's workspace-relative path and Java package declaration.
 * 
 * @param absolutePath - Absolute path to the Java file
 * @param workspaceRoot - Absolute path to the workspace root
 * @returns FileInfo with relative path and package name
 * @throws Error if file doesn't exist or package declaration not found
 */
export function resolveActiveFile(absolutePath: string, workspaceRoot: string): FileInfo {
  // Ensure the file exists
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }
  
  // Convert to workspace-relative path with forward slashes
  const relativePath = path.relative(workspaceRoot, absolutePath);
  const filePath = relativePath.replace(/\\/g, '/');
  
  // Read the file to extract package declaration
  const content = fs.readFileSync(absolutePath, 'utf-8');
  const packageName = extractPackageName(content);
  
  if (!packageName) {
    throw new Error(`No package declaration found in file: ${filePath}`);
  }
  
  return {
    filePath,
    packageName
  };
}

/**
 * Extracts the Java package declaration from file content.
 * Looks for pattern: package x.y.z;
 * 
 * @param content - Java file content
 * @returns Package name or null if not found
 */
export function extractPackageName(content: string): string | null {
  // Match: package org.wso2.carbon.identity.core;
  // Allow whitespace variations and comments
  const packageRegex = /^\s*package\s+([\w.]+)\s*;/m;
  const match = content.match(packageRegex);
  
  if (match && match[1]) {
    return match[1];
  }
  
  return null;
}

/**
 * Validates that a file is a Java source file.
 * 
 * @param filePath - Path to check
 * @returns true if file has .java extension
 */
export function isJavaFile(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.java');
}

/**
 * Normalizes a file path to use forward slashes.
 * Useful for ensuring consistent paths across Windows and Unix systems.
 * 
 * @param filePath - Path to normalize
 * @returns Path with forward slashes
 */
export function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

// Made with Bob
