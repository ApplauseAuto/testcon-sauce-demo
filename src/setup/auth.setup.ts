/**
 * Playwright "setup" project body.
 *
 * Loaded by `playwright.config.ts` via:
 *     { name: 'setup', testMatch: /auth\.setup\.ts/ }
 *
 * Browser projects depend on `setup`, so this runs once before any test.
 * It writes `.auth/user-<role>-<index>.json` per role × worker — one storage
 * state file per worker slot — so tests can launch already-authenticated
 * contexts without re-running the UI login.
 *
 * Behavior:
 *   - Skipped silently when `customer.auth.mode !== 'per-worker-storage'`.
 *   - Worker count detected via `resolveWorkerCount` (CLI > customer config > os.cpus/2).
 *   - One retry with a 2s back-off on transient login failures.
 *   - Logs each step via `Logger.step` (Playwright-aware, masked).
 *   - Hard-throws on second failure to abort the whole run.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { test as setupTest } from '@playwright/test';
import { loadCustomerConfig, loadEnv } from '../config/env';
import type { Credential } from '../config/types';
import { Logger } from '../utils/logger';
import { authFilePath } from '../utils/paths';
import { loginFlow } from './login-flows/login-flow';
import { resolveEffectiveWorkerCount } from './worker-resolver';

const RETRY_BACKOFF_MS = 2_000;

setupTest('setup auth files', async ({ browser }) => {
  const customer = loadCustomerConfig();
  const env = loadEnv(customer);

  if (customer.auth.mode !== 'per-worker-storage') {
    Logger.info(`auth.mode=${customer.auth.mode}; setup is a no-op`);
    return;
  }

  // Ensure storageDir exists.
  const storageDir = path.isAbsolute(customer.auth.storageDir)
    ? customer.auth.storageDir
    : path.join(process.cwd(), customer.auth.storageDir);
  fs.mkdirSync(storageDir, { recursive: true });

  // Group credentials per role (the smallest available pool caps the loop).
  const credsByRole = new Map<string, Credential[]>();
  for (const c of env.credentials) {
    const arr = credsByRole.get(c.role) ?? [];
    arr.push(c);
    credsByRole.set(c.role, arr);
  }
  if (credsByRole.size === 0) {
    throw new Error(
      'No credentials were discovered by loadEnv(); cannot run per-worker-storage setup',
    );
  }

  const workerCount = resolveEffectiveWorkerCount(process.argv, customer, env.credentials);
  Logger.info(`per-worker-storage setup: ${workerCount} workers × ${credsByRole.size} role(s)`);

  for (const role of customer.auth.roles) {
    const creds = credsByRole.get(role) ?? [];
    if (creds.length === 0) {
      throw new Error(`No credentials discovered for role '${role}'`);
    }
    for (let i = 0; i < workerCount; i++) {
      const cred = creds[i % creds.length];
      if (!cred) throw new Error(`No credential for role=${role} index=${i}`);
      const authFile = authFilePath(customer, role, i);

      await runOneWithRetry(role, i, async () => {
        const context = await browser.newContext();
        try {
          const page = await context.newPage();
          await loginFlow(page, cred, env.baseUrl);
          await context.storageState({ path: authFile });
          Logger.info(`wrote ${path.relative(process.cwd(), authFile)}`);
        } finally {
          await context.close();
        }
      });
    }
  }
});

async function runOneWithRetry(role: string, idx: number, fn: () => Promise<void>): Promise<void> {
  try {
    await Logger.step(`login role=${role} idx=${idx} (attempt 1)`, fn);
    return;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    Logger.warn(`attempt 1 failed for role=${role} idx=${idx}: ${msg}`);
    await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
  }
  await Logger.step(`login role=${role} idx=${idx} (attempt 2)`, fn);
}
