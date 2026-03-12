import type { CheckMeta, CheckResult, CheckContext } from "../types.js";

export const meta: CheckMeta = {
  id: "threat-protection-001",
  name: "Exchange Transport Rules (PowerShell Required)",
  category: "threat-protection",
  severity: "info",
  service: "Exchange Online",
  frameworks: [{ name: "CIS M365 v6", control: "2.1.1" }],
};

export async function run(_ctx: CheckContext): Promise<CheckResult> {
  return {
    status: "warn",
    message: "This check requires the ExchangeOnlineManagement PowerShell module — not available via Graph API",
    findings: [
      {
        resource: "powershell-stub",
        detail:
          "Run: Get-TransportRule | Select-Object Name, State, Mode, Priority, SentToScope, FromScope — look for rules forwarding mail externally or bypassing DLP",
      },
      {
        resource: "remediation",
        detail:
          "Install-Module ExchangeOnlineManagement; Connect-ExchangeOnline; then run the above command to audit transport rules",
      },
    ],
  };
}
