export type CheckSeverity = "critical" | "high" | "medium" | "low" | "info";

export type CheckStatus = "pass" | "fail" | "warn" | "error";

export interface CheckResult {
  checkId: string;
  name: string;
  category: string;
  status: CheckStatus;
  severity: CheckSeverity;
  message: string;
  details?: string;
}

export interface AuditCheck {
  id: string;
  name: string;
  category: string;
  severity: CheckSeverity;
  run(): Promise<CheckResult>;
}
