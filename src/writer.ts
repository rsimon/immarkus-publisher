import { writeFile, copyFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

/**
 * Write a JSON object to a file, creating parent directories as needed.
 */
export async function writeJSON(outputPath: string, data: unknown): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Copy a file to outputPath, creating parent directories as needed.
 */
export async function copyFileToOutput(
  sourcePath: string,
  outputPath: string
): Promise<void> {
  await mkdir(dirname(outputPath), { recursive: true });
  await copyFile(sourcePath, outputPath);
}
