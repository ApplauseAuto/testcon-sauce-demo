/**
 * Shared Playwright config subset used by both the local config and the
 * BrowserStack variant. Returns just the slice that's identical between them
 * (testDir, timeouts, reporters, use, retries, workers). Each caller adds
 * its own `projects[]`.
 */

import type { PlaywrightTestConfig } from '@playwright/test';
import type { CustomerConfig, EnvConfig } from './types';
import { buildReporters } from './reporters';

type BaseUse = NonNullable<PlaywrightTestConfig['use']>;

export function buildBaseConfig(
  customer: CustomerConfig,
  env: EnvConfig,
  isCi: boolean = !!process.env.CI,
): Omit<PlaywrightTestConfig, 'projects'> {
  // CustomerConfig.capture.{trace,screenshot,video} are validated by
  // CustomerConfigSchema against a single CaptureMode union that's a
  // superset of each Playwright field's narrow union. Runtime values are
  // always valid for their target field, so we narrow each via `as`.
  const use: BaseUse = {
    baseURL: env.baseUrl,
    headless: isCi,
    trace: customer.capture.trace as BaseUse['trace'],
    screenshot: customer.capture.screenshot as BaseUse['screenshot'],
    video: customer.capture.video as BaseUse['video'],
    actionTimeout: customer.timeouts.action,
    navigationTimeout: customer.timeouts.navigation,
  };

  return {
    testDir: './src/tests',
    outputDir: 'test-results',
    fullyParallel: customer.parallel.fullyParallel,
    retries: isCi ? customer.parallel.retries.ci : customer.parallel.retries.local,
    workers: customer.parallel.workers === 'auto' ? undefined : customer.parallel.workers,
    timeout: customer.timeouts.test,
    expect: { timeout: customer.timeouts.expect },
    reporter: buildReporters(customer.reporters),
    use,
  };
}
