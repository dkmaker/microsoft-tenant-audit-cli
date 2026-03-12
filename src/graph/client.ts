import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import {
  TokenCredentialAuthenticationProvider,
} from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";
import type { AuditConfig } from "../config.js";

export function createGraphClient(config: AuditConfig): Client {
  const credential = new ClientSecretCredential(
    config.tenantId,
    config.clientId,
    config.clientSecret,
  );

  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ["https://graph.microsoft.com/.default"],
  });

  return Client.initWithMiddleware({ authProvider });
}
