/**
 * Path helpers for the skeleton.
 *
 * - `authFilePath(customer, role, workerIndex)` composes `<storageDir>/user-<role>-<index>.json`.
 * - `repoRoot()` walks up from `process.cwd()` until it finds a `package.json` and returns
 *   that directory. Falls back to `process.cwd()` when no package.json is found.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CustomerConfig } from '../config/types';

export function authFilePath(cfg: CustomerConfig, role: string, workerIndex: number): string {
  const dir = path.isAbsolute(cfg.auth.storageDir)
    ? cfg.auth.storageDir
    : path.join(process.cwd(), cfg.auth.storageDir);
  return path.join(dir, `user-${role}-${workerIndex}.json`);
}

export function repoRoot(startDir: string = process.cwd()): string {
  let cur = path.resolve(startDir);
  // Limit ascent to prevent infinite loop on broken filesystems.
  for (let i = 0; i < 32; i++) {
    if (fs.existsSync(path.join(cur, 'package.json'))) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return path.resolve(startDir);
}
