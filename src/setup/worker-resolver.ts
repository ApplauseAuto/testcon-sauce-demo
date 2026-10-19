/**
 * Pure helpers used by `auth.setup.ts`. Extracted so they can be unit-tested
 * without a Playwright runtime.
 */

import * as os from 'node:os';
import type { Credential, CustomerConfig } from '../config/types';

/**
 * Parse `--workers=N` / `--workers N` / `-j=N` / `-j N` from process argv.
 * Returns `undefined` if not present.
 */
export function parseWorkersFromArgv(argv: string[]): number | undefined {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a) continue;
    const eqMatch = a.match(/^(--workers|-j)=(\d+)$/);
    if (eqMatch && eqMatch[2]) return parseInt(eqMatch[2], 10);
    if ((a === '--workers' || a === '-j') && i + 1 < argv.length) {
      const next = argv[i + 1];
      if (next && /^\d+$/.test(next)) return parseInt(next, 10);
    }
  }
  return undefined;
}

/**
 * Resolve effective worker count.
 *   1. `--workers=N` from argv wins.
 *   2. `customer.parallel.workers` (numeric) is next.
 *   3. `'auto'` resolves to `max(1, cpus)`. Playwright itself picks the actual
 *      worker count when `workers: undefined` is passed (see
 *      `buildBaseConfig`), using its own internal heuristic that varies by
 *      Playwright version and CI environment. Auth-file generation must
 *      never under-count relative to that, so this uses the full CPU count
 *      as a safe upper bound rather than trying to replicate Playwright's
 *      exact (and unstable) algorithm.
 *
 * Optionally caps to the size of the credentials pool — no point creating more
 * auth files than we have accounts for. Pool sizing is taken from the env loader's
 * `credentials.filter(c => c.role === role).length` for the most populous role.
 */
export function resolveWorkerCount(
  argv: string[],
  customer: CustomerConfig,
  maxPoolSize: number = Number.POSITIVE_INFINITY,
): number {
  const argvN = parseWorkersFromArgv(argv);
  let n: number;
  if (typeof argvN === 'number') n = argvN;
  else if (typeof customer.parallel.workers === 'number') n = customer.parallel.workers;
  else n = Math.max(1, os.cpus().length);

  if (n < 1) n = 1;
  if (maxPoolSize > 0 && n > maxPoolSize) n = maxPoolSize;
  return n;
}

/**
 * Smallest per-role credential pool size across all roles present in
 * `credentials` — the number of `resolveWorkerCount` call sites (currently
 * `auth.setup.ts` and the `authFile` fixture in `fixtures/base.ts`) must
 * agree on, so it's factored out here rather than duplicated.
 */
export function minCredentialPoolSize(credentials: readonly Credential[]): number {
  const countsByRole = new Map<string, number>();
  for (const c of credentials) {
    countsByRole.set(c.role, (countsByRole.get(c.role) ?? 0) + 1);
  }
  const counts = Array.from(countsByRole.values());
  return counts.length > 0 ? Math.min(...counts) : Number.POSITIVE_INFINITY;
}

/**
 * The exact worker count `auth.setup.ts` used to decide how many
 * `.auth/user-<role>-<i>.json` files to write, computed from the same
 * inputs. Playwright's real `testInfo.workerIndex` can exceed this (e.g. it
 * hands out a fresh, never-reused index per retry-driven worker respawn),
 * so callers reading an auth file back must fold the real index into this
 * range with `% resolveEffectiveWorkerCount(...)` rather than using
 * `testInfo.workerIndex` directly — see `authFile` in `fixtures/base.ts`.
 */
export function resolveEffectiveWorkerCount(
  argv: string[],
  customer: CustomerConfig,
  credentials: readonly Credential[],
): number {
  return resolveWorkerCount(argv, customer, minCredentialPoolSize(credentials));
}
