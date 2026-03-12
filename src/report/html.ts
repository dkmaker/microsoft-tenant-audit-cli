import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { AuditReport } from "../checks/types.js";
import type { DriftResult } from "../cache/diff.js";
import { createOutputDir } from "./output.js";
import { generateHtmlReport } from "./template.js";

/**
 * Generate and write the HTML dashboard report.
 *
 * @returns The path to the written report.html file.
 */
export async function writeHtmlReport(
  report: AuditReport,
  baseDir = "output",
  drift?: DriftResult
): Promise<string> {
  const outputDir = await createOutputDir(report.timestamp, baseDir);
  const filePath = join(outputDir, "report.html");
  const html = generateHtmlReport(report, drift);
  await writeFile(filePath, html, "utf-8");
  return filePath;
}
