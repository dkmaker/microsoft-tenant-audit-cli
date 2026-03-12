import type { CheckMeta, CheckResult, CheckContext } from "../types.js";

export const meta: CheckMeta = {
  id: "access-control-005",
  name: "Teams App Permission Policies (PowerShell Required)",
  category: "access-control",
  severity: "info",
  service: "Microsoft Teams",
  frameworks: [{ name: "CIS M365 v6", control: "5.1.6.2" }],
};

export async function run(_ctx: CheckContext): Promise<CheckResult> {
  return {
    status: "warn",
    message: "This check requires the MicrosoftTeams PowerShell module — not available via Graph API",
    findings: [
      {
        resource: "powershell-stub",
        detail:
          "Run: Get-CsTeamsAppPermissionPolicy | Select-Object Identity, DefaultCatalogAppsType, GlobalCatalogAppsType, PrivateCatalogAppsType",
      },
      {
        resource: "remediation",
        detail:
          "Install-Module MicrosoftTeams; Connect-MicrosoftTeams; then run the above command to audit app permission policies",
      },
    ],
  };
}
