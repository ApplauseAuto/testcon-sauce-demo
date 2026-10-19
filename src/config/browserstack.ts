/**
 * Pure helpers for building BrowserStack-targeted Playwright projects. Kept
 * separate from `playwright.browserstack.config.ts` so they can be unit-tested
 * without triggering the config file's import-time guards.
 */

import type { BrowserstackProject, CustomerConfig, EnvConfig } from './types';
import { crossWithLocales } from './locale-projects';

export interface BsProjectDescription {
  name: string;
  use: {
    connectOptions: { wsEndpoint: string };
    locale?: string;
    timezoneId?: string;
    baseURL?: string;
  };
  dependencies: string[];
}

/**
 * Resolves the BrowserStack auth mode, defaulting to `'per-test-login'`.
 * Storage-state written by local chromium is NOT portable across BrowserStack
 * browser engines, so we default to per-test-login to be safe.
 */
export function resolveBsAuthMode(
  customer: CustomerConfig,
): 'per-test-login' | 'per-worker-storage' {
  return customer.auth.browserstackMode ?? 'per-test-login';
}

/**
 * Builds the BrowserStack CDP WebSocket endpoint with capabilities encoded
 * into the `caps` query parameter. Credentials are passed via caps
 * (`browserstack.username` / `browserstack.accessKey`) rather than URL
 * userinfo, per BrowserStack's Playwright docs.
 *
 * Throws if `env.bs` is undefined — callers should check before calling.
 */
export function buildBsWsEndpoint(
  entry: BrowserstackProject,
  customer: CustomerConfig,
  env: EnvConfig,
): string {
  if (!env.bs) {
    throw new Error(
      'BrowserStack credentials missing. Set BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY in the environment before invoking buildBsWsEndpoint.',
    );
  }

  const buildName = env.bs.buildName ?? `${customer.name}-${new Date().toISOString().slice(0, 10)}`;

  const caps: Record<string, unknown> = {
    'browserstack.username': env.bs.username,
    'browserstack.accessKey': env.bs.accessKey,
    project: customer.name,
    build: buildName,
    name: entry.name,
    'client.playwrightVersion': '1.x',
  };

  if (entry.os) caps.os = entry.os;
  if (entry.osVersion) caps.os_version = entry.osVersion;
  if (entry.browser) caps.browser = entry.browser;
  if (entry.browserVersion) caps.browser_version = entry.browserVersion;
  if (entry.device) caps.device = entry.device;

  if (env.maskLogs) {
    caps['browserstack.maskCommands'] =
      'setHTTPCredentials,setValues,getValues,setCookies,getCookies';
  }

  const encoded = encodeURIComponent(JSON.stringify(caps));
  return `wss://cdp.browserstack.com/playwright?caps=${encoded}`;
}

/**
 * Builds the full projects[] array for the BrowserStack config. Includes the
 * `setup` project only when `customer.auth.browserstackMode` is
 * `'per-worker-storage'`.
 *
 * Throws if BrowserStack is disabled, the matrix is empty, or BS creds are
 * missing.
 */
export function buildBrowserstackProjects(
  customer: CustomerConfig,
  env: EnvConfig,
): {
  setupNeeded: boolean;
  projects: Array<{ name: string; testMatch?: RegExp } | BsProjectDescription>;
} {
  if (!customer.browserstack?.enabled) {
    throw new Error(
      'BrowserStack is disabled. Set customer.browserstack.enabled = true in customer.config.ts to run on BrowserStack.',
    );
  }
  if (customer.browserstack.matrix.length === 0) {
    throw new Error('customer.browserstack.matrix is empty — define at least one BS project.');
  }
  if (!env.bs) {
    throw new Error(
      'BrowserStack credentials missing. Set BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY in the environment.',
    );
  }

  const setupNeeded = resolveBsAuthMode(customer) === 'per-worker-storage';

  const matrixEntries = crossWithLocales(
    customer.browserstack.matrix.map((entry) => ({ ...entry, use: {} as Record<string, unknown> })),
    customer.locales,
  );
  const bsProjects: BsProjectDescription[] = matrixEntries.map((entry) => ({
    name: entry.name,
    use: {
      connectOptions: { wsEndpoint: buildBsWsEndpoint(entry, customer, env) },
      ...(entry.use.locale ? { locale: entry.use.locale as string } : {}),
      ...(entry.use.timezoneId ? { timezoneId: entry.use.timezoneId as string } : {}),
      ...(entry.use.baseURL ? { baseURL: entry.use.baseURL as string } : {}),
    },
    dependencies: setupNeeded ? ['setup'] : [],
  }));

  const projects = setupNeeded
    ? [
        // Mirror playwright.config.ts: auth.setup.ts lives in src/setup/, not
        // in the main testDir, so the setup project gets its own.
        { name: 'setup', testDir: './src/setup', testMatch: /auth\.setup\.ts$/ },
        ...bsProjects,
      ]
    : bsProjects;

  return { setupNeeded, projects };
}
