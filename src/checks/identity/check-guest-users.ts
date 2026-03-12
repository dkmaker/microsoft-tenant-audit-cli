import type { CheckMeta, CheckResult, CheckContext, Finding } from "../types.js";

export const meta: CheckMeta = {
  id: "identity-004",
  name: "Guest/External User Enumeration",
  category: "identity",
  severity: "medium",
  service: "Entra ID",
  frameworks: [{ name: "CIS M365 v3.1", control: "1.3.1" }],
};

export async function run(ctx: CheckContext): Promise<CheckResult> {
  const { graphClient } = ctx;
  const findings: Finding[] = [];

  // Get all guest users
  const guests: Array<{ id: string; displayName: string; mail: string }> = [];
  let nextLink: string | undefined = "/users?$filter=userType eq 'Guest'&$select=id,displayName,mail&$top=999";

  while (nextLink) {
    const response = await graphClient.api(nextLink).get();
    guests.push(...response.value);
    nextLink = response["@odata.nextLink"];
  }

  // Build set of guest IDs for fast lookup
  const guestIds = new Set(guests.map((g) => g.id));

  // Check which guests have admin roles
  const rolesResponse = await graphClient.api("/directoryRoles").get();
  const adminGuests: Array<{ guest: (typeof guests)[0]; roles: string[] }> = [];

  for (const role of rolesResponse.value as Array<{ id: string; displayName: string }>) {
    const membersResponse = await graphClient
      .api(`/directoryRoles/${role.id}/members`)
      .get();

    for (const member of membersResponse.value) {
      if (guestIds.has(member.id)) {
        const existing = adminGuests.find((ag) => ag.guest.id === member.id);
        if (existing) {
          existing.roles.push(role.displayName);
        } else {
          const guest = guests.find((g) => g.id === member.id)!;
          adminGuests.push({ guest, roles: [role.displayName] });
        }
      }
    }
  }

  // Finding: guest count info
  if (guests.length > 0) {
    findings.push({
      resource: "tenant",
      detail: `${guests.length} guest/external user(s) in the directory`,
    });
  }

  // Finding: guests with admin roles (critical)
  for (const ag of adminGuests) {
    findings.push({
      resource: `user:${ag.guest.mail || ag.guest.displayName}`,
      detail: `Guest user has admin role(s): ${ag.roles.join(", ")}`,
    });
  }

  if (guests.length === 0) {
    return {
      status: "pass",
      message: "No guest users found in the directory",
    };
  }

  return {
    status: adminGuests.length > 0 ? "fail" : "warn",
    message: `${guests.length} guest user(s) found${adminGuests.length > 0 ? `, ${adminGuests.length} with admin roles` : ""}`,
    findings,
  };
}
