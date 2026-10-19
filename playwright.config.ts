/**
 * Local + CI Playwright config, driven entirely by `customer.config.ts` plus
 * `TEST_ENV`-selected `.env.<tier>`. See `playwright.browserstack.config.ts`
 * for the BrowserStack variant.
 *
 * Project layout:
 *   - 'setup' (no deps): runs `src/setup/auth.setup.ts` once per run to write
 *     `.auth/user-<role>-<workerIndex>.json` files (per-worker-storage mode).
 *   - One project per enabled browser in `customer.browsers`, each declaring
 *     `dependencies: ['setup']` when `customer.auth.mode === 'per-worker-storage'`.
 */

import { defineConfig } from '@playwright/test';
import customer from './customer.config';
import { loadEnv } from './src/config/env';
import { buildBaseConfig } from './src/config/playwright-base';
import { crossWithLocales } from './src/config/locale-projects';

const env = loadEnv(customer);
const base = buildBaseConfig(customer, env);

const setupNeeded = customer.auth.mode === 'per-worker-storage';

const browserProjects = crossWithLocales(
  Object.entries(customer.browsers)
    .filter(([, v]) => v.enabled)
    .map(([name, v]) => ({
      name,
      use: v.use,
      dependencies: setupNeeded ? ['setup'] : [],
    })),
  customer.locales,
);

export default defineConfig({
  ...base,
  forbidOnly: !!process.env.CI,
  reporter: [
    ['html'],
    [
      'allure-playwright',
      {
        detail: false,
      },
    ],
  ],
  projects: setupNeeded
    ? [{ name: 'setup', testDir: './src/setup', testMatch: /auth\.setup\.ts$/ }, ...browserProjects]
    : browserProjects,
});
