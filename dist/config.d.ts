import { type PlaywrightTestConfig } from '@playwright/test';
import { type Determinism } from './determinism.js';
export interface E2EConfigOptions {
    /** CI mode. Default: `CI` is set in the environment. */
    ci?: boolean;
    /** Tests with this tag are quarantined. Default `/@quarantine/`. */
    quarantineTag?: RegExp;
    /** Run quarantined tests too. Default: `E2E_QUARANTINE=include`. */
    includeQuarantine?: boolean;
    /** Timezone and locale pinned for every project. */
    determinism?: Partial<Determinism>;
}
/**
 * The `grepInvert` that excludes quarantined tests, or `[]` when they are included. Add it to the
 * `grepInvert` of each project.
 */
export declare function quarantineGrepInvert(options?: E2EConfigOptions): RegExp[];
/**
 * Defaults of the suite layout and run policy:
 * - explicit collection: Playwright owns `specs/**\/*.spec.ts` and `self-tests/**\/*.test.ts`;
 *   `__tests__/` holds unit tests of helpers and is ignored;
 * - fully parallel; `test.only` fails in CI;
 * - CI retries once and fails the run when a test only passed on retry (a flake is red, but
 *   reported as flaky); local runs do not retry;
 * - trace kept on failure; timezone and locale pinned.
 */
export declare function baseConfig(options?: E2EConfigOptions): PlaywrightTestConfig;
/**
 * `baseConfig()` plus the app's own config. Top-level keys of `config` replace the defaults;
 * `use` is merged key by key.
 */
export declare function defineE2EConfig(config: PlaywrightTestConfig, options?: E2EConfigOptions): PlaywrightTestConfig;
