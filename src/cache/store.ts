import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { AuditReport } from "../checks/types.js";

const LATEST_FILE = "latest.json";

interface LatestPointer {
  path: string;
}

/**
 * Update the latest.json pointer to the given run directory name.
 */
export async function updateLatestPointer(
  baseDir: string,
  runDirName: string
): Promise<void> {
  const pointer: LatestPointer = { path: runDirName };
  await writeFile(join(baseDir, LATEST_FILE), JSON.stringify(pointer, null, 2), "utf-8");
}

/**
 * Load the previous report from the latest.json pointer.
 * Returns null if no previous run exists.
 */
export async function loadPreviousReport(
  baseDir: string
): Promise<AuditReport | null> {
  try {
    const pointerContent = await readFile(join(baseDir, LATEST_FILE), "utf-8");
    const pointer: LatestPointer = JSON.parse(pointerContent);
    const reportPath = join(baseDir, pointer.path, "report.json");
    const reportContent = await readFile(reportPath, "utf-8");
    const report = JSON.parse(reportContent) as AuditReport;
    // Restore Date object
    report.timestamp = new Date(report.timestamp as unknown as string);
    return report;
  } catch {
    return null;
  }
}

/**
 * Prune old run directories, keeping the most recent `keepCount`.
 */
export async function pruneOldRuns(
  baseDir: string,
  keepCount = 10
): Promise<number> {
  try {
    const entries = await readdir(baseDir, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort(); // ISO timestamps sort lexicographically

    if (dirs.length <= keepCount) return 0;

    const toDelete = dirs.slice(0, dirs.length - keepCount);
    for (const dir of toDelete) {
      await rm(join(baseDir, dir), { recursive: true });
    }
    return toDelete.length;
  } catch {
    return 0;
  }
}
