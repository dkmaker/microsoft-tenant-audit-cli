import type { CheckMeta, CheckResult, CheckContext, Finding } from "../types.js";

export const meta: CheckMeta = {
  id: "identity-001",
  name: "Privileged Role Assignments",
  category: "identity",
  severity: "critical",
  service: "Entra ID",
  frameworks: [
    { name: "CIS M365 v3.1", control: "1.1.1" },
    { name: "CIS M365 v3.1", control: "1.1.3" },
  ],
};

/** Roles considered highly privileged */
const HIGH_PRIVILEGE_ROLES = [
  "Global Administrator",
  "Privileged Role Administrator",
  "Privileged Authentication Administrator",
  "Exchange Administrator",
  "SharePoint Administrator",
  "Security Administrator",
  "User Administrator",
];

interface RoleMember {
  id: string;
  displayName: string;
  userPrincipalName: string;
}

interface RoleWithMembers {
  displayName: string;
  members: RoleMember[];
}

export async function run(ctx: CheckContext): Promise<CheckResult> {
  const { graphClient } = ctx;
  const findings: Finding[] = [];

  // Fetch all activated directory roles
  const rolesResponse = await graphClient.api("/directoryRoles").get();
  const roles: Array<{ id: string; displayName: string }> = rolesResponse.value;

  // Fetch members for each role
  const rolesWithMembers: RoleWithMembers[] = [];
  const userRoles = new Map<string, string[]>(); // userId → role names

  for (const role of roles) {
    const membersResponse = await graphClient
      .api(`/directoryRoles/${role.id}/members`)
      .get();

    const members: RoleMember[] = membersResponse.value
      .filter((m: Record<string, unknown>) => m["@odata.type"] === "#microsoft.graph.user")
      .map((m: Record<string, unknown>) => ({
        id: m.id as string,
        displayName: m.displayName as string,
        userPrincipalName: m.userPrincipalName as string,
      }));

    if (members.length > 0) {
      rolesWithMembers.push({ displayName: role.displayName, members });
    }

    for (const member of members) {
      const existing = userRoles.get(member.id) ?? [];
      existing.push(role.displayName);
      userRoles.set(member.id, existing);
    }
  }

  // Check 1: Global Admin count
  const globalAdmins = rolesWithMembers.find(
    (r) => r.displayName === "Global Administrator",
  );
  const globalAdminCount = globalAdmins?.members.length ?? 0;

  if (globalAdminCount > 4) {
    findings.push({
      resource: "role:Global Administrator",
      detail: `${globalAdminCount} Global Admins found (recommended: 2-4)`,
    });
  }

  if (globalAdminCount === 1) {
    findings.push({
      resource: "role:Global Administrator",
      detail: "Only 1 Global Admin — no backup admin exists",
    });
  }

  // Check 2: Users with multiple high-privilege roles
  for (const [userId, roleNames] of userRoles) {
    const highPrivRoles = roleNames.filter((r) => HIGH_PRIVILEGE_ROLES.includes(r));
    if (highPrivRoles.length > 1) {
      // Find user display info from any role's members
      let upn = userId;
      for (const rwm of rolesWithMembers) {
        const member = rwm.members.find((m) => m.id === userId);
        if (member) {
          upn = member.userPrincipalName;
          break;
        }
      }
      findings.push({
        resource: `user:${upn}`,
        detail: `Has ${highPrivRoles.length} privileged roles: ${highPrivRoles.join(", ")}`,
      });
    }
  }

  // Check 3: Flag each high-privilege role with members
  for (const rwm of rolesWithMembers) {
    if (HIGH_PRIVILEGE_ROLES.includes(rwm.displayName)) {
      for (const member of rwm.members) {
        findings.push({
          resource: `user:${member.userPrincipalName}`,
          detail: `Assigned to ${rwm.displayName}`,
        });
      }
    }
  }

  const status = findings.length === 0 ? "pass" : "warn";
  return {
    status,
    message:
      status === "pass"
        ? "Privileged role assignments look healthy"
        : `Found ${findings.length} privileged role finding(s) across ${rolesWithMembers.length} active roles`,
    findings,
  };
}
