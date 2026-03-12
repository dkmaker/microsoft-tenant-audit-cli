import type { CheckMeta, CheckResult, CheckContext } from "../types.js";

export const meta: CheckMeta = {
  id: "access-control-003",
  name: "Teams Meeting Policies (PowerShell Required)",
  category: "access-control",
  severity: "info",
  service: "Microsoft Teams",
  frameworks: [{ name: "CIS M365 v6", control: "8.5.1" }],
};

export async function run(_ctx: CheckContext): Promise<CheckResult> {
  return {
    status: "warn",
    message: "This check requires the MicrosoftTeams PowerShell module — not available via Graph API",
    findings: [
      {
        resource: "powershell-stub",
        detail:
          "Run: Get-CsTeamsMeetingPolicy | Select-Object Identity, AllowAnonymousUsersToStartMeeting, AutoAdmittedUsers, AllowCloudRecording, DetectSensitiveContentDuringScreenSharing, AllowMeetNow",
      },
      {
        resource: "remediation",
        detail:
          "Install-Module MicrosoftTeams; Connect-MicrosoftTeams; then run the above command to audit meeting policies",
      },
    ],
  };
}
