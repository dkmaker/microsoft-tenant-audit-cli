import type { CheckMeta, CheckResult, CheckContext, Finding } from "../types.js";
import { getAllItems } from "../../graph/pagination.js";

export const meta: CheckMeta = {
  id: "data-protection-003",
  name: "SharePoint Site Permissions Audit",
  category: "data-protection",
  severity: "medium",
  service: "SharePoint Online",
  frameworks: [{ name: "CIS M365 v3.1", control: "7.2.3" }],
};

interface Site {
  id: string;
  displayName: string;
  webUrl: string;
  isPersonalSite: boolean;
}

interface SitePermission {
  id: string;
  roles: string[];
  grantedToIdentitiesV2?: Array<{
    application?: { id: string; displayName: string };
    user?: { id: string; displayName: string; email?: string };
  }>;
  grantedToIdentities?: Array<{
    application?: { id: string; displayName: string };
    user?: { id: string; displayName: string };
  }>;
}

export async function run(ctx: CheckContext): Promise<CheckResult> {
  const { graphClient } = ctx;
  const findings: Finding[] = [];

  // Get all sites via beta endpoint
  let sites: Site[];
  try {
    sites = await getAllItems<Site>(graphClient, "/sites/getAllSites?$select=id,displayName,webUrl,isPersonalSite", "beta");
  } catch (err) {
    return {
      status: "error",
      message: `Failed to enumerate sites: ${(err as Error).message}`,
    };
  }

  // Filter to non-personal sites
  const teamSites = sites.filter((s) => !s.isPersonalSite);
  let sitesWithPermissions = 0;

  for (const site of teamSites) {
    let permissions: SitePermission[];
    try {
      const response = await graphClient
        .api(`/sites/${site.id}/permissions`)
        .get();
      permissions = response.value ?? [];
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 403) {
        continue;
      }
      findings.push({
        resource: `site:${site.displayName}`,
        detail: `Failed to read permissions: ${(err as Error).message}`,
      });
      continue;
    }

    if (permissions.length === 0) continue;
    sitesWithPermissions++;

    for (const perm of permissions) {
      const identities = perm.grantedToIdentitiesV2 ?? perm.grantedToIdentities ?? [];
      const roles = perm.roles.join(", ");

      for (const identity of identities) {
        const app = identity.application;
        if (app) {
          // Flag any application with write or fullcontrol
          const hasElevated = perm.roles.some(
            (r) => r.toLowerCase().includes("write") || r.toLowerCase().includes("fullcontrol") || r.toLowerCase() === "owner",
          );
          if (hasElevated) {
            findings.push({
              resource: `site:${site.displayName}`,
              detail: `App "${app.displayName}" (${app.id}) has elevated roles: ${roles}`,
            });
          }
        }
      }
    }
  }

  if (findings.length === 0) {
    return {
      status: "pass",
      message: `No elevated app permissions found across ${teamSites.length} team sites (${sitesWithPermissions} with permissions, ${sites.length - teamSites.length} personal sites excluded)`,
    };
  }

  return {
    status: "warn",
    message: `${findings.length} elevated site permission(s) found across ${teamSites.length} team sites`,
    findings,
  };
}
