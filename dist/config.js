import { defineConfig } from '@playwright/test';
import { deterministicUse } from './determinism.js';
function isCi(options) {
    return options.ci ?? !!process.env.CI;
}
/**
 * The `grepInvert` that excludes quarantined tests, or `[]` when they are included. Add it to the
 * `grepInvert` of each project.
 */
export function quarantineGrepInvert(options = {}) {
    const include = options.includeQuarantine ?? process.env.E2E_QUARANTINE === 'include';
    return include ? [] : [options.quarantineTag ?? /@quarantine/];
}
/**
 * Defaults of the suite layout and run policy:
 * - explicit collection: Playwright owns `specs/**\/*.spec.ts` and `self-tests/**\/*.test.ts`;
 *   `__tests__/` holds unit tests of helpers and is ignored;
 * - fully parallel; `test.only` fails in CI;
 * - CI retries once and fails the run when a test only passed on retry (a flake is red, but
 *   reported as flaky); local runs do not retry;
 * - trace kept on failure; timezone and locale pinned.
 */
export function baseConfig(options = {}) {
    const ci = isCi(options);
    return {
        testMatch: ['specs/**/*.spec.ts', 'self-tests/**/*.test.ts'],
        testIgnore: ['**/__tests__/**'],
        fullyParallel: true,
        forbidOnly: ci,
        retries: ci ? 1 : 0,
        failOnFlakyTests: ci,
        workers: ci ? 2 : undefined,
        reporter: ci ? [['list'], ['html', { open: 'never' }]] : [['list']],
        use: {
            trace: 'retain-on-failure',
            ...deterministicUse(options.determinism),
        },
    };
}
/**
 * `baseConfig()` plus the app's own config. Top-level keys of `config` replace the defaults;
 * `use` is merged key by key.
 */
export function defineE2EConfig(config, options = {}) {
    const base = baseConfig(options);
    return defineConfig({ ...base, ...config, use: { ...base.use, ...config.use } });
}
