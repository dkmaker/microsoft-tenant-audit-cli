import { Client } from "@microsoft/microsoft-graph-client";

export interface PermissionProbe {
  name: string;
  endpoint: string;
  apiVersion?: "v1.0" | "beta";
}

export interface PermissionReport {
  valid: boolean;
  authenticated: boolean;
  missing: string[];
  errors: string[];
}

/** Core probes covering the main permission groups needed for audit */
export const CORE_PERMISSION_PROBES: PermissionProbe[] = [
  { name: "User.Read.All", endpoint: "/users?$top=1" },
  { name: "RoleManagement.Read.Directory", endpoint: "/directoryRoles" },
  { name: "Policy.Read.All", endpoint: "/identity/conditionalAccess/policies" },
  { name: "Application.Read.All", endpoint: "/applications?$top=1" },
  { name: "MailboxSettings.Read", endpoint: "/users?$top=1&$select=id" },
  { name: "SharePointTenantSettings.Read.All", endpoint: "/admin/sharepoint/settings", apiVersion: "beta" },
  { name: "Team.ReadBasic.All", endpoint: "/teams?$top=1" },
];

export async function validatePermissions(
  client: Client,
  probes: PermissionProbe[] = CORE_PERMISSION_PROBES,
): Promise<PermissionReport> {
  const report: PermissionReport = {
    valid: true,
    authenticated: false,
    missing: [],
    errors: [],
  };

  // Step 1: Test authentication with /organization
  try {
    await client.api("/organization").get();
    report.authenticated = true;
  } catch (error) {
    report.valid = false;
    report.authenticated = false;
    report.errors.push(
      `Authentication failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return report;
  }

  // Step 2: Probe each permission endpoint
  for (const probe of probes) {
    try {
      let request = client.api(probe.endpoint);
      if (probe.apiVersion === "beta") {
        request = request.version("beta");
      }
      await request.get();
    } catch (error: unknown) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 403) {
        report.missing.push(probe.name);
        report.valid = false;
      } else if (statusCode === 401) {
        report.missing.push(probe.name);
        report.valid = false;
      } else {
        // Non-permission error (e.g., 404, 500) — log but don't treat as missing permission
        report.errors.push(
          `[${probe.name}] Unexpected error: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  return report;
}

export function printPermissionReport(report: PermissionReport): void {
  if (!report.authenticated) {
    console.error("❌ Authentication failed. Check TENANT_ID, CLIENT_ID, and CLIENT_SECRET.");
    for (const err of report.errors) {
      console.error(`  ${err}`);
    }
    return;
  }

  console.log("✅ Authentication successful.");

  if (report.missing.length > 0) {
    console.warn(`\n⚠️  Missing permissions (${report.missing.length}):`);
    for (const perm of report.missing) {
      console.warn(`  ✗ ${perm}`);
    }
  }

  if (report.errors.length > 0) {
    console.warn(`\n⚠️  Permission probe errors (${report.errors.length}):`);
    for (const err of report.errors) {
      console.warn(`  ? ${err}`);
    }
  }

  if (report.valid) {
    console.log("✅ All required permissions are granted.");
  }
}
