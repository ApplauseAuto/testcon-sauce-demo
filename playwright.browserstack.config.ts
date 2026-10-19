/**
 * BrowserStack variant of the Playwright config. Same `customer.config.ts` and
 * `.env.<tier>` sources as `playwright.config.ts`, but each project connects to
 * a remote BrowserStack browser via `connectOptions.wsEndpoint`.
 *
 * Auth mode defaults to `'per-test-login'` (see `resolveBsAuthMode` in
 * `src/config/browserstack.ts`). Storage-state written by local Chromium is
 * NOT portable across BrowserStack browser engines (Chrome vs WebKit cookie /
 * sessionStorage differences), so per-test-login is the safe default. To opt
 * back into the worker-storage flow, set
 * `customer.auth.browserstackMode = 'per-worker-storage'` in
 * `customer.config.ts` — only after verifying your login flow + storage works
 * on every engine in the matrix.
 *
 * Resolution logic lives in `src/config/browserstack.ts` so it can be
 * unit-tested without triggering this file's import-time guards.
 *
 * Fails fast if BS is disabled, the matrix is empty, or BS credentials are
 * missing.
 */

import { defineConfig } from '@playwright/test';
import customer from './customer.config';
import { loadEnv } from './src/config/env';
import { buildBaseConfig } from './src/config/playwright-base';
import { buildBrowserstackProjects } from './src/config/browserstack';

const env = loadEnv(customer);
const base = buildBaseConfig(customer, env, true);
const { projects } = buildBrowserstackProjects(customer, env);

export default defineConfig({
  ...base,
  reporter: [
    ['html'],
    [
      'allure-playwright',
      {
        detail: false,
      },
    ],
  ],
  forbidOnly: !!process.env.CI,
  projects,
});
