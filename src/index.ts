#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "./config.js";
import { createGraphClient } from "./graph/client.js";
import { AuditErrorCollector } from "./utils/errors.js";

const program = new Command()
  .name("o365-audit")
  .description("Office 365 Security Audit Framework")
  .version("1.0.0");

program
  .command("audit")
  .description("Run security audit checks against your Microsoft 365 tenant")
  .option("--output-dir <dir>", "Output directory for reports", "./output")
  .option("--categories <cats...>", "Categories to audit (identity, data-protection, access-control, threat-protection)")
  .action(async (options: { outputDir: string; categories?: string[] }) => {
    try {
      console.log("🔍 Office 365 Security Audit");
      console.log("============================\n");

      const config = loadConfig({
        outputDir: options.outputDir,
        categories: options.categories,
      });

      console.log(`📁 Output directory: ${config.outputDir}`);
      if (config.categories) {
        console.log(`📋 Categories: ${config.categories.join(", ")}`);
      } else {
        console.log("📋 Categories: all");
      }

      console.log("\n🔗 Connecting to Microsoft Graph...");
      const client = createGraphClient(config);

      const errorCollector = new AuditErrorCollector();

      // TODO: Permission validation (issue 0mcl9vkj)
      // TODO: Run audit checks

      console.log("\n✅ Audit framework initialized successfully.");
      errorCollector.printSummary();
    } catch (error) {
      console.error("\n❌ Fatal error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
