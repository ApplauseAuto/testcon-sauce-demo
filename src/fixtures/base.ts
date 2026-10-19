/**
 * Unified `test` + `expect` export for the Applause Playwright skeleton.
 *
 * Tests import as:
 *   import { test, expect } from '@/fixtures/base';
 *
 * Fixtures provided:
 *   customer  (worker)   — loaded once per worker, deeply frozen.
 *   env       (worker)   — loaded once per worker, deeply frozen.
 *   role      (test)     — defaults to customer.auth.defaultRole ?? roles[0];
 *                          override per-test via `test.use({ role: 'admin' })`.
 *   authFile  (test)     — `.auth/user-<role>-<workerIndex>.json` for the current role.
 *   logger    (test)     — BoundLogger prefixed with test title; respects env.maskLogs.
 *   v         (test)     — VisualLocator | undefined, gated by customer.features.visualLocator.
 *
 * The `page` fixture is overridden so the running browser context is wired
 * to the current customer auth mode:
 *   - `per-worker-storage` → context loads `storageState: authFile`.
 *   - `per-test-login`     → fresh context, calls `loginFlow` on the page.
 *   - `none` / `shared-storage` → default page (customers can extend).
 */

import { test as base, expect } from '@playwright/test';
import type { CustomerConfig, EnvConfig } from '../config/types';
import { loadEnv } from '../config/env';
import { CustomerConfigSchema } from '../config/schema';
import customerConfig from '../../customer.config';
import { authFilePath } from '../utils/paths';
import { Logger, type BoundLogger } from '../utils/logger';
import { visual, type VisualLocator } from '../visual-locator/visual-locator';
import { loginFlow } from '../setup/login-flows/login-flow';
import { resolveEffectiveWorkerCount } from '../setup/worker-resolver';

export interface SkeletonTestFixtures {
  role: string;
  authFile: string;
  logger: BoundLogger;
  v: VisualLocator | undefined;
}

export interface SkeletonWorkerFixtures {
  customer: CustomerConfig;
  env: EnvConfig;
}

/**
 * Recursively freeze an object and its nested properties. The `seen` set
 * makes this safe against cyclic references (defensive — current configs
 * are acyclic, but customers may add arbitrary fields).
 */
function deepFreeze<T>(obj: T, seen: WeakSet<object> = new WeakSet()): T {
  if (obj && typeof obj === 'object') {
    if (seen.has(obj as object)) return obj;
    seen.add(obj as object);
    for (const value of Object.values(obj as Record<string, unknown>)) {
      if (value && typeof value === 'object') deepFreeze(value, seen);
    }
    Object.freeze(obj);
  }
  return obj;
}

export const test = base.extend<SkeletonTestFixtures, SkeletonWorkerFixtures>({
  // ---------- worker-scoped ----------
  customer: [
    // Worker-scoped fixture with no dependencies — `_` placeholder satisfies
    // Playwright's required deps-then-use signature without tripping ESLint's
    // empty-pattern rule.
    async ({ browserName: _browserName }, use) => {
      const cfg = CustomerConfigSchema.parse(customerConfig) as CustomerConfig;
      deepFreeze(cfg);
      await use(cfg);
    },
    { scope: 'worker' },
  ],

  env: [
    async ({ customer }, use) => {
      const e = loadEnv(customer);
      await use(e);
    },
    { scope: 'worker' },
  ],

  // ---------- test-scoped ----------
  role: async ({ customer }, use) => {
    const defaultRole = customer.auth.defaultRole ?? customer.auth.roles[0];
    if (!defaultRole) throw new Error('customer.auth.roles is empty');
    // `role` is overridable per-test via test.use({ role: 'admin' }).
    // When overridden, Playwright re-creates this fixture with the new value
    // passed through `use` parameter context — but the default branch here
    // applies the customer's defaultRole.
    if (!customer.auth.roles.includes(defaultRole)) {
      throw new Error(
        `Invalid role '${defaultRole}' (not in customer.auth.roles: ${customer.auth.roles.join(', ')})`,
      );
    }
    await use(defaultRole);
  },

  authFile: async ({ customer, role, env }, use, testInfo) => {
    // `testInfo.workerIndex` is not bounded by the worker count auth.setup.ts
    // used to decide how many files to write — Playwright can hand out a
    // fresh, never-reused index per retry-driven worker respawn. Fold it back
    // into the generated range so every worker reads a file that exists.
    const workerCount = resolveEffectiveWorkerCount(process.argv, customer, env.credentials);
    const idx = workerCount > 0 ? testInfo.workerIndex % workerCount : testInfo.workerIndex;
    const file = authFilePath(customer, role, idx);
    await use(file);
  },

  logger: async ({ env }, use, testInfo) => {
    const bound = Logger.withContext({
      maskEnabled: env.maskLogs,
      prefix: testInfo.title,
    });
    await use(bound);
  },

  v: async ({ page, customer }, use) => {
    const instance = customer.features.visualLocator ? visual(page) : undefined;
    await use(instance);
  },

  // ---------- page override (auth-aware) ----------
  page: async ({ browser, customer, env, role, authFile }, use) => {
    if (customer.auth.mode === 'per-worker-storage') {
      const context = await browser.newContext({ storageState: authFile });
      const page = await context.newPage();
      try {
        await use(page);
      } finally {
        await context.close();
      }
      return;
    }

    if (customer.auth.mode === 'per-test-login') {
      const cred = env.credentials.find((c) => c.role === role) ?? env.credentials[0];
      if (!cred) throw new Error(`No credential available for role '${role}'`);
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await loginFlow(page, cred, env.baseUrl);
        await use(page);
      } finally {
        await context.close();
      }
      return;
    }

    // 'none' or 'shared-storage' — default Playwright page.
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await use(page);
    } finally {
      await context.close();
    }
  },
});

export { expect };
