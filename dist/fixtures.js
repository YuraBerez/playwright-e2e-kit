import { CleanupRegistry, formatCleanupFailures } from './data.js';
import { ErrorGuard } from './error-guard.js';
/**
 * A fixture that creates a fresh resource for the test and destroys it at teardown, also when the
 * test fails.
 */
export function resourceFixture(factory) {
    return async ({ browserName: _browserName }, use) => {
        const resource = await factory.create();
        try {
            await use(resource);
        }
        finally {
            await factory.destroy(resource);
        }
    };
}
/** A fixture that gives the test a `CleanupRegistry` and runs it at teardown. */
export function cleanupFixture(options = {}) {
    return async ({ browserName: _browserName }, use) => {
        const registry = new CleanupRegistry();
        let failures;
        try {
            await use(registry);
        }
        finally {
            // Runs also when the test failed; the test's own error stays the reported one.
            failures = await registry.runAll();
            if (failures.length > 0 && options.onFailure !== 'throw')
                console.warn(formatCleanupFailures(failures));
        }
        if (failures.length > 0 && options.onFailure === 'throw')
            throw new Error(formatCleanupFailures(failures));
    };
}
/**
 * The error guard as an auto fixture: it watches the test's browser context and fails the test at
 * teardown. Watch extra contexts with `errorGuard.watch(context)`.
 */
export function errorGuardFixture(options = {}) {
    return [
        async ({ context }, use) => {
            const guard = new ErrorGuard(options);
            await guard.watch(context);
            await use(guard);
            guard.assertClean();
        },
        { auto: true },
    ];
}
