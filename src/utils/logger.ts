/**
 * CrownCoins-style structured logger with regex-based sensitive-data masking.
 * Stateless and thread-safe — no module-level mutable state.
 *
 * Public API:
 *   Logger.info / debug / warn / error          - one-line messages with masking
 *   Logger.action(name)                          - shorthand for an info-level step marker
 *   Logger.verify(cond, msg)                     - asserts a boolean; logs success or throws
 *   Logger.step(name, fn)                        - wraps a body in Playwright `test.step` when available
 *   Logger.withContext(opts)                     - returns a BoundLogger bound to a prefix / mask state
 *
 * Behavior gates:
 *   MASK_LOGS env var (default "true") globally toggles masking.
 *   LoggerOptions.maskEnabled overrides the env per logger.
 */

export interface LoggerOptions {
  maskEnabled?: boolean;
  customMaskPatterns?: RegExp[];
  prefix?: string;
}

export interface BoundLogger {
  info(msg: string, ctx?: unknown): void;
  debug(msg: string, ctx?: unknown): void;
  warn(msg: string, ctx?: unknown): void;
  error(msg: string, ctx?: unknown): void;
  step<T>(name: string, body: () => Promise<T> | T): Promise<T>;
}

const MASK = '[MASKED]';

/**
 * Default patterns to mask. Each replaces the matched portion (or a specific
 * capture group) with `[MASKED]`. They are deliberately permissive about
 * surrounding characters because real-world output is messy.
 */
export const DEFAULT_MASK_PATTERNS: RegExp[] = [
  // emails (https://emailregex.com — simplified)
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  // password=... / pass=... up to whitespace or quote
  /(password|pass)\s*[=:]\s*([^\s"',;]+)/gi,
  // token=... / api_key=... / api-key=...
  /(token|api[_-]?key)\s*[=:]\s*([^\s"',;]+)/gi,
  // Authorization: Bearer ...
  /(authorization)\s*:\s*([^\r\n]+)/gi,
  // JWT-shaped strings: 3 base64-ish segments separated by '.'
  /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g,
];

function maskingEnabled(opts?: LoggerOptions): boolean {
  if (opts && typeof opts.maskEnabled === 'boolean') return opts.maskEnabled;
  const env = (typeof process !== 'undefined' ? process.env.MASK_LOGS : undefined) ?? 'true';
  return env.toLowerCase() !== 'false';
}

function maskString(input: string, opts?: LoggerOptions): string {
  if (!maskingEnabled(opts)) return input;
  let out = input;
  const patterns = [...DEFAULT_MASK_PATTERNS, ...(opts?.customMaskPatterns ?? [])];
  for (const re of patterns) {
    re.lastIndex = 0;
    // String.replace passes (match, p1, p2, ..., offset, fullString). When the
    // regex has 2 capture groups (e.g. key=value), the second group is the
    // secret portion we want to redact while preserving the key prefix.
    // We use a function-typed replacer and inspect args to distinguish "no
    // groups" (only match + offset + string) from "2 groups" cases.
    out = out.replace(re, (...args: unknown[]) => {
      const match = args[0] as string;
      // The last two args are always (offset:number, full:string). Between
      // them and `match` are the capture groups. So `args.length - 3` is the
      // number of capture groups.
      const groupCount = args.length - 3;
      if (groupCount >= 2) {
        const g2 = args[2] as string;
        if (typeof g2 === 'string') return match.replace(g2, MASK);
      }
      return MASK;
    });
  }
  return out;
}

function formatContext(ctx: unknown, opts?: LoggerOptions): string {
  if (ctx === undefined) return '';
  let s: string;
  try {
    s = typeof ctx === 'string' ? ctx : JSON.stringify(ctx);
  } catch {
    s = String(ctx);
  }
  return ' ' + maskString(s, opts);
}

function emit(
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR',
  msg: string,
  ctx: unknown,
  opts?: LoggerOptions,
): void {
  const prefix = opts?.prefix ? `[${opts.prefix}] ` : '';
  const line = `${prefix}[${level}] ${maskString(msg, opts)}${formatContext(ctx, opts)}`;
  const out: 'log' | 'warn' | 'error' =
    level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log';
  console[out](line);
}

async function runStep<T>(
  name: string,
  body: () => Promise<T> | T,
  opts?: LoggerOptions,
): Promise<T> {
  // Lazy-load @playwright/test so non-Playwright contexts (vitest) still work.
  let testStep: ((name: string, fn: () => Promise<T> | T) => Promise<T>) | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pw = require('@playwright/test') as { test?: { step?: typeof testStep } };
    testStep = pw?.test?.step?.bind(pw.test);
  } catch {
    testStep = undefined;
  }
  if (testStep) {
    try {
      return await testStep(name, async () => {
        emit('INFO', `↳ ${name}`, undefined, opts);
        try {
          const v = await body();
          return v;
        } catch (err) {
          emit('ERROR', `step '${name}' failed: ${(err as Error).message}`, undefined, opts);
          throw err;
        }
      });
    } catch (err) {
      // `test.step` throws when called outside a real test (e.g. vitest unit
      // runs invoking Logger directly). If THAT is the case, fall through and
      // run the body without Playwright integration. We can detect this by
      // matching the Playwright-internal error; otherwise re-throw.
      if ((err as Error).message?.includes('can only be called from a test')) {
        // fall through to plain execution below
      } else {
        throw err;
      }
    }
  }
  emit('INFO', `↳ ${name}`, undefined, opts);
  try {
    const v = await body();
    return v;
  } catch (err) {
    emit('ERROR', `step '${name}' failed: ${(err as Error).message}`, undefined, opts);
    throw err;
  }
}

export class Logger {
  static info(msg: string, ctx?: unknown): void {
    emit('INFO', msg, ctx);
  }
  static debug(msg: string, ctx?: unknown): void {
    emit('DEBUG', msg, ctx);
  }
  static warn(msg: string, ctx?: unknown): void {
    emit('WARN', msg, ctx);
  }
  static error(msg: string, ctx?: unknown): void {
    emit('ERROR', msg, ctx);
  }
  static action(name: string): void {
    emit('INFO', `▶ ${name}`, undefined);
  }
  static verify(condition: boolean, message: string): void {
    if (!condition) {
      emit('ERROR', `verify failed: ${message}`, undefined);
      throw new Error(`verify failed: ${message}`);
    }
    emit('INFO', `✓ ${message}`, undefined);
  }
  static async step<T>(name: string, body: () => Promise<T> | T): Promise<T> {
    return runStep(name, body);
  }

  static withContext(opts: LoggerOptions): BoundLogger {
    const bound: BoundLogger = {
      info: (msg, ctx) => emit('INFO', msg, ctx, opts),
      debug: (msg, ctx) => emit('DEBUG', msg, ctx, opts),
      warn: (msg, ctx) => emit('WARN', msg, ctx, opts),
      error: (msg, ctx) => emit('ERROR', msg, ctx, opts),
      step: <T>(name: string, body: () => Promise<T> | T) => runStep<T>(name, body, opts),
    };
    return bound;
  }
}
