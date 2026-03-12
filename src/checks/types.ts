import type { Client } from "@microsoft/microsoft-graph-client";
import type { AuditConfig } from "../config.js";

// --- Enums ---

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type CheckStatus = "pass" | "fail" | "warn" | "error";

// --- Check Metadata ---

export interface FrameworkMapping {
  /** Framework name, e.g. "CIS M365 v3.1", "NIST 800-53" */
  name: string;
  /** Control identifier, e.g. "1.1.1", "IA-2" */
  control: string;
}

export interface CheckMeta {
  /** Unique check identifier, e.g. "identity-001" */
  id: string;
  /** Human-readable check name */
  name: string;
  /** Category folder name, e.g. "identity", "data-protection" */
  category: string;
  /** Default severity when the check fails */
  severity: Severity;
  /** M365 service, e.g. "Entra ID", "Exchange Online" */
  service: string;
  /** Compliance framework mappings */
  frameworks: FrameworkMapping[];
}

// --- Check Execution ---

export interface Finding {
  /** Affected resource identifier, e.g. "user:john@example.com" */
  resource: string;
  /** Human-readable detail of the finding */
  detail: string;
}

export interface CheckResult {
  status: CheckStatus;
  message: string;
  findings?: Finding[];
}

export interface CheckContext {
  graphClient: Client;
  config: AuditConfig;
}

/**
 * A discovered check module — each check file exports `meta` and `run`.
 */
export interface CheckModule {
  meta: CheckMeta;
  run: (ctx: CheckContext) => Promise<CheckResult>;
}

// --- Report ---

export interface CheckRunResult {
  meta: CheckMeta;
  result: CheckResult;
  /** Execution duration in milliseconds */
  durationMs: number;
}

export interface AuditReport {
  timestamp: Date;
  results: CheckRunResult[];
  summary: {
    total: number;
    pass: number;
    fail: number;
    warn: number;
    error: number;
  };
}
