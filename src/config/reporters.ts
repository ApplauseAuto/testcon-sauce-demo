/**
 * Maps `customer.reporters` entries to Playwright `ReporterDescription`
 * tuples. Pure function, no side effects.
 *
 * Shorthand strings get sensible defaults:
 *   'html'   → ['html',  { outputFolder: 'playwright-report', open: 'never' }]
 *   'allure' → ['allure-playwright', { outputFolder: 'allure-results' }]
 *   'list'   → ['list']
 *   'junit'  → ['junit', { outputFile: 'test-results/junit.xml' }]
 *
 * Object entries (`{ name: 'html', options: {...} }`) win — the options
 * override the defaults entirely (no merge), keeping the contract simple.
 *
 * Throws on unknown name. CustomerConfigSchema already rejects unknown
 * names earlier, so this is defense-in-depth.
 */

import type { ReporterDescription } from '@playwright/test';
import type { ReporterEntry, ReporterName } from './types';

const DEFAULTS: Record<ReporterName, { module: string; options?: Record<string, unknown> }> = {
  html: { module: 'html', options: { outputFolder: 'playwright-report', open: 'never' } },
  allure: { module: 'allure-playwright', options: { outputFolder: 'allure-results' } },
  list: { module: 'list' },
  junit: { module: 'junit', options: { outputFile: 'test-results/junit.xml' } },
};

export function buildReporters(entries: ReporterEntry[]): ReporterDescription[] {
  return entries.map((entry) => {
    const name = typeof entry === 'string' ? entry : entry.name;
    const def = DEFAULTS[name];
    if (!def) throw new Error(`Unknown reporter name: ${String(name)}`);
    // Custom options pass through to Playwright as-is; Playwright validates at
    // runtime and silently ignores unknown keys. Typos in custom options will
    // not throw here.
    const opts = typeof entry === 'object' ? (entry.options ?? def.options) : def.options;
    return opts ? [def.module, opts] : [def.module];
  });
}
