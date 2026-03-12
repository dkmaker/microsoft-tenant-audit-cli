import type { CheckMeta, CheckResult, CheckContext, Finding } from "../types.js";

export const meta: CheckMeta = {
  id: "identity-003",
  name: "Conditional Access Policy Audit",
  category: "identity",
  severity: "high",
  service: "Entra ID",
  frameworks: [{ name: "CIS M365 v3.1", control: "5.2.2.3" }],
};

interface CAPolicy {
  id: string;
  displayName: string;
  state: "enabled" | "disabled" | "enabledForReportingButNotEnforced";
  conditions: {
    users: {
      includeUsers: string[];
      excludeUsers: string[];
      includeGroups: string[];
      excludeGroups: string[];
    };
  };
  grantControls: {
    builtInControls: string[];
  } | null;
}

export async function run(ctx: CheckContext): Promise<CheckResult> {
  const { graphClient } = ctx;
  const findings: Finding[] = [];

  const response = await graphClient
    .api("/identity/conditionalAccess/policies")
    .get();
  const policies: CAPolicy[] = response.value;

  if (policies.length === 0) {
    return {
      status: "fail",
      message: "No Conditional Access policies found",
      findings: [
        {
          resource: "tenant",
          detail: "No Conditional Access policies configured",
        },
      ],
    };
  }

  let disabledCount = 0;
  let reportOnlyCount = 0;
  let hasMfaForAllUsers = false;

  for (const policy of policies) {
    // Check for disabled policies
    if (policy.state === "disabled") {
      disabledCount++;
      findings.push({
        resource: `policy:${policy.displayName}`,
        detail: "Policy is disabled",
      });
      continue;
    }

    // Check for report-only policies
    if (policy.state === "enabledForReportingButNotEnforced") {
      reportOnlyCount++;
      findings.push({
        resource: `policy:${policy.displayName}`,
        detail: "Policy is in report-only mode (not enforced)",
      });
    }

    // Check if any enabled policy requires MFA for all users
    const grantControls = policy.grantControls?.builtInControls ?? [];
    const includesAllUsers = policy.conditions.users.includeUsers.includes("All");
    const requiresMfa = grantControls.includes("mfa");

    if (includesAllUsers && requiresMfa) {
      hasMfaForAllUsers = true;
    }

    // Flag policies targeting all users but with exclusion groups
    if (includesAllUsers && policy.conditions.users.excludeGroups.length > 0) {
      findings.push({
        resource: `policy:${policy.displayName}`,
        detail: `Targets all users but excludes ${policy.conditions.users.excludeGroups.length} group(s)`,
      });
    }
  }

  // Global check: is there at least one policy requiring MFA for all users?
  if (!hasMfaForAllUsers) {
    findings.push({
      resource: "tenant",
      detail: "No enabled policy requires MFA for all users",
    });
  }

  const enabledCount = policies.length - disabledCount;
  const status = findings.length === 0 ? "pass" : "warn";

  return {
    status,
    message:
      status === "pass"
        ? `${enabledCount} CA policies configured and healthy`
        : `${findings.length} finding(s) across ${policies.length} CA policies (${enabledCount} enabled, ${disabledCount} disabled, ${reportOnlyCount} report-only)`,
    findings,
  };
}
