/**
 * Type surface consumed by `customer.config.ts`, both Playwright configs,
 * the env loader, and every fixture in the skeleton.
 *
 * Pure types only — no runtime imports. Zod schemas live in `./schema.ts`.
 */

export type ReporterName = 'html' | 'allure' | 'list' | 'junit';

export type ReporterEntry =
  | ReporterName
  | { name: ReporterName; options?: Record<string, unknown> };

export type CaptureMode = 'off' | 'on' | 'only-on-failure' | 'on-first-retry' | 'retain-on-failure';

export interface BrowserProject {
  enabled: boolean;
  /** Playwright LaunchOptions/TestOptions slice. */
  use: Record<string, unknown>;
}

export type BrowserstackBrowserKind =
  | 'chrome'
  | 'edge'
  | 'firefox'
  | 'webkit'
  | 'playwright-chromium'
  | 'playwright-firefox'
  | 'playwright-webkit';

export interface BrowserstackProject {
  name: string;
  os?: string;
  osVersion?: string;
  browser?: BrowserstackBrowserKind;
  browserVersion?: string;
  device?: string;
}

export interface EnvTierConfig {
  baseUrl: string;
  apiBaseUrl?: string;
  /** Names that MUST be present in `.env.<tier>` (or in the process env). */
  requiredEnvVars: string[];
}

export interface LocaleConfig {
  /** Playwright's `use.locale` (e.g. `'pt-BR'`). */
  locale: string;
  /** Playwright's `use.timezoneId` (e.g. `'America/Sao_Paulo'`). */
  timezoneId?: string;
  /** Overrides `envs[tier].baseUrl` for this locale's projects when set. */
  baseUrl?: string;
}

export type AuthMode = 'none' | 'shared-storage' | 'per-worker-storage' | 'per-test-login';

export interface AuthConfig {
  mode: AuthMode;
  /**
   * Role names. Case is preserved verbatim in `credentials[i].role`, but
   * env-var lookup uppercases the role name (e.g. role `'standard'` or
   * `'Standard'` both produce `TEST_USER_STANDARD_0`). Prefer lowercase
   * role names for clarity.
   */
  roles: string[];
  /** Defaults to `roles[0]` when omitted. */
  defaultRole?: string;
  /** Directory (relative to repo root) where per-worker storage-state files live. */
  storageDir: string;
  /** Number of distinct credential sets per role; `'auto'` discovers via env. */
  accountPoolSize: number | 'auto';
  /**
   * Auth mode used for BrowserStack runs only. Default `'per-test-login'`
   * because storage-state written by local chromium is not portable across
   * BrowserStack browser engines (Chrome vs WebKit cookie / sessionStorage
   * differences).
   */
  browserstackMode?: 'per-test-login' | 'per-worker-storage';
}

export interface FeatureFlags {
  visualLocator: boolean;
  sensitiveDataMasking: boolean;
  apiMocking: boolean;
}

export interface BrowserstackConfig {
  enabled: boolean;
  matrix: BrowserstackProject[];
  /** Appium App Automate profiles — native apps. Distinct BrowserStack
   *  product from `matrix` (which is Automate, desktop + Playwright-CDP
   *  real-device web); a native app can ONLY run here. Absent/empty for
   *  web-only customers. */
  appAutomate?: BrowserstackAppProfile[];
  /** Appium Automate profiles — a real mobile browser on a real device,
   *  driven by XCUITest/UiAutomator2 (see `mobile/`), not Playwright-CDP.
   *  Absent/empty for web-only customers. */
  automateMobileWeb?: BrowserstackWebProfile[];
}

export interface BrowserstackAppProfile {
  name: string;
  platformName: 'Android' | 'iOS';
  osVersion: string;
  deviceName: string;
  /** Name of the env var holding the BrowserStack-uploaded app id
   *  (`bs://...`), resolved via `EnvConfig.raw` at capability-build time. */
  appEnvVar: string;
}

export interface BrowserstackWebProfile {
  name: string;
  platformName: 'Android' | 'iOS';
  osVersion: string;
  deviceName: string;
  browserName: 'Chrome' | 'Safari';
}

/** A locally-runnable native-app target: an emulator/simulator or a
 *  plugged-in real device, driven by `mobile/wdio.conf.ts` via Appium. */
export interface NativeTargetProfile {
  enabled: boolean;
  platformName: 'Android' | 'iOS';
  automationName: 'UiAutomator2' | 'XCUITest';
  deviceName: string;
  platformVersion?: string;
  /** Real-device UDID. Omit for emulator/simulator (Appium boots one by `deviceName`). */
  udid?: string;
  noReset?: boolean;
  /** Extra `appium:*` capabilities merged in verbatim (e.g. `appWaitActivity`). */
  extraCapabilities?: Record<string, unknown>;
}

/** A locally-runnable mobile-web target: a REAL mobile browser driven by
 *  Appium's accessibility-tree automation — not `browsers`' `mobile-chrome`/
 *  `mobile-safari` desktop-browser device emulation, which is a different,
 *  already-covered thing. */
export interface MobileWebTargetProfile {
  enabled: boolean;
  platformName: 'Android' | 'iOS';
  automationName: 'UiAutomator2' | 'XCUITest';
  deviceName: string;
  platformVersion?: string;
  browserName: 'Chrome' | 'Safari';
  udid?: string;
  extraCapabilities?: Record<string, unknown>;
}

export interface MobileTargetsConfig {
  native: Record<string, NativeTargetProfile>;
  mobileWeb: Record<string, MobileWebTargetProfile>;
  /** Try alternate locator strategies (a11y id → xpath → text) before
   *  failing — see `mobile/src/utils/selector.ts`. Defaults to `true`. */
  selectorFallback?: boolean;
}

export interface CustomerConfig {
  name: string;
  defaultEnv: string;
  envs: Record<string, EnvTierConfig>;
  browsers: Record<string, BrowserProject>;
  /** Optional locale dimension crossed with `browsers`/`browserstack.matrix` —
   *  see `crossWithLocales` in `./locale-projects.ts`. Absent/empty → today's
   *  exact one-project-per-browser(/matrix-entry) behavior. */
  locales?: Record<string, LocaleConfig>;
  /** Mobile-native and Appium-driven mobile-web targets — see `mobile/`.
   *  Absent for web-only customers; `mobile/wdio.conf.ts` fails fast if
   *  missing. */
  mobile?: MobileTargetsConfig;
  parallel: {
    workers: number | 'auto';
    fullyParallel: boolean;
    retries: { ci: number; local: number };
  };
  timeouts: {
    test: number;
    expect: number;
    action?: number;
    navigation?: number;
  };
  capture: {
    trace: CaptureMode;
    screenshot: CaptureMode;
    video: CaptureMode;
  };
  reporters: ReporterEntry[];
  auth: AuthConfig;
  features: FeatureFlags;
  browserstack?: BrowserstackConfig;
}

export interface Credential {
  role: string;
  user: string;
  pass: string;
}

export interface BrowserstackCredentials {
  username: string;
  accessKey: string;
  buildName?: string;
}

export interface EnvConfig {
  readonly tier: string;
  readonly baseUrl: string;
  readonly apiBaseUrl?: string;
  readonly credentials: ReadonlyArray<Credential>;
  readonly maskLogs: boolean;
  readonly bs?: BrowserstackCredentials;
  /** Frozen snapshot of validated env vars. Tests must read env through this, never `process.env`. */
  readonly raw: Readonly<Record<string, string>>;
}
