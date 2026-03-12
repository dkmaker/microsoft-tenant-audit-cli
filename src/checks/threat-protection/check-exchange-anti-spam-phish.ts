import type { CheckMeta, CheckResult, CheckContext } from "../types.js";

export const meta: CheckMeta = {
  id: "threat-protection-002",
  name: "Exchange Anti-Spam & Anti-Phish Policies (PowerShell Required)",
  category: "threat-protection",
  severity: "info",
  service: "Exchange Online",
  frameworks: [{ name: "CIS M365 v6", control: "2.1.4" }],
};

export async function run(_ctx: CheckContext): Promise<CheckResult> {
  return {
    status: "warn",
    message: "This check requires the ExchangeOnlineManagement PowerShell module — not available via Graph API",
    findings: [
      {
        resource: "powershell-stub:anti-spam",
        detail:
          "Run: Get-HostedContentFilterPolicy | Select-Object Identity, HighConfidencePhishAction, PhishSpamAction, BulkThreshold, MarkAsSpamBulkMail",
      },
      {
        resource: "powershell-stub:anti-phish",
        detail:
          "Run: Get-AntiPhishPolicy | Select-Object Identity, Enabled, PhishThresholdLevel, EnableMailboxIntelligenceProtection, ImpersonationProtectionState, TargetedUserProtectionAction",
      },
      {
        resource: "remediation",
        detail:
          "Install-Module ExchangeOnlineManagement; Connect-ExchangeOnline; then run the above commands to audit anti-spam and anti-phish policies",
      },
    ],
  };
}
