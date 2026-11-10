/**
 * Pinned browser environment for every e2e run, so results do not depend on the timezone or
 * language of the machine or CI runner. A spec changes the locale only with `test.use({ locale })`
 * at file or describe level.
 */
export const DEFAULT_TIMEZONE = 'UTC'
export const DEFAULT_LOCALE = 'en-US'

export interface Determinism {
  timezoneId: string
  locale: string
}

/** The `use` options that pin timezone and locale. */
export function deterministicUse(overrides: Partial<Determinism> = {}): Determinism {
  return { timezoneId: DEFAULT_TIMEZONE, locale: DEFAULT_LOCALE, ...overrides }
}
