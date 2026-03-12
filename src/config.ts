import dotenv from "dotenv";

export interface AuditConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  outputDir: string;
  categories?: string[];
}

export function loadConfig(overrides?: Partial<Pick<AuditConfig, "outputDir" | "categories">>): AuditConfig {
  dotenv.config({ quiet: true });

  const tenantId = process.env.TENANT_ID;
  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;

  const missing: string[] = [];
  if (!tenantId) missing.push("TENANT_ID");
  if (!clientId) missing.push("CLIENT_ID");
  if (!clientSecret) missing.push("CLIENT_SECRET");

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
      `Ensure they are set in your .env file or environment.`
    );
  }

  return {
    tenantId: tenantId!,
    clientId: clientId!,
    clientSecret: clientSecret!,
    outputDir: overrides?.outputDir ?? process.env.OUTPUT_DIR ?? "./output",
    categories: overrides?.categories,
  };
}
