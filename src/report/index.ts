export { writeJsonReport } from "./json.js";
export { writeHtmlReport } from "./html.js";
export { createOutputDir } from "./output.js";
export { generateHtmlReport } from "./template.js";

import type { AuditReport } from "../checks/types.js";
import type { DriftResult } from "../cache/diff.js";
import { writeJsonReport } from "./json.js";
import { writeHtmlReport } from "./html.js";

/**
 * Generate both JSON and HTML reports for an audit run.
 *
 * @returns Paths to the generated report files.
 */
export async function generateReports(
  report: AuditReport,
  baseDir = "output",
  drift?: DriftResult
): Promise<{ jsonPath: string; htmlPath: string }> {
  const [jsonPath, htmlPath] = await Promise.all([
    writeJsonReport(report, baseDir),
    writeHtmlReport(report, baseDir, drift),
  ]);
  return { jsonPath, htmlPath };
}
