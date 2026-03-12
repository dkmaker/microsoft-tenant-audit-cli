/**
 * Integration test: generate both reports with realistic mock audit data.
 * Run with: npx tsx src/report/test-reports.ts
 */

import { readFile, rm } from "node:fs/promises";
import { generateReports } from "./index.js";
import type { AuditReport, CheckRunResult } from "../checks/types.js";

const mockResults: CheckRunResult[] = [
  // Identity checks — Entra ID
  {
    meta: { id: "identity-001", name: "MFA Status", category: "identity", severity: "critical", service: "Entra ID", frameworks: [{ name: "CIS M365 v3.1", control: "1.1.1" }], remediation: { description: "Enable MFA for all admin accounts using Conditional Access or per-user MFA settings.", reference: "https://learn.microsoft.com/en-us/entra/identity/authentication/howto-mfa-getstarted", script: "# Enable MFA via Conditional Access\nConnect-MgGraph -Scopes 'Policy.ReadWrite.ConditionalAccess'\n# Create CA policy requiring MFA for admins" } },
    result: { status: "fail", message: "MFA not enabled for 2 admin accounts", findings: [
      { resource: "user:admin@contoso.com", detail: "Global Admin without MFA enabled" },
      { resource: "user:helpdesk@contoso.com", detail: "Helpdesk Admin without MFA, last sign-in 3 days ago" },
    ]},
    durationMs: 320,
  },
  {
    meta: { id: "identity-002", name: "Conditional Access Policies", category: "identity", severity: "high", service: "Entra ID", frameworks: [{ name: "CIS M365 v3.1", control: "1.2.1" }] },
    result: { status: "pass", message: "All 5 conditional access policies are active" },
    durationMs: 180,
  },
  {
    meta: { id: "identity-003", name: "Guest User Review", category: "identity", severity: "medium", service: "Entra ID", frameworks: [{ name: "CIS M365 v3.1", control: "1.3.1" }] },
    result: { status: "warn", message: "3 guest users with stale access", findings: [
      { resource: "user:vendor1@external.com", detail: "Last sign-in 90+ days ago" },
      { resource: "user:contractor@partner.com", detail: "Last sign-in 120+ days ago" },
      { resource: "user:temp@agency.com", detail: "Never signed in, created 60 days ago" },
    ]},
    durationMs: 250,
  },
  {
    meta: { id: "identity-004", name: "App Registrations", category: "identity", severity: "high", service: "Entra ID", frameworks: [{ name: "CIS M365 v3.1", control: "1.4.1" }], remediation: { description: "Review and reduce app permissions to least-privilege. Remove unused app registrations.", reference: "https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/manage-application-permissions", script: "Get-MgApplication | Select-Object DisplayName, Id\n# Review each app's API permissions and remove excessive grants" } },
    result: { status: "fail", message: "2 apps with excessive permissions", findings: [
      { resource: "app:Legacy Sync Tool", detail: "Has Directory.ReadWrite.All — overly broad" },
      { resource: "app:Test App (dev)", detail: "Has Mail.ReadWrite + Sites.FullControl, expired certificate" },
    ]},
    durationMs: 410,
  },
  // Data Protection — Exchange + SharePoint
  {
    meta: { id: "data-001", name: "SharePoint External Sharing", category: "data-protection", severity: "medium", service: "SharePoint", frameworks: [{ name: "CIS M365 v3.1", control: "3.1.1" }], remediation: { description: "Restrict external sharing to authenticated guests only. Disable 'Anyone' links on sensitive sites.", reference: "https://learn.microsoft.com/en-us/sharepoint/turn-external-sharing-on-or-off", script: "Set-SPOSite -Identity https://contoso.sharepoint.com/sites/payroll -SharingCapability ExternalUserSharingOnly" } },
    result: { status: "warn", message: "External sharing enabled at org level", findings: [
      { resource: "site:hr.sharepoint.com/sites/payroll", detail: "Anyone links enabled on sensitive site" },
      { resource: "site:contoso.sharepoint.com/sites/board", detail: "External sharing enabled, contains board documents" },
    ]},
    durationMs: 300,
  },
  {
    meta: { id: "data-002", name: "Inbox Forwarding Rules", category: "data-protection", severity: "high", service: "Exchange Online", frameworks: [{ name: "CIS M365 v3.1", control: "3.2.1" }], remediation: { description: "Disable external auto-forwarding via transport rule or per-mailbox setting.", reference: "https://learn.microsoft.com/en-us/exchange/policy-and-compliance/mail-flow-rules/mail-flow-rules", script: "Set-Mailbox -Identity finance@contoso.com -DeliverToMailboxAndForward $false -ForwardingSmtpAddress $null" } },
    result: { status: "fail", message: "1 mailbox with external forwarding", findings: [
      { resource: "user:finance@contoso.com", detail: "Auto-forwarding to personal@gmail.com" },
    ]},
    durationMs: 280,
  },
  {
    meta: { id: "data-003", name: "Site Permissions Audit", category: "data-protection", severity: "low", service: "SharePoint", frameworks: [] },
    result: { status: "pass", message: "All sites have appropriate permission levels" },
    durationMs: 450,
  },
  // Access Control — Teams
  {
    meta: { id: "access-001", name: "Teams Guest Access", category: "access-control", severity: "medium", service: "Teams", frameworks: [{ name: "CIS M365 v3.1", control: "4.1.1" }] },
    result: { status: "warn", message: "Guest access enabled globally", findings: [
      { resource: "policy:global", detail: "Guest access enabled — guests can start meetings and use chat" },
    ]},
    durationMs: 150,
  },
  {
    meta: { id: "access-002", name: "Teams App Policies", category: "access-control", severity: "low", service: "Teams", frameworks: [] },
    result: { status: "pass", message: "Third-party apps restricted to approved list" },
    durationMs: 120,
  },
  {
    meta: { id: "access-003", name: "Teams Meeting Policies", category: "access-control", severity: "info", service: "Teams", frameworks: [] },
    result: { status: "pass", message: "Anonymous join disabled, lobby enforced" },
    durationMs: 90,
  },
  // Threat Protection — Exchange
  {
    meta: { id: "threat-001", name: "Anti-Spam & Phish Policies", category: "threat-protection", severity: "high", service: "Exchange Online", frameworks: [{ name: "CIS M365 v3.1", control: "5.1.1" }, { name: "NIST 800-53", control: "SI-8" }] },
    result: { status: "pass", message: "All anti-spam and anti-phish policies are active" },
    durationMs: 200,
  },
  {
    meta: { id: "threat-002", name: "Transport Rules Review", category: "threat-protection", severity: "medium", service: "Exchange Online", frameworks: [{ name: "CIS M365 v3.1", control: "5.2.1" }] },
    result: { status: "warn", message: "1 transport rule may bypass protections", findings: [
      { resource: "rule:Legacy Exception", detail: "Bypasses spam filtering for external domain partner.com — review if still needed" },
    ]},
    durationMs: 170,
  },
];

const report: AuditReport = {
  timestamp: new Date(),
  results: mockResults,
  summary: {
    total: mockResults.length,
    pass: mockResults.filter((r) => r.result.status === "pass").length,
    fail: mockResults.filter((r) => r.result.status === "fail").length,
    warn: mockResults.filter((r) => r.result.status === "warn").length,
    error: mockResults.filter((r) => r.result.status === "error").length,
  },
};

// --- Run ---

async function main() {
  const baseDir = "/tmp/test-integration-reports";

  console.log("Generating reports with", report.summary.total, "checks...");
  console.log(`  Pass: ${report.summary.pass}, Fail: ${report.summary.fail}, Warn: ${report.summary.warn}, Error: ${report.summary.error}`);

  const { jsonPath, htmlPath } = await generateReports(report, baseDir);

  console.log("\nJSON:", jsonPath);
  console.log("HTML:", htmlPath);

  // Validate JSON
  const jsonContent = JSON.parse(await readFile(jsonPath, "utf-8"));
  const jsonChecks = [
    ["has timestamp", !!jsonContent.timestamp],
    ["has 12 results", jsonContent.results.length === 12],
    ["summary correct", jsonContent.summary.total === 12 && jsonContent.summary.fail === 3],
    ["has findings", jsonContent.results[0].result.findings?.length === 2],
    ["has frameworks", jsonContent.results[0].meta.frameworks.length > 0],
  ];

  // Validate HTML
  const html = await readFile(htmlPath, "utf-8");
  const htmlChecks = [
    ["4 canvas elements", (html.match(/<canvas/g) || []).length >= 4],
    ["4 Chart instances", (html.match(/new Chart/g) || []).length >= 4],
    ["all services present", ["Entra ID", "Exchange Online", "SharePoint", "Teams"].every((s) => html.includes(s))],
    ["all categories present", ["identity", "data-protection", "access-control", "threat-protection"].every((c) => html.includes(c))],
    ["finding details", html.includes("admin@contoso.com") && html.includes("finance@contoso.com")],
    ["CIS reference", html.includes("CIS M365 v3.1")],
    ["NIST reference", html.includes("NIST 800-53")],
    ["print support", html.includes("@media print")],
    ["severity cards", html.includes("Critical") && html.includes("High") && html.includes("Medium")],
    ["> 5KB", html.length > 5000],
    ["remediation text", html.includes("Enable MFA for all admin accounts")],
    ["remediation link", html.includes("https://learn.microsoft.com/en-us/entra/identity/authentication/howto-mfa-getstarted")],
    ["remediation script", html.includes("Connect-MgGraph")],
    ["remediation CSS", html.includes("remediation")],
  ];

  console.log("\n--- JSON Validation ---");
  for (const [name, ok] of jsonChecks) console.log(ok ? "✅" : "❌", name);

  console.log("\n--- HTML Validation ---");
  for (const [name, ok] of htmlChecks) console.log(ok ? "✅" : "❌", name);

  const allPassed = [...jsonChecks, ...htmlChecks].every((c) => c[1]);
  console.log(allPassed ? "\n✅ All integration checks passed!" : "\n❌ Some checks failed!");

  await rm(baseDir, { recursive: true });
  process.exit(allPassed ? 0 : 1);
}

main();
