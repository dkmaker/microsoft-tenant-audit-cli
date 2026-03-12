import type { CheckMeta, CheckResult, CheckContext } from "../types.js";

export const meta: CheckMeta = {
  id: "access-control-004",
  name: "Teams Guest Access Settings (PowerShell Required)",
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
          "Run: Get-CsTeamsGuestMeetingConfiguration | Select-Object Identity, AllowIPVideo, ScreenSharingMode; Get-CsTeamsGuestCallingConfiguration | Select-Object Identity, AllowPrivateCalling",
      },
      {
        resource: "remediation",
        detail:
          "Install-Module MicrosoftTeams; Connect-MicrosoftTeams; then run the above commands to audit guest meeting/calling settings",
      },
    ],
  };
}
