/**
 * Crosses a list of Playwright project descriptions with an optional locale
 * map, producing one project per (project × locale) combo. Shared by
 * `playwright.config.ts` (local `browsers`) and `src/config/browserstack.ts`
 * (`browserstack.matrix`) so the cross-product/`use`-merge logic isn't
 * duplicated between the two project-builders.
 */
import type { LocaleConfig } from './types';

export function crossWithLocales<T extends { name: string; use: Record<string, unknown> }>(
  base: T[],
  locales: Record<string, LocaleConfig> | undefined,
): T[] {
  const entries = Object.entries(locales ?? {});
  if (entries.length === 0) return base;

  return base.flatMap((project) =>
    entries.map(([localeKey, cfg]) => ({
      ...project,
      name: `${project.name}-${localeKey}`,
      use: {
        ...project.use,
        ...(cfg.locale ? { locale: cfg.locale } : {}),
        ...(cfg.timezoneId ? { timezoneId: cfg.timezoneId } : {}),
        ...(cfg.baseUrl ? { baseURL: cfg.baseUrl } : {}),
      },
    })),
  );
}
