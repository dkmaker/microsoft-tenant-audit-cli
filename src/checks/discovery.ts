import { glob } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { CheckModule } from "./types.js";

export interface DiscoverOptions {
  /** Base directory containing compiled check files (default: dist/checks) */
  checksDir?: string;
  /** Filter to specific categories */
  categories?: string[];
  /** Filter to specific services */
  services?: string[];
}

/**
 * Discover check modules from category subdirectories.
 * Looks for files matching `check-*.js` and validates they export `meta` + `run`.
 */
export async function discoverChecks(options?: DiscoverOptions): Promise<CheckModule[]> {
  const checksDir = options?.checksDir ?? path.resolve("dist", "checks");
  const pattern = path.join(checksDir, "**", "check-*.js");

  const modules: CheckModule[] = [];

  for await (const file of glob(pattern)) {
    const url = pathToFileURL(path.resolve(file)).href;

    try {
      const mod = await import(url);

      if (!isValidCheckModule(mod)) {
        console.warn(`[discovery] Skipping ${file}: missing or invalid 'meta' or 'run' export`);
        continue;
      }

      // Apply category filter if specified
      if (options?.categories && !options.categories.includes(mod.meta.category)) {
        continue;
      }

      // Apply service filter if specified
      if (options?.services && !options.services.includes(mod.meta.service)) {
        continue;
      }

      modules.push({ meta: mod.meta, run: mod.run });
    } catch (err) {
      console.warn(`[discovery] Failed to load ${file}:`, (err as Error).message);
    }
  }

  return modules;
}

function isValidCheckModule(mod: unknown): mod is CheckModule {
  if (typeof mod !== "object" || mod === null) return false;
  const m = mod as Record<string, unknown>;
  return (
    typeof m.meta === "object" &&
    m.meta !== null &&
    typeof (m.meta as Record<string, unknown>).id === "string" &&
    typeof m.run === "function"
  );
}
