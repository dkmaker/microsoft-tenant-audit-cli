import type { CheckMeta, CheckResult, CheckContext, Finding } from "../types.js";

export const meta: CheckMeta = {
  id: "identity-005",
  name: "App Registrations & Secrets",
  category: "identity",
  severity: "high",
  service: "Entra ID",
  frameworks: [{ name: "CIS M365 v3.1", control: "5.1" }],
};

const EXPIRY_WARNING_DAYS = 30;
const OVERPRIVILEGED_THRESHOLD = 5;

interface AppRegistration {
  id: string;
  displayName: string;
  passwordCredentials: Array<{
    displayName: string | null;
    endDateTime: string;
    keyId: string;
  }>;
  requiredResourceAccess: Array<{
    resourceAppId: string;
    resourceAccess: Array<{
      id: string;
      type: "Role" | "Scope";
    }>;
  }>;
}

export async function run(ctx: CheckContext): Promise<CheckResult> {
  const { graphClient } = ctx;
  const findings: Finding[] = [];
  const now = new Date();
  const warningDate = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 86400000);

  // Fetch all applications
  const apps: AppRegistration[] = [];
  let nextLink: string | undefined = "/applications?$top=999";

  while (nextLink) {
    const response = await graphClient.api(nextLink).get();
    apps.push(...response.value);
    nextLink = response["@odata.nextLink"];
  }

  for (const app of apps) {
    // Check secret expiry
    for (const cred of app.passwordCredentials) {
      const expiry = new Date(cred.endDateTime);
      const label = cred.displayName || cred.keyId.slice(0, 8);

      if (expiry < now) {
        findings.push({
          resource: `app:${app.displayName}`,
          detail: `Secret "${label}" expired on ${expiry.toISOString().split("T")[0]}`,
        });
      } else if (expiry < warningDate) {
        findings.push({
          resource: `app:${app.displayName}`,
          detail: `Secret "${label}" expires on ${expiry.toISOString().split("T")[0]} (within ${EXPIRY_WARNING_DAYS} days)`,
        });
      }
    }

    // Check for overprivileged apps (count app-level Role permissions)
    const roleCount = app.requiredResourceAccess.reduce(
      (sum, r) => sum + r.resourceAccess.filter((a) => a.type === "Role").length,
      0,
    );

    if (roleCount > OVERPRIVILEGED_THRESHOLD) {
      findings.push({
        resource: `app:${app.displayName}`,
        detail: `Has ${roleCount} app-level (Role) permissions (threshold: ${OVERPRIVILEGED_THRESHOLD})`,
      });
    }
  }

  if (findings.length === 0) {
    return {
      status: "pass",
      message: `${apps.length} app registration(s) reviewed — no issues found`,
    };
  }

  return {
    status: "warn",
    message: `${findings.length} finding(s) across ${apps.length} app registration(s)`,
    findings,
  };
}
