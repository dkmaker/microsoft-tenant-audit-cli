import type { AuditReport, CheckRunResult, Severity } from "../checks/types.js";
import type { DriftResult } from "../cache/diff.js";

// --- Color palette (color-blind friendly) ---

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "#D32F2F",
  high: "#E65100",
  medium: "#F9A825",
  low: "#1565C0",
  info: "#757575",
};

const SERVICE_COLORS: Record<string, string> = {
  "Entra ID": "#1565C0",
  "Exchange Online": "#E65100",
  SharePoint: "#2E7D32",
  Teams: "#7B1FA2",
};

// --- Aggregation helpers ---

interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

function countBySeverity(results: CheckRunResult[]): SeverityCounts {
  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const r of results) {
    if (r.result.status === "fail" || r.result.status === "warn") {
      counts[r.meta.severity] += r.result.findings?.length ?? 1;
    }
  }
  return counts;
}

function countByField(results: CheckRunResult[], field: "service" | "category"): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of results) {
    const key = r.meta[field];
    const findingCount =
      r.result.status === "fail" || r.result.status === "warn"
        ? (r.result.findings?.length ?? 1)
        : 0;
    counts.set(key, (counts.get(key) ?? 0) + findingCount);
  }
  return counts;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusBadge(status: string): string {
  return `<span class="badge ${escapeHtml(status)}">${escapeHtml(status.toUpperCase())}</span>`;
}

// --- Detail table rows ---

function renderCheckRows(results: CheckRunResult[]): string {
  return results
    .map((r) => {
      const findings = r.result.findings ?? [];
      const findingCount = findings.length;
      const frameworks = r.meta.frameworks
        .map((f) => `${escapeHtml(f.name)} ${escapeHtml(f.control)}`)
        .join(", ");

      const rem = r.meta.remediation;
      const remediationHtml = rem
        ? `<div class="remediation">
              <strong>Remediation:</strong> ${escapeHtml(rem.description)}
              ${rem.reference ? `<br><a href="${escapeHtml(rem.reference)}" target="_blank" rel="noopener">📖 Documentation</a>` : ""}
              ${rem.script ? `<pre class="script">${escapeHtml(rem.script)}</pre>` : ""}
            </div>`
        : "";

      const findingsHtml =
        findingCount > 0 || rem
          ? `<details>
              <summary>${findingCount} finding${findingCount !== 1 ? "s" : ""}${rem ? " · has remediation" : ""}</summary>
              ${findings
                .map(
                  (f) =>
                    `<div class="finding"><strong>${escapeHtml(f.resource)}</strong> — ${escapeHtml(f.detail)}</div>`
                )
                .join("\n              ")}
              ${remediationHtml}
            </details>`
          : "";

      return `<tr>
        <td>
          ${escapeHtml(r.meta.name)}
          ${findingsHtml}
        </td>
        <td>${escapeHtml(r.meta.service)}</td>
        <td>${statusBadge(r.result.status)}</td>
        <td><span class="severity-tag ${r.meta.severity}">${escapeHtml(r.meta.severity)}</span></td>
        <td>${findingCount}</td>
        <td>${frameworks || "—"}</td>
      </tr>`;
    })
    .join("\n");
}

// --- Main template ---

function renderDriftSection(drift: DriftResult | undefined): string {
  if (!drift || !drift.hasPrevious) return "";
  return `
  <div class="drift-section">
    <h2>📈 Drift Since Last Run</h2>
    <div class="summary-cards">
      <div class="card" style="border-top: 3px solid var(--critical)"><div class="count" style="color: var(--critical)">${drift.newFindings.length}</div><div class="label">New Findings</div></div>
      <div class="card" style="border-top: 3px solid #2E7D32"><div class="count" style="color: #2E7D32">${drift.resolvedFindings.length}</div><div class="label">Resolved</div></div>
      <div class="card"><div class="count">${drift.unchangedCount}</div><div class="label">Unchanged</div></div>
    </div>
    ${drift.newFindings.length > 0 ? `
    <h3 style="margin: 1rem 0 0.5rem; color: var(--critical);">🆕 New Findings</h3>
    <table>
      <thead><tr><th>Check</th><th>Severity</th><th>Resource</th><th>Detail</th></tr></thead>
      <tbody>${drift.newFindings.map((f) => `<tr><td>${escapeHtml(f.checkName)}</td><td><span class="severity-tag ${f.severity}">${escapeHtml(f.severity)}</span></td><td>${escapeHtml(f.resource)}</td><td>${escapeHtml(f.detail)}</td></tr>`).join("")}</tbody>
    </table>` : ""}
    ${drift.resolvedFindings.length > 0 ? `
    <h3 style="margin: 1rem 0 0.5rem; color: #2E7D32;">✅ Resolved Findings</h3>
    <table>
      <thead><tr><th>Check</th><th>Severity</th><th>Resource</th><th>Detail</th></tr></thead>
      <tbody>${drift.resolvedFindings.map((f) => `<tr><td>${escapeHtml(f.checkName)}</td><td><span class="severity-tag ${f.severity}">${escapeHtml(f.severity)}</span></td><td>${escapeHtml(f.resource)}</td><td>${escapeHtml(f.detail)}</td></tr>`).join("")}</tbody>
    </table>` : ""}
  </div>`;
}

export function generateHtmlReport(report: AuditReport, drift?: DriftResult): string {
  const severity = countBySeverity(report.results);
  const byService = countByField(report.results, "service");
  const byCategory = countByField(report.results, "category");

  const serviceLabels = JSON.stringify([...byService.keys()]);
  const serviceData = JSON.stringify([...byService.values()]);
  const serviceColors = JSON.stringify(
    [...byService.keys()].map((k) => SERVICE_COLORS[k] ?? "#9E9E9E")
  );

  const categoryLabels = JSON.stringify([...byCategory.keys()]);
  const categoryData = JSON.stringify([...byCategory.values()]);

  const timestamp =
    report.timestamp instanceof Date
      ? report.timestamp.toISOString()
      : String(report.timestamp);

  const totalFindings =
    severity.critical + severity.high + severity.medium + severity.low + severity.info;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>M365 Security Audit Report</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.js"><\/script>
  <style>
    :root {
      --critical: ${SEVERITY_COLORS.critical};
      --high: ${SEVERITY_COLORS.high};
      --medium: ${SEVERITY_COLORS.medium};
      --low: ${SEVERITY_COLORS.low};
      --info: ${SEVERITY_COLORS.info};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; color: #333; padding: 2rem; max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
    h2 { font-size: 1.1rem; margin-bottom: 1rem; }
    .subtitle { color: #666; margin-bottom: 2rem; font-size: 0.9rem; }
    .summary-cards { display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; }
    .card { background: white; border-radius: 8px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); min-width: 100px; text-align: center; flex: 1; }
    .card .count { font-size: 2rem; font-weight: bold; }
    .card .label { font-size: 0.75rem; color: #666; text-transform: uppercase; letter-spacing: 0.05em; }
    .card.critical .count { color: var(--critical); }
    .card.high .count { color: var(--high); }
    .card.medium .count { color: var(--medium); }
    .card.low .count { color: var(--low); }
    .card.info .count { color: var(--info); }
    .card.total .count { color: #333; }
    .card.pass .count { color: #2E7D32; }
    .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem; }
    .chart-container { background: white; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .chart-container h2 { margin-bottom: 0.75rem; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 2rem; }
    th, td { text-align: left; padding: 0.75rem 1rem; border-bottom: 1px solid #eee; font-size: 0.9rem; }
    th { background: #fafafa; font-size: 0.75rem; text-transform: uppercase; color: #666; letter-spacing: 0.05em; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 4px; color: white; font-size: 0.75rem; font-weight: 600; }
    .badge.pass { background: #2E7D32; }
    .badge.fail { background: var(--critical); }
    .badge.warn { background: var(--medium); color: #333; }
    .badge.error { background: #333; }
    .severity-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: capitalize; }
    .severity-tag.critical { background: #FFCDD2; color: #B71C1C; }
    .severity-tag.high { background: #FFE0B2; color: #BF360C; }
    .severity-tag.medium { background: #FFF9C4; color: #F57F17; }
    .severity-tag.low { background: #BBDEFB; color: #0D47A1; }
    .severity-tag.info { background: #E0E0E0; color: #424242; }
    details { margin-top: 0.5rem; }
    details summary { cursor: pointer; color: var(--low); font-size: 0.85rem; }
    .finding { background: #f9f9f9; padding: 0.5rem 0.75rem; margin: 0.25rem 0; border-left: 3px solid var(--low); font-size: 0.85rem; border-radius: 0 4px 4px 0; }
    .remediation { background: #E8F5E9; padding: 0.75rem; margin: 0.5rem 0 0.25rem; border-left: 3px solid #2E7D32; border-radius: 0 4px 4px 0; font-size: 0.85rem; }
    .remediation a { color: #1565C0; }
    .remediation .script { background: #263238; color: #ECEFF1; padding: 0.5rem 0.75rem; border-radius: 4px; margin-top: 0.5rem; font-size: 0.8rem; overflow-x: auto; white-space: pre-wrap; }
    .footer { text-align: center; color: #999; font-size: 0.8rem; margin-top: 2rem; }
    @media print {
      body { background: white; padding: 0; }
      .chart-container, .card, table { box-shadow: none; border: 1px solid #ddd; break-inside: avoid; }
    }
    @media (max-width: 768px) {
      .charts { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <h1>🛡️ M365 Security Audit Report</h1>
  <p class="subtitle">Generated: ${escapeHtml(timestamp)} · Checks run: ${report.summary.total}</p>

  <div class="summary-cards">
    <div class="card total"><div class="count">${totalFindings}</div><div class="label">Total Findings</div></div>
    <div class="card pass"><div class="count">${report.summary.pass}</div><div class="label">Passed</div></div>
    <div class="card critical"><div class="count">${severity.critical}</div><div class="label">Critical</div></div>
    <div class="card high"><div class="count">${severity.high}</div><div class="label">High</div></div>
    <div class="card medium"><div class="count">${severity.medium}</div><div class="label">Medium</div></div>
    <div class="card low"><div class="count">${severity.low}</div><div class="label">Low</div></div>
    <div class="card info"><div class="count">${severity.info}</div><div class="label">Info</div></div>
  </div>

  <div class="charts">
    <div class="chart-container">
      <h2>Severity Breakdown</h2>
      <canvas id="severityChart"></canvas>
    </div>
    <div class="chart-container">
      <h2>Findings by Service</h2>
      <canvas id="serviceChart"></canvas>
    </div>
    <div class="chart-container">
      <h2>Findings by Category</h2>
      <canvas id="categoryChart"></canvas>
    </div>
    <div class="chart-container">
      <h2>Check Results Overview</h2>
      <canvas id="resultsChart"></canvas>
    </div>
  </div>

  ${renderDriftSection(drift)}

  <h2>Check Details</h2>
  <table>
    <thead>
      <tr><th>Check</th><th>Service</th><th>Status</th><th>Severity</th><th>Findings</th><th>Framework</th></tr>
    </thead>
    <tbody>
      ${renderCheckRows(report.results)}
    </tbody>
  </table>

  <p class="footer">Generated by Office 365 Audit Framework</p>

  <script>
    // Severity doughnut
    new Chart(document.getElementById('severityChart'), {
      type: 'doughnut',
      data: {
        labels: ['Critical', 'High', 'Medium', 'Low', 'Info'],
        datasets: [{
          data: [${severity.critical}, ${severity.high}, ${severity.medium}, ${severity.low}, ${severity.info}],
          backgroundColor: ['${SEVERITY_COLORS.critical}', '${SEVERITY_COLORS.high}', '${SEVERITY_COLORS.medium}', '${SEVERITY_COLORS.low}', '${SEVERITY_COLORS.info}']
        }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });

    // Service bar chart
    new Chart(document.getElementById('serviceChart'), {
      type: 'bar',
      data: {
        labels: ${serviceLabels},
        datasets: [{
          label: 'Findings',
          data: ${serviceData},
          backgroundColor: ${serviceColors}
        }]
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });

    // Category bar chart
    new Chart(document.getElementById('categoryChart'), {
      type: 'bar',
      data: {
        labels: ${categoryLabels},
        datasets: [{
          label: 'Findings',
          data: ${categoryData},
          backgroundColor: '#1565C0'
        }]
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });

    // Results overview doughnut
    new Chart(document.getElementById('resultsChart'), {
      type: 'doughnut',
      data: {
        labels: ['Pass', 'Fail', 'Warn', 'Error'],
        datasets: [{
          data: [${report.summary.pass}, ${report.summary.fail}, ${report.summary.warn}, ${report.summary.error}],
          backgroundColor: ['#2E7D32', '${SEVERITY_COLORS.critical}', '${SEVERITY_COLORS.medium}', '#333']
        }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  <\/script>
</body>
</html>`;
}
