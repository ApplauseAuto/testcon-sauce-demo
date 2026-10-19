/**
 * Zod schemas mirroring `./types.ts`.
 *
 * `CustomerConfigSchema` validates the customer config object loaded from
 * `customer.config.ts`. `buildEnvSchema` dynamically composes a schema for
 * the env-tier-shaped subset of `process.env` based on a tier's
 * `requiredEnvVars` and the customer's auth roles.
 *
 * Full credential-discovery logic (pool size, role suffixes) lives in
 * `loadEnv()` in `./env.ts`. The schema only enforces the *required* keys
 * the tier itself declares plus a small set of standard optional ones.
 */

import { z } from 'zod';
import type {
  AuthConfig,
  BrowserProject,
  BrowserstackAppProfile,
  BrowserstackConfig,
  BrowserstackProject,
  BrowserstackWebProfile,
  CaptureMode,
  CustomerConfig,
  EnvTierConfig,
  FeatureFlags,
  LocaleConfig,
  MobileTargetsConfig,
  MobileWebTargetProfile,
  NativeTargetProfile,
  ReporterEntry,
  ReporterName,
} from './types';

// ---------- enums ----------

export const ReporterNameSchema: z.ZodType<ReporterName> = z.enum([
  'html',
  'allure',
  'list',
  'junit',
]);

export const CaptureModeSchema: z.ZodType<CaptureMode> = z.enum([
  'off',
  'on',
  'only-on-failure',
  'on-first-retry',
  'retain-on-failure',
]);

// ---------- reporters ----------

export const ReporterEntrySchema: z.ZodType<ReporterEntry> = z.union([
  ReporterNameSchema,
  z.object({
    name: ReporterNameSchema,
    options: z.record(z.string(), z.unknown()).optional(),
  }),
]);

// ---------- browsers ----------

export const BrowserProjectSchema: z.ZodType<BrowserProject> = z.object({
  enabled: z.boolean(),
  use: z.record(z.string(), z.unknown()),
});

export const BrowserstackProjectSchema: z.ZodType<BrowserstackProject> = z.object({
  name: z.string().min(1),
  os: z.string().optional(),
  osVersion: z.string().optional(),
  browser: z
    .enum([
      'chrome',
      'edge',
      'firefox',
      'webkit',
      'playwright-chromium',
      'playwright-firefox',
      'playwright-webkit',
    ])
    .optional(),
  browserVersion: z.string().optional(),
  device: z.string().optional(),
});

export const BrowserstackAppProfileSchema: z.ZodType<BrowserstackAppProfile> = z.object({
  name: z.string().min(1),
  platformName: z.enum(['Android', 'iOS']),
  osVersion: z.string().min(1),
  deviceName: z.string().min(1),
  appEnvVar: z.string().min(1),
});

export const BrowserstackWebProfileSchema: z.ZodType<BrowserstackWebProfile> = z.object({
  name: z.string().min(1),
  platformName: z.enum(['Android', 'iOS']),
  osVersion: z.string().min(1),
  deviceName: z.string().min(1),
  browserName: z.enum(['Chrome', 'Safari']),
});

export const BrowserstackConfigSchema: z.ZodType<BrowserstackConfig> = z.object({
  enabled: z.boolean(),
  matrix: z.array(BrowserstackProjectSchema),
  appAutomate: z.array(BrowserstackAppProfileSchema).optional(),
  automateMobileWeb: z.array(BrowserstackWebProfileSchema).optional(),
});

// ---------- mobile (Appium: mobile-native + mobile-web) ----------

export const NativeTargetProfileSchema: z.ZodType<NativeTargetProfile> = z.object({
  enabled: z.boolean(),
  platformName: z.enum(['Android', 'iOS']),
  automationName: z.enum(['UiAutomator2', 'XCUITest']),
  deviceName: z.string().min(1),
  platformVersion: z.string().min(1).optional(),
  udid: z.string().min(1).optional(),
  noReset: z.boolean().optional(),
  extraCapabilities: z.record(z.string(), z.unknown()).optional(),
});

export const MobileWebTargetProfileSchema: z.ZodType<MobileWebTargetProfile> = z.object({
  enabled: z.boolean(),
  platformName: z.enum(['Android', 'iOS']),
  automationName: z.enum(['UiAutomator2', 'XCUITest']),
  deviceName: z.string().min(1),
  platformVersion: z.string().min(1).optional(),
  browserName: z.enum(['Chrome', 'Safari']),
  udid: z.string().min(1).optional(),
  extraCapabilities: z.record(z.string(), z.unknown()).optional(),
});

export const MobileTargetsConfigSchema: z.ZodType<MobileTargetsConfig> = z.object({
  native: z.record(z.string().min(1), NativeTargetProfileSchema),
  mobileWeb: z.record(z.string().min(1), MobileWebTargetProfileSchema),
  selectorFallback: z.boolean().optional(),
});

// ---------- env tier ----------

export const EnvTierConfigSchema: z.ZodType<EnvTierConfig> = z.object({
  baseUrl: z.string().min(1),
  apiBaseUrl: z.string().min(1).optional(),
  requiredEnvVars: z.array(z.string().min(1)),
});

// ---------- locales ----------

export const LocaleConfigSchema: z.ZodType<LocaleConfig> = z.object({
  locale: z.string().min(1),
  timezoneId: z.string().min(1).optional(),
  baseUrl: z.string().min(1).optional(),
});

// ---------- auth ----------

const AuthConfigBaseSchema = z.object({
  mode: z.enum(['none', 'shared-storage', 'per-worker-storage', 'per-test-login']),
  roles: z.array(z.string().min(1)).min(1),
  defaultRole: z.string().min(1).optional(),
  storageDir: z.string().min(1),
  accountPoolSize: z.union([z.literal('auto'), z.number().int().positive()]),
  browserstackMode: z.enum(['per-test-login', 'per-worker-storage']).optional(),
});

export const AuthConfigSchema: z.ZodType<AuthConfig> = AuthConfigBaseSchema.refine(
  (auth) => auth.defaultRole === undefined || auth.roles.includes(auth.defaultRole),
  {
    message: 'auth.defaultRole must be one of auth.roles',
    path: ['defaultRole'],
  },
);

// ---------- features ----------

export const FeatureFlagsSchema: z.ZodType<FeatureFlags> = z.object({
  visualLocator: z.boolean(),
  sensitiveDataMasking: z.boolean(),
  apiMocking: z.boolean(),
});

// ---------- customer config ----------

export const CustomerConfigSchema: z.ZodType<CustomerConfig> = z
  .object({
    name: z.string().min(1),
    defaultEnv: z.string().min(1),
    envs: z.record(z.string().min(1), EnvTierConfigSchema),
    browsers: z.record(z.string().min(1), BrowserProjectSchema),
    locales: z.record(z.string().min(1), LocaleConfigSchema).optional(),
    mobile: MobileTargetsConfigSchema.optional(),
    parallel: z.object({
      workers: z.union([z.literal('auto'), z.number().int().positive()]),
      fullyParallel: z.boolean(),
      retries: z.object({
        ci: z.number().int().min(0),
        local: z.number().int().min(0),
      }),
    }),
    timeouts: z.object({
      test: z.number().int().positive(),
      expect: z.number().int().positive(),
      action: z.number().int().positive().optional(),
      navigation: z.number().int().positive().optional(),
    }),
    capture: z.object({
      trace: CaptureModeSchema,
      screenshot: CaptureModeSchema,
      video: CaptureModeSchema,
    }),
    reporters: z.array(ReporterEntrySchema),
    auth: AuthConfigSchema,
    features: FeatureFlagsSchema,
    browserstack: BrowserstackConfigSchema.optional(),
  })
  .refine((cfg) => cfg.defaultEnv in cfg.envs, {
    message: 'customer.defaultEnv must be a key of customer.envs',
    path: ['defaultEnv'],
  });

// ---------- env-config schema builder ----------

/**
 * Composes a Zod schema for the **raw** env-var slice the skeleton needs at
 * load time. This validates:
 *
 *   - every name in `tier.requiredEnvVars` is present and non-empty
 *   - BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY are either both
 *     present or both absent (no half-configured BS)
 *   - MASK_LOGS defaults to `'true'` when absent
 *
 * Credential discovery (TEST_USER, TEST_USER_<ROLE>_<i>, etc.) is handled by
 * `loadEnv()` in `./env.ts`; doing it here would couple the schema to roles
 * × accountPoolSize discovery, which is loader concern. The `roles` param is
 * accepted for forward compatibility (future schema extensions) but not
 * used by this minimal validator.
 */
export function buildEnvSchema(
  tier: EnvTierConfig,
  _roles: string[],
): z.ZodType<Record<string, string>> {
  const required: Record<string, z.ZodType<string>> = {};
  for (const name of tier.requiredEnvVars) {
    required[name] = z.string().min(1, `${name} must be a non-empty string`);
  }
  return z
    .object({
      ...required,
      MASK_LOGS: z
        .string()
        .optional()
        .transform((v) => (v === undefined ? 'true' : v)),
      BROWSERSTACK_USERNAME: z.string().min(1).optional(),
      BROWSERSTACK_ACCESS_KEY: z.string().min(1).optional(),
      BS_BUILD_NAME: z.string().min(1).optional(),
      BASE_URL: z.string().min(1).optional(),
      API_URL: z.string().min(1).optional(),
    })
    .catchall(z.string())
    .refine(
      (env) => {
        const u = env.BROWSERSTACK_USERNAME;
        const k = env.BROWSERSTACK_ACCESS_KEY;
        return (u && k) || (!u && !k);
      },
      {
        message:
          'BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY must be set together (or neither)',
        path: ['BROWSERSTACK_USERNAME'],
      },
    ) as unknown as z.ZodType<Record<string, string>>;
}
