import type { CheckMeta, CheckResult, CheckContext, Finding } from "../types.js";

export const meta: CheckMeta = {
  id: "access-control-001",
  name: "Teams Guest Member Detection",
  category: "access-control",
  severity: "medium",
  service: "Microsoft Teams",
  frameworks: [{ name: "CIS M365 v6", control: "5.1.6.2" }],
};

interface TeamInfo {
  id: string;
  displayName: string;
}

interface TeamMember {
  "@odata.type": string;
  id: string;
  displayName: string;
  email?: string;
  roles: string[];
}

export async function run(ctx: CheckContext): Promise<CheckResult> {
  const { graphClient } = ctx;
  const findings: Finding[] = [];

  // 1. List all teams (paginated)
  const teams: TeamInfo[] = [];
  let nextLink: string | undefined = "/teams?$select=id,displayName&$top=999";

  while (nextLink) {
    const response = await graphClient.api(nextLink).get();
    teams.push(...response.value);
    nextLink = response["@odata.nextLink"];
  }

  if (teams.length === 0) {
    return {
      status: "pass",
      message: "No teams found in the tenant",
    };
  }

  // 2. For each team, enumerate members and identify guests
  let totalGuests = 0;
  let teamsWithGuests = 0;

  for (const team of teams) {
    const guests: Array<{ displayName: string; email?: string }> = [];
    let membersLink: string | undefined = `/teams/${team.id}/members?$top=999`;

    while (membersLink) {
      const membersResponse = await graphClient.api(membersLink).get();
      const members = membersResponse.value as TeamMember[];

      for (const member of members) {
        // Guests have @odata.type ending with aadUserConversationMember and "guest" in roles,
        // or we can check the visibleHistoryStartDateTime or email domain.
        // The most reliable indicator is checking if the member's roles array is empty
        // (guests typically have no roles) combined with email domain check.
        // However, the Graph API also exposes a "guest" userType via additional properties.
        // We check for "#microsoft.graph.aadUserConversationMember" with guest role pattern.
        if (
          member["@odata.type"] === "#microsoft.graph.aadUserConversationMember" &&
          member.roles.length === 0 &&
          member.email &&
          member.email.includes("#EXT#")
        ) {
          guests.push({ displayName: member.displayName, email: member.email });
        }
      }

      membersLink = membersResponse["@odata.nextLink"];
    }

    if (guests.length > 0) {
      teamsWithGuests++;
      totalGuests += guests.length;

      findings.push({
        resource: `team:${team.displayName}`,
        detail: `${guests.length} guest(s): ${guests.map((g) => g.email || g.displayName).join(", ")}`,
      });
    }
  }

  if (totalGuests === 0) {
    return {
      status: "pass",
      message: `No guest members found across ${teams.length} team(s)`,
    };
  }

  return {
    status: "warn",
    message: `${totalGuests} guest member(s) found across ${teamsWithGuests} of ${teams.length} team(s)`,
    findings,
  };
}
