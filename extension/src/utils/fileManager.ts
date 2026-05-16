import fs from "fs-extra";
import path from "path";
import { logger } from "./logger.js";

/**
 * Ensure required directories exist
 */
export async function ensureDirectories(): Promise<void> {
  try {
    const dirs = ["temp", "reports"];
    
    for (const dir of dirs) {
      await fs.ensureDir(dir);
      logger.info(`Directory ensured: ${dir}`);
    }
  } catch (error) {
    logger.error("Failed to ensure directories", error);
    throw new Error(`Directory creation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Write JSON data to file
 */
export async function writeJson(
  filePath: string,
  data: any
): Promise<void> {
  try {
    if (!filePath) {
      throw new Error("File path is required");
    }
    
    if (data === undefined || data === null) {
      throw new Error("Data cannot be null or undefined");
    }

    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    await fs.ensureDir(dir);

    await fs.writeJson(filePath, data, {
      spaces: 2
    });

    const stats = await fs.stat(filePath);
    logger.info(`JSON written: ${filePath} (${stats.size} bytes)`);
  } catch (error) {
    logger.error(`Failed to write JSON to ${filePath}`, error);
    throw new Error(`JSON write failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Read JSON data from file
 */
export async function readJson(filePath: string): Promise<any> {
  try {
    if (!filePath) {
      throw new Error("File path is required");
    }

    if (!await fs.pathExists(filePath)) {
      throw new Error(`File does not exist: ${filePath}`);
    }

    const data = await fs.readJson(filePath);
    logger.info(`JSON read: ${filePath}`);
    return data;
  } catch (error) {
    logger.error(`Failed to read JSON from ${filePath}`, error);
    throw new Error(`JSON read failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Write markdown content to file
 */
export async function writeMarkdown(
  filePath: string,
  content: string
): Promise<void> {
  try {
    if (!filePath) {
      throw new Error("File path is required");
    }
    
    if (!content || content.trim().length === 0) {
      throw new Error("Content cannot be empty");
    }

    // Ensure parent directory exists
    const dir = path.dirname(filePath);
    await fs.ensureDir(dir);

    await fs.writeFile(filePath, content, "utf-8");

    const stats = await fs.stat(filePath);
    logger.info(`Markdown written: ${filePath} (${stats.size} bytes)`);
  } catch (error) {
    logger.error(`Failed to write markdown to ${filePath}`, error);
    throw new Error(`Markdown write failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Check if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    return await fs.pathExists(filePath);
  } catch (error) {
    logger.error(`Failed to check file existence: ${filePath}`, error);
    return false;
  }
}

/**
 * Delete file if it exists
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
      logger.info(`File deleted: ${filePath}`);
    }
  } catch (error) {
    logger.error(`Failed to delete file: ${filePath}`, error);
    throw new Error(`File deletion failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}