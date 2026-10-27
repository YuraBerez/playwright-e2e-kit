/**
 * Pinned browser environment for every e2e run, so results do not depend on the timezone or
 * language of the machine or CI runner. A spec changes the locale only with `test.use({ locale })`
 * at file or describe level.
 */
export declare const DEFAULT_TIMEZONE = "UTC";
export declare const DEFAULT_LOCALE = "en-US";
export interface Determinism {
    timezoneId: string;
    locale: string;
}
/** The `use` options that pin timezone and locale. */
export declare function deterministicUse(overrides?: Partial<Determinism>): Determinism;
