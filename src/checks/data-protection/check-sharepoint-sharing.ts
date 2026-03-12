import type { CheckMeta, CheckResult, CheckContext, Finding } from "../types.js";

export const meta: CheckMeta = {
  id: "data-protection-001",
  name: "SharePoint Tenant Sharing Settings",
  category: "data-protection",
  severity: "high",
  service: "SharePoint Online",
  frameworks: [{ name: "CIS M365 v3.1", control: "7.2.1" }],
  remediation: {
    description: "Restrict external sharing to authenticated guests only. Disable 'Anyone' links on sensitive sites.",
    reference: "https://learn.microsoft.com/en-us/sharepoint/turn-external-sharing-on-or-off",
    script: "Set-SPOTenant -SharingCapability ExternalUserSharingOnly\n# Per-site: Set-SPOSite -Identity <url> -SharingCapability ExternalUserSharingOnly",
  },
};

/**
 * SharePoint sharing capability levels, from most restrictive to most permissive.
 */
const SHARING_CAPABILITY_RISK: Record<string, { level: string; description: string }> = {
  disabled: { level: "none", description: "External sharing disabled" },
  existingExternalUserSharingOnly: { level: "low", description: "Only existing external users (must be in directory)" },
  externalUserSharingOnly: { level: "medium", description: "New and existing external users (must authenticate)" },
  externalUserAndGuestSharing: { level: "high", description: "Anyone, including anonymous guest links" },
};

interface SharePointSettings {
  sharingCapability: string;
  isResharingByExternalUsersEnabled: boolean;
  sharingDomainRestrictionMode: string;
  sharingAllowedDomainList: string[];
  sharingBlockedDomainList: string[];
  idleSessionSignOut: {
    isEnabled: boolean;
    warnAfterInSeconds: number;
    signOutAfterInSeconds: number;
  };
}

export async function run(ctx: CheckContext): Promise<CheckResult> {
  const { graphClient } = ctx;
  const findings: Finding[] = [];

  let settings: SharePointSettings;
  try {
    settings = await graphClient
      .api("/admin/sharepoint/settings")
      .version("beta")
      .get();
  } catch (err) {
    return {
      status: "error",
      message: `Failed to read SharePoint settings: ${(err as Error).message}`,
    };
  }

  // 1. Check sharing capability level
  const sharingRisk = SHARING_CAPABILITY_RISK[settings.sharingCapability];
  if (!sharingRisk) {
    findings.push({
      resource: "tenant:sharepoint",
      detail: `Unknown sharing capability value: ${settings.sharingCapability}`,
    });
  } else if (sharingRisk.level === "high") {
    findings.push({
      resource: "tenant:sharepoint",
      detail: `Sharing capability is most permissive: "${settings.sharingCapability}" — ${sharingRisk.description}`,
    });
  } else if (sharingRisk.level === "medium") {
    findings.push({
      resource: "tenant:sharepoint",
      detail: `Sharing capability allows new external users: "${settings.sharingCapability}" — ${sharingRisk.description}`,
    });
  }

  // 2. Check if external users can reshare
  if (settings.isResharingByExternalUsersEnabled) {
    findings.push({
      resource: "tenant:sharepoint",
      detail: "External users can reshare content they have access to",
    });
  }

  // 3. Check domain restriction when sharing is enabled
  if (
    settings.sharingCapability !== "disabled" &&
    settings.sharingDomainRestrictionMode === "none"
  ) {
    findings.push({
      resource: "tenant:sharepoint",
      detail: `No domain restrictions on sharing (sharingDomainRestrictionMode: "none"). Consider using an allow-list or block-list.`,
    });
  }

  // 4. Check idle session sign-out
  if (!settings.idleSessionSignOut.isEnabled) {
    findings.push({
      resource: "tenant:sharepoint",
      detail: "Idle session sign-out is not enabled for SharePoint",
    });
  }

  if (findings.length === 0) {
    return {
      status: "pass",
      message: `SharePoint sharing is configured securely (capability: ${settings.sharingCapability})`,
    };
  }

  // Determine severity: high-risk sharing = fail, medium-risk = warn
  const hasHighRisk = sharingRisk?.level === "high" || settings.isResharingByExternalUsersEnabled;

  return {
    status: hasHighRisk ? "fail" : "warn",
    message: `${findings.length} SharePoint sharing concern(s) found`,
    findings,
  };
}
