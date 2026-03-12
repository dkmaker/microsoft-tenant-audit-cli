import { mkdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Create a timestamped output directory and return its path.
 * Format: output/2026-03-12T14-30-00/
 */
export async function createOutputDir(
  timestamp: Date,
  baseDir = "output"
): Promise<string> {
  const dirName = timestamp
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\.\d{3}Z$/, "");
  const outputPath = join(baseDir, dirName);
  await mkdir(outputPath, { recursive: true });
  return outputPath;
}
