import type { CheckMeta, CheckResult, CheckContext, Finding } from "../types.js";

export const meta: CheckMeta = {
  id: "identity-002",
  name: "MFA Enforcement Status",
  category: "identity",
  severity: "critical",
  service: "Entra ID",
  frameworks: [{ name: "CIS M365 v3.1", control: "5.2.2.1" }],
};

const PASSWORD_METHOD = "#microsoft.graph.passwordAuthenticationMethod";

export async function run(ctx: CheckContext): Promise<CheckResult> {
  const { graphClient } = ctx;
  const findings: Finding[] = [];

  // Get all activated directory roles and their members
  const rolesResponse = await graphClient.api("/directoryRoles").get();
  const roles: Array<{ id: string; displayName: string }> = rolesResponse.value;

  // Collect unique admin users
  const adminUsers = new Map<string, { displayName: string; upn: string; roles: string[] }>();

  for (const role of roles) {
    const membersResponse = await graphClient
      .api(`/directoryRoles/${role.id}/members`)
      .get();

    for (const m of membersResponse.value) {
      if (m["@odata.type"] !== "#microsoft.graph.user") continue;
      const existing = adminUsers.get(m.id);
      if (existing) {
        existing.roles.push(role.displayName);
      } else {
        adminUsers.set(m.id, {
          displayName: m.displayName,
          upn: m.userPrincipalName,
          roles: [role.displayName],
        });
      }
    }
  }

  // Check MFA for each admin
  let adminsWithoutMfa = 0;

  for (const [userId, user] of adminUsers) {
    try {
      const methodsResponse = await graphClient
        .api(`/users/${userId}/authentication/methods`)
        .get();

      const methods: Array<{ "@odata.type": string }> = methodsResponse.value;
      const hasMfa = methods.some((m) => m["@odata.type"] !== PASSWORD_METHOD);

      if (!hasMfa) {
        adminsWithoutMfa++;
        findings.push({
          resource: `user:${user.upn}`,
          detail: `No MFA methods registered. Roles: ${user.roles.join(", ")}`,
        });
      }
    } catch (err) {
      findings.push({
        resource: `user:${user.upn}`,
        detail: `Could not read auth methods: ${(err as Error).message}`,
      });
    }
  }

  if (findings.length === 0) {
    return {
      status: "pass",
      message: `All ${adminUsers.size} admin users have MFA methods registered`,
    };
  }

  return {
    status: adminsWithoutMfa > 0 ? "fail" : "warn",
    message: `${adminsWithoutMfa} of ${adminUsers.size} admin users lack MFA`,
    findings,
  };
}
