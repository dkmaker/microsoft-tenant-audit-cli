import type { CheckMeta, CheckResult, CheckContext, Finding } from "../types.js";

export const meta: CheckMeta = {
  id: "access-control-002",
  name: "Teams App Catalog Review",
  category: "access-control",
  severity: "medium",
  service: "Microsoft Teams",
  frameworks: [{ name: "CIS M365 v6", control: "5.1.6.2" }],
};

interface TeamsApp {
  id: string;
  displayName: string;
  distributionMethod: "store" | "organization" | "sideLoaded";
  externalId?: string;
}

export async function run(ctx: CheckContext): Promise<CheckResult> {
  const { graphClient } = ctx;
  const findings: Finding[] = [];

  // List all apps in the tenant catalog
  // Note: /appCatalogs/teamsApps does not support $top query parameter
  const apps: TeamsApp[] = [];
  let nextLink: string | undefined = "/appCatalogs/teamsApps";

  while (nextLink) {
    const response = await graphClient.api(nextLink).get();
    apps.push(...response.value);
    nextLink = response["@odata.nextLink"];
  }

  if (apps.length === 0) {
    return {
      status: "pass",
      message: "No apps found in Teams app catalog",
    };
  }

  const sideloaded = apps.filter((a) => a.distributionMethod === "sideLoaded");
  const orgApps = apps.filter((a) => a.distributionMethod === "organization");

  for (const app of sideloaded) {
    findings.push({
      resource: `app:${app.displayName}`,
      detail: `Sideloaded app (custom upload) — review for security compliance`,
    });
  }

  for (const app of orgApps) {
    findings.push({
      resource: `app:${app.displayName}`,
      detail: `Organization (tenant catalog) app — third-party, review permissions`,
    });
  }

  if (findings.length === 0) {
    return {
      status: "pass",
      message: `${apps.length} app(s) in catalog — all from the public store`,
    };
  }

  return {
    status: "warn",
    message: `${sideloaded.length} sideloaded and ${orgApps.length} organization app(s) found in Teams catalog`,
    findings,
  };
}
