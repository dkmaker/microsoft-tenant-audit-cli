#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { loadConfig } from "./config.js";
import { createGraphClient } from "./graph/client.js";
import { runChecks } from "./checks/runner.js";
import type { CheckRunResult, Severity } from "./checks/types.js";
import { AuditErrorCollector } from "./utils/errors.js";
import { generateReports } from "./report/index.js";
import { loadPreviousReport, updateLatestPointer, pruneOldRuns, compareDrift } from "./cache/index.js";
import { basename } from "node:path";

// --- Color helpers ---

const severityColor: Record<Severity, (s: string) => string> = {
  critical: pc.red,
  high: pc.red,
  medium: pc.yellow,
  low: pc.blue,
  info: pc.gray,
};

const statusIcon: Record<string, string> = {
  pass: pc.green("✅"),
  fail: pc.red("❌"),
  warn: pc.yellow("⚠️"),
  error: pc.red("💥"),
};

function severityTag(sev: Severity): string {
  return severityColor[sev](`[${sev.toUpperCase()}]`);
}

// --- CLI ---

interface AuditOptions {
  outputDir: string;
  categories?: string[];
  services?: string[];
  verbose: boolean;
  keepRuns: string;
}

const program = new Command()
  .name("o365-audit")
  .description("Office 365 Security Audit Framework")
  .version("1.0.0");

program
  .command("audit")
  .description("Run security audit checks against your Microsoft 365 tenant")
  .option("--output-dir <dir>", "Output directory for reports", "./output")
  .option("--categories <cats...>", "Categories to audit (identity, data-protection, access-control, threat-protection)")
  .option("--services <svcs...>", "Services to audit (\"Entra ID\", \"Exchange Online\", SharePoint, Teams)")
  .option("--verbose", "Show detailed per-finding output", false)
  .option("--keep-runs <n>", "Number of past runs to keep", "10")
  .action(async (options: AuditOptions) => {
    try {
      console.log(pc.bold("\n🛡️  Office 365 Security Audit"));
      console.log(pc.gray("═".repeat(40) + "\n"));

      const config = loadConfig({
        outputDir: options.outputDir,
        categories: options.categories,
      });

      console.log(`${pc.gray("📁 Output:")} ${config.outputDir}`);
      if (config.categories) {
        console.log(`${pc.gray("📋 Categories:")} ${config.categories.join(", ")}`);
      }
      if (options.services) {
        console.log(`${pc.gray("🔧 Services:")} ${options.services.join(", ")}`);
      }

      console.log(`\n${pc.gray("🔗 Connecting to Microsoft Graph...")}`);
      const client = createGraphClient(config);

      const errorCollector = new AuditErrorCollector();

      // Load previous report for drift comparison
      const previousReport = await loadPreviousReport(config.outputDir);
      if (previousReport) {
        console.log(pc.gray("📊 Previous run found — drift comparison enabled"));
      }

      console.log(pc.bold("\n🏃 Running checks...\n"));

      const report = await runChecks(
        { graphClient: client, config },
        {
          categories: config.categories,
          services: options.services,
          onProgress: (completed, total, result: CheckRunResult) => {
            const icon = statusIcon[result.result.status] ?? "?";
            const counter = pc.gray(`[${String(completed).padStart(String(total).length)}/${total}]`);
            const name = result.meta.name;
            const sev = severityTag(result.meta.severity);
            const time = pc.gray(`${result.durationMs}ms`);

            console.log(`  ${counter} ${icon} ${name} ${sev} ${time}`);

            if (options.verbose && result.result.findings?.length) {
              for (const f of result.result.findings) {
                console.log(pc.gray(`         → ${f.resource}: ${f.detail}`));
              }
            }
          },
        },
      );

      // Drift comparison
      const drift = compareDrift(report, previousReport);

      // Generate reports
      console.log(pc.gray("\n📝 Generating reports..."));
      const { jsonPath, htmlPath } = await generateReports(report, config.outputDir, drift);

      // Update cache
      const runDirName = basename(jsonPath.replace("/report.json", ""));
      await updateLatestPointer(config.outputDir, runDirName);
      const pruned = await pruneOldRuns(config.outputDir, parseInt(options.keepRuns, 10));

      // --- Summary ---
      const { summary } = report;
      console.log(pc.bold("\n═".repeat(40)));
      console.log(pc.bold("📊 Audit Summary\n"));

      console.log(`   Total checks:  ${pc.bold(String(summary.total))}`);
      console.log(`   ${pc.green("✅ Pass:")}       ${summary.pass}`);
      console.log(`   ${pc.red("❌ Fail:")}       ${summary.fail}`);
      console.log(`   ${pc.yellow("⚠️  Warn:")}       ${summary.warn}`);
      if (summary.error > 0) {
        console.log(`   ${pc.red("💥 Error:")}      ${summary.error}`);
      }

      // Severity breakdown of findings
      const findingsBySev: Record<string, number> = {};
      for (const r of report.results) {
        if (r.result.status === "fail" || r.result.status === "warn") {
          const count = r.result.findings?.length ?? 1;
          findingsBySev[r.meta.severity] = (findingsBySev[r.meta.severity] ?? 0) + count;
        }
      }
      if (Object.keys(findingsBySev).length > 0) {
        console.log(`\n   ${pc.bold("Findings by severity:")}`);
        for (const sev of ["critical", "high", "medium", "low", "info"] as Severity[]) {
          if (findingsBySev[sev]) {
            console.log(`   ${severityColor[sev](`  ${sev.padEnd(10)} ${findingsBySev[sev]}`)}`);
          }
        }
      }

      // Drift summary
      if (drift.hasPrevious) {
        console.log(`\n   ${pc.bold("Drift vs previous run:")}`);
        if (drift.newFindings.length > 0) {
          console.log(`   ${pc.red(`  🆕 New:       ${drift.newFindings.length}`)}`);
        }
        if (drift.resolvedFindings.length > 0) {
          console.log(`   ${pc.green(`  ✅ Resolved:  ${drift.resolvedFindings.length}`)}`);
        }
        console.log(`   ${pc.gray(`  ── Unchanged: ${drift.unchangedCount}`)}`);
      }

      console.log(`\n   ${pc.gray("JSON:")} ${jsonPath}`);
      console.log(`   ${pc.gray("HTML:")} ${htmlPath}`);
      if (pruned > 0) {
        console.log(`   ${pc.gray(`Pruned ${pruned} old run(s)`)}`);
      }

      console.log(pc.bold("\n" + "═".repeat(40)));

      errorCollector.printSummary();

      // Exit code based on severity
      const hasCriticalOrHigh = (findingsBySev["critical"] ?? 0) + (findingsBySev["high"] ?? 0) > 0;
      process.exit(hasCriticalOrHigh ? 1 : 0);
    } catch (error) {
      console.error(pc.red(`\n❌ Fatal error: ${error instanceof Error ? error.message : error}`));
      process.exit(2);
    }
  });

program.parse();
