/**
 * Env loader.
 *
 * `loadCustomerConfig(modulePath?)` imports and validates the customer config.
 * `loadEnv(customer, opts?)`        loads `.env.<tier>`, discovers credentials,
 *                                   and returns a deeply frozen `EnvConfig`.
 *
 * Failure modes throw `DeepConfigError` whose `.issues[]` is a flattened list
 * of `{ path, message }` records.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { ZodError } from 'zod';
import { CustomerConfigSchema } from './schema';
import type { Credential, CustomerConfig, EnvConfig } from './types';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export interface LoadEnvOptions {
  tier?: string;
  envFileDir?: string;
  rawEnv?: NodeJS.ProcessEnv;
}

export interface ConfigIssue {
  path: string;
  message: string;
}

export class DeepConfigError extends Error {
  readonly issues: ReadonlyArray<ConfigIssue>;

  constructor(message: string, issues: ConfigIssue[]) {
    super(message);
    this.name = 'DeepConfigError';
    this.issues = Object.freeze(issues.map((i) => Object.freeze({ ...i })));
  }
}

const AUTO_POOL_PROBE_CAP = 32;

function issueFromZod(err: ZodError): ConfigIssue[] {
  return err.issues.map((i) => ({
    path: i.path.length === 0 ? '(root)' : i.path.join('.'),
    message: i.message,
  }));
}

function formatSummary(prefix: string, issues: ConfigIssue[]): string {
  const head = issues
    .slice(0, 10)
    .map((i) => `  - ${i.path}: ${i.message}`)
    .join('\n');
  const tail = issues.length > 10 ? `\n  ... and ${issues.length - 10} more` : '';
  return `${prefix}\n${head}${tail}`;
}

/**
 * Loads `customer.config.ts` (or any path), validates with `CustomerConfigSchema`,
 * returns the parsed object (not yet frozen — callers freeze as needed).
 *
 * Requires the calling process to have a TypeScript loader available when the
 * target file is `.ts`. Playwright's config loader and `tsx`/`ts-node` both
 * satisfy this. Plain `node` on a `.ts` file will fail with a parse error.
 */
export function loadCustomerConfig(modulePath?: string): CustomerConfig {
  const resolved = modulePath ?? path.join(process.cwd(), 'customer.config.ts');
  let imported: unknown;
  try {
    const mod = require(resolved) as { default?: unknown } | unknown;
    imported = (mod as { default?: unknown }).default ?? mod;
  } catch (err) {
    throw new DeepConfigError(
      `Failed to import customer config at ${resolved}: ${(err as Error).message}`,
      [{ path: 'customer.config', message: (err as Error).message }],
    );
  }
  const parsed = CustomerConfigSchema.safeParse(imported);
  if (!parsed.success) {
    const issues = issueFromZod(parsed.error);
    throw new DeepConfigError(
      formatSummary(`Invalid customer config at ${resolved}`, issues),
      issues,
    );
  }
  return parsed.data as CustomerConfig;
}

function readEnvFile(envFileDir: string, tier: string): Record<string, string> {
  const file = path.join(envFileDir, `.env.${tier}`);
  if (!fs.existsSync(file)) return {};
  const parsed = dotenv.parse(fs.readFileSync(file, 'utf-8'));
  return parsed;
}

function pickCredentialsForRole(
  role: string,
  pool: number | 'auto',
  rolesCount: number,
  env: Record<string, string>,
): Credential[] {
  const roleUpper = role.toUpperCase();

  const tryIndex = (i: number): Credential | undefined => {
    const userKey = `TEST_USER_${roleUpper}_${i}`;
    const passKey = `TEST_PASS_${roleUpper}_${i}`;
    const u = env[userKey];
    const p = env[passKey];
    if (u && !p) {
      throw new DeepConfigError(`${userKey} is set but ${passKey} is missing`, [
        { path: passKey, message: 'required when paired user var is set' },
      ]);
    }
    if (!u && p) {
      throw new DeepConfigError(`${passKey} is set but ${userKey} is missing`, [
        { path: userKey, message: 'required when paired pass var is set' },
      ]);
    }
    if (u && p) return { role, user: u, pass: p };
    return undefined;
  };

  if (typeof pool === 'number') {
    const found: Credential[] = [];
    for (let i = 0; i < pool; i++) {
      const c = tryIndex(i);
      if (!c) {
        throw new DeepConfigError(
          `Missing TEST_USER_${roleUpper}_${i} / TEST_PASS_${roleUpper}_${i} (accountPoolSize=${pool})`,
          [{ path: `TEST_USER_${roleUpper}_${i}`, message: 'required for fixed pool size' }],
        );
      }
      found.push(c);
    }
    return found;
  }

  // pool === 'auto'
  const found: Credential[] = [];
  for (let i = 0; i < AUTO_POOL_PROBE_CAP; i++) {
    const c = tryIndex(i);
    if (!c) break;
    found.push(c);
  }
  if (found.length > 0) return found;

  // Single-account fallback — only allowed for single-role configs.
  if (rolesCount > 1) {
    throw new DeepConfigError(
      `Multi-role config requires TEST_USER_<ROLE>_0 / TEST_PASS_<ROLE>_0 (single-account fallback only valid for single-role configs)`,
      [{ path: `TEST_USER_${roleUpper}_0`, message: 'required for multi-role auto-discovery' }],
    );
  }
  const u = env.TEST_USER;
  const p = env.TEST_PASS;
  if (!u || !p) {
    const missing: ConfigIssue[] = [];
    if (!u) missing.push({ path: 'TEST_USER', message: 'required' });
    if (!p) missing.push({ path: 'TEST_PASS', message: 'required' });
    throw new DeepConfigError(formatSummary('Missing credentials', missing), missing);
  }
  return [{ role, user: u, pass: p }];
}

export function loadEnv(customer: CustomerConfig, opts: LoadEnvOptions = {}): EnvConfig {
  const rawEnv = opts.rawEnv ?? process.env;
  const tier = opts.tier ?? rawEnv.TEST_ENV ?? customer.defaultEnv;

  if (!(tier in customer.envs)) {
    const valid = Object.keys(customer.envs).join(', ');
    throw new DeepConfigError(`Unknown TEST_ENV '${tier}'. Valid tiers: ${valid}`, [
      { path: 'TEST_ENV', message: `unknown tier; valid: ${valid}` },
    ]);
  }
  const tierCfg = customer.envs[tier];
  if (!tierCfg) {
    // unreachable thanks to the `in` check, but TypeScript can't narrow here.
    throw new DeepConfigError(`Tier config missing for '${tier}'`, [
      { path: `envs.${tier}`, message: 'absent' },
    ]);
  }

  // 1. Load .env.<tier> if present. The contents are merged with rawEnv,
  //    rawEnv winning so CI-provided values aren't clobbered by .env files.
  const envFileDir = opts.envFileDir ?? process.cwd();
  const fileEnv = readEnvFile(envFileDir, tier);
  const merged: Record<string, string> = {};
  for (const [k, v] of Object.entries(fileEnv)) {
    if (typeof v === 'string') merged[k] = v;
  }
  for (const [k, v] of Object.entries(rawEnv)) {
    if (typeof v === 'string') merged[k] = v;
  }

  // 2. Required vars from tier config.
  const missing: ConfigIssue[] = [];
  for (const name of tierCfg.requiredEnvVars) {
    if (!merged[name])
      missing.push({ path: name, message: 'required by envs.' + tier + '.requiredEnvVars' });
  }
  if (missing.length > 0) {
    throw new DeepConfigError(formatSummary('Missing required env vars', missing), missing);
  }

  // 3. BrowserStack creds: both-or-neither.
  const bsUser = merged.BROWSERSTACK_USERNAME;
  const bsKey = merged.BROWSERSTACK_ACCESS_KEY;
  if ((bsUser && !bsKey) || (!bsUser && bsKey)) {
    const issues: ConfigIssue[] = [
      {
        path: 'BROWSERSTACK_USERNAME',
        message: 'must be set together with BROWSERSTACK_ACCESS_KEY',
      },
    ];
    throw new DeepConfigError(
      formatSummary('BrowserStack credentials half-configured', issues),
      issues,
    );
  }

  // 4. Credentials discovery.
  const credentials: Credential[] = [];
  for (const role of customer.auth.mode === 'none' ? [] : customer.auth.roles) {
    const slice = pickCredentialsForRole(
      role,
      customer.auth.accountPoolSize,
      customer.auth.roles.length,
      merged,
    );
    credentials.push(...slice);
  }

  // 5. Mask logs default.
  const maskLogs = (merged.MASK_LOGS ?? 'true').toLowerCase() !== 'false';

  // 6. Compose, freeze, return.
  const baseUrl = merged.BASE_URL ?? tierCfg.baseUrl;
  const apiBaseUrl = merged.API_URL ?? tierCfg.apiBaseUrl;

  const env: EnvConfig = {
    tier,
    baseUrl,
    apiBaseUrl,
    credentials: Object.freeze(credentials.map((c) => Object.freeze({ ...c }))),
    maskLogs,
    bs:
      bsUser && bsKey
        ? Object.freeze({ username: bsUser, accessKey: bsKey, buildName: merged.BS_BUILD_NAME })
        : undefined,
    raw: Object.freeze({ ...merged }),
  };
  return Object.freeze(env) as EnvConfig;
}
