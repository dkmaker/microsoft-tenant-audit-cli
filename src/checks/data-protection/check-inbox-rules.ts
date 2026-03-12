import type { CheckMeta, CheckResult, CheckContext, Finding } from "../types.js";
import { getAllItems } from "../../graph/pagination.js";

export const meta: CheckMeta = {
  id: "data-protection-002",
  name: "Inbox Rules with External Forwarding",
  category: "data-protection",
  severity: "high",
  service: "Exchange Online",
  frameworks: [{ name: "CIS M365 v3.1", control: "6.2.1" }],
};

interface EmailAddress {
  emailAddress: {
    address: string;
    name?: string;
  };
}

interface MessageRule {
  id: string;
  displayName: string;
  isEnabled: boolean;
  actions: {
    forwardTo?: EmailAddress[];
    redirectTo?: EmailAddress[];
    forwardAsAttachmentTo?: EmailAddress[];
  };
}

interface User {
  id: string;
  userPrincipalName: string;
}

/**
 * Extract the domain from an email address.
 */
function getDomain(email: string): string {
  return email.split("@").pop()?.toLowerCase() ?? "";
}

/**
 * Get all verified domains for the tenant.
 */
async function getTenantDomains(ctx: CheckContext): Promise<Set<string>> {
  const org = await ctx.graphClient.api("/organization").select("verifiedDomains").get();
  const domains = new Set<string>();
  for (const o of org.value) {
    for (const d of o.verifiedDomains ?? []) {
      if (d.name) domains.add(d.name.toLowerCase());
    }
  }
  return domains;
}

/**
 * Check if any forwarding targets are external.
 */
function findExternalForwards(
  rule: MessageRule,
  tenantDomains: Set<string>,
): { type: string; address: string }[] {
  const external: { type: string; address: string }[] = [];

  const checkTargets = (targets: EmailAddress[] | undefined, type: string) => {
    if (!targets) return;
    for (const t of targets) {
      const addr = t.emailAddress?.address;
      if (addr && !tenantDomains.has(getDomain(addr))) {
        external.push({ type, address: addr });
      }
    }
  };

  checkTargets(rule.actions.forwardTo, "forwardTo");
  checkTargets(rule.actions.redirectTo, "redirectTo");
  checkTargets(rule.actions.forwardAsAttachmentTo, "forwardAsAttachment");

  return external;
}

export async function run(ctx: CheckContext): Promise<CheckResult> {
  const { graphClient } = ctx;
  const findings: Finding[] = [];

  // Get tenant domains to distinguish internal vs external
  let tenantDomains: Set<string>;
  try {
    tenantDomains = await getTenantDomains(ctx);
  } catch (err) {
    return {
      status: "error",
      message: `Failed to read tenant domains: ${(err as Error).message}`,
    };
  }

  // Get all users
  const users = await getAllItems<User>(graphClient, "/users?$select=id,userPrincipalName");

  let usersChecked = 0;
  let usersSkipped = 0;

  for (const user of users) {
    let rules: MessageRule[];
    try {
      const response = await graphClient
        .api(`/users/${user.id}/mailFolders/inbox/messageRules`)
        .get();
      rules = response.value ?? [];
      usersChecked++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404) {
        // No mailbox (unlicensed user)
        usersSkipped++;
        continue;
      }
      findings.push({
        resource: `user:${user.userPrincipalName}`,
        detail: `Failed to read inbox rules: ${(err as Error).message}`,
      });
      continue;
    }

    for (const rule of rules) {
      if (!rule.isEnabled) continue;

      const externalForwards = findExternalForwards(rule, tenantDomains);
      if (externalForwards.length > 0) {
        const targets = externalForwards
          .map((f) => `${f.type}:${f.address}`)
          .join(", ");
        findings.push({
          resource: `user:${user.userPrincipalName}`,
          detail: `Rule "${rule.displayName}" forwards externally to: ${targets}`,
        });
      }
    }
  }

  if (findings.length === 0) {
    return {
      status: "pass",
      message: `No external forwarding rules found (${usersChecked} mailboxes checked, ${usersSkipped} skipped — no mailbox)`,
    };
  }

  return {
    status: "fail",
    message: `${findings.length} external forwarding rule(s) found across ${usersChecked} mailboxes`,
    findings,
  };
}
