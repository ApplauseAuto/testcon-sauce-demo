/**
 * Login flow used when `customer.auth.mode` is 'per-worker-storage' (by
 * src/setup/auth.setup.ts) or 'per-test-login' (by the page fixture).
 *
 * Generated projects default to auth.mode 'none' — every recorded test
 * performs its own login steps — so this is only called once you switch the
 * mode. Implement it for your app: navigate, fill credentials, submit, then
 * wait for an authenticated indicator. Throw if any step fails.
 */

import type { Page } from '@playwright/test';

export interface Credentials {
  role: string;
  user: string;
  pass: string;
}

export async function loginFlow(page: Page, creds: Credentials, baseUrl: string): Promise<void> {
  void page;
  void creds;
  void baseUrl;
  throw new Error(
    'loginFlow() is not implemented — implement src/setup/login-flows/login-flow.ts or keep customer.config.ts auth.mode = "none".',
  );
}
