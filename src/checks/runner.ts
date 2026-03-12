import { discoverChecks, type DiscoverOptions } from "./discovery.js";
import type {
  AuditReport,
  CheckContext,
  CheckModule,
  CheckRunResult,
  CheckStatus,
} from "./types.js";

export interface RunOptions extends DiscoverOptions {
  /** Called after each check completes */
  onProgress?: (completed: number, total: number, result: CheckRunResult) => void;
}

/**
 * Discover and run all checks, returning an aggregated AuditReport.
 */
export async function runChecks(
  ctx: CheckContext,
  options?: RunOptions,
): Promise<AuditReport> {
  const modules = await discoverChecks(options);
  const results: CheckRunResult[] = [];

  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i];
    const runResult = await executeCheck(mod, ctx);
    results.push(runResult);
    options?.onProgress?.(i + 1, modules.length, runResult);
  }

  return buildReport(results);
}

async function executeCheck(
  mod: CheckModule,
  ctx: CheckContext,
): Promise<CheckRunResult> {
  const start = performance.now();

  try {
    const result = await mod.run(ctx);
    return {
      meta: mod.meta,
      result,
      durationMs: Math.round(performance.now() - start),
    };
  } catch (err) {
    return {
      meta: mod.meta,
      result: {
        status: "error",
        message: `Check threw an error: ${(err as Error).message}`,
      },
      durationMs: Math.round(performance.now() - start),
    };
  }
}

function buildReport(results: CheckRunResult[]): AuditReport {
  const count = (status: CheckStatus) =>
    results.filter((r) => r.result.status === status).length;

  return {
    timestamp: new Date(),
    results,
    summary: {
      total: results.length,
      pass: count("pass"),
      fail: count("fail"),
      warn: count("warn"),
      error: count("error"),
    },
  };
}
