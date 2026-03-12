import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { AuditReport } from "../checks/types.js";
import { createOutputDir } from "./output.js";

/**
 * Write an AuditReport to a pretty-printed JSON file.
 * Creates the output directory if it doesn't exist.
 *
 * @returns The absolute path to the written report.json file.
 */
export async function writeJsonReport(
  report: AuditReport,
  baseDir = "output"
): Promise<string> {
  const outputDir = await createOutputDir(report.timestamp, baseDir);
  const filePath = join(outputDir, "report.json");
  const json = JSON.stringify(report, null, 2);
  await writeFile(filePath, json, "utf-8");
  return filePath;
}
