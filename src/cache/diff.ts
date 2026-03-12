import type { AuditReport, CheckRunResult, Finding } from "../checks/types.js";

export interface DriftFinding {
  checkId: string;
  checkName: string;
  severity: string;
  resource: string;
  detail: string;
}

export interface DriftResult {
  newFindings: DriftFinding[];
  resolvedFindings: DriftFinding[];
  unchangedCount: number;
  hasPrevious: boolean;
}

function findingKey(checkId: string, resource: string): string {
  return `${checkId}::${resource}`;
}

function extractFindings(report: AuditReport): Map<string, DriftFinding> {
  const map = new Map<string, DriftFinding>();
  for (const r of report.results) {
    if (r.result.status !== "fail" && r.result.status !== "warn") continue;
    for (const f of r.result.findings ?? []) {
      const key = findingKey(r.meta.id, f.resource);
      map.set(key, {
        checkId: r.meta.id,
        checkName: r.meta.name,
        severity: r.meta.severity,
        resource: f.resource,
        detail: f.detail,
      });
    }
  }
  return map;
}

/**
 * Compare current run against a previous run to detect drift.
 * If no previous report, all current findings are "new".
 */
export function compareDrift(
  current: AuditReport,
  previous: AuditReport | null
): DriftResult {
  const currentFindings = extractFindings(current);

  if (!previous) {
    return {
      newFindings: [...currentFindings.values()],
      resolvedFindings: [],
      unchangedCount: 0,
      hasPrevious: false,
    };
  }

  const previousFindings = extractFindings(previous);
  const newFindings: DriftFinding[] = [];
  const resolvedFindings: DriftFinding[] = [];
  let unchangedCount = 0;

  // New = in current but not in previous
  for (const [key, finding] of currentFindings) {
    if (previousFindings.has(key)) {
      unchangedCount++;
    } else {
      newFindings.push(finding);
    }
  }

  // Resolved = in previous but not in current
  for (const [key, finding] of previousFindings) {
    if (!currentFindings.has(key)) {
      resolvedFindings.push(finding);
    }
  }

  return { newFindings, resolvedFindings, unchangedCount, hasPrevious: true };
}
