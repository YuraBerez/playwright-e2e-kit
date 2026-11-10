import { setAppReady } from './app-ready.js';
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
/**
 * A worker fixture (`scope: 'worker'`) that creates one resource per worker, shares it with every
 * test of that worker, and destroys it at worker teardown (also when a test failed). Use it for
 * data that is expensive to create and that no test changes, for example a read-only account.
 * Declare it in the second type argument of `test.extend<TestFixtures, WorkerFixtures>()`.
 */
export function workerResourceFixture(factory) {
    return [
        async ({ browserName: _browserName }, use) => {
            const resource = await factory.create();
            try {
                await use(resource);
            }
            finally {
                await factory.destroy(resource);
            }
        },
        { scope: 'worker' },
    ];
}
/**
 * Signs in once per worker and starts each test of that worker signed in: `workerSession` (a
 * worker fixture) runs `signIn` on a fresh page and keeps the state; `storageState` gives it to
 * each test's context. Spread into
 * `test.extend<SessionPerWorkerFixtures, SessionPerWorkerWorkerFixtures>({ ...sessionPerWorker({ signIn }) })`.
 *
 * One state per worker, not one for the whole run: workers that share one saved session share one
 * refresh token, and an app that rotates refresh tokens revokes the session when a second worker
 * uses the token that the first one already used.
 */
export function sessionPerWorker(options) {
    const save = (context) => options.indexedDB ? context.storageState({ indexedDB: true }) : context.storageState();
    return {
        workerSession: [
            async ({ browser }, use, workerInfo) => {
                const context = await browser.newContext({ baseURL: workerInfo.project.use.baseURL, storageState: undefined });
                let state;
                try {
                    const page = await context.newPage();
                    try {
                        await options.signIn({ page, workerInfo });
                    }
                    catch (cause) {
                        throw new Error(`sessionPerWorker: signIn failed in worker ${workerInfo.parallelIndex}.`, { cause });
                    }
                    state = await save(context);
                }
                finally {
                    await context.close();
                }
                await use({ state, parallelIndex: workerInfo.parallelIndex });
            },
            { scope: 'worker' },
        ],
        storageState: async ({ workerSession }, use) => {
            await use(workerSession.state);
        },
        workerSessionSave: [
            async ({ context, storageState, workerSession }, use) => {
                await use();
                // Only a test that started from the worker's state saves it back (not one with its own `test.use({ storageState })`).
                if (options.saveAfterEachTest && storageState === workerSession.state)
                    workerSession.state = await save(context);
            },
            { auto: true },
        ],
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
/**
 * Fixtures for the app-ready hook: the `appReady` option (set it with
 * `test.use({ appReady: appReadyOption(hook) })` or `defineE2EConfig({ … }, { appReady: hook })`)
 * and a `page` override that registers it for `BaseScreen`. Spread into
 * `test.extend({ ...appReadyFixture() })`.
 */
export function appReadyFixture() {
    return {
        // Default: no hook. A non-function value; a hook arrives through `appReadyOption()`.
        appReady: [undefined, { option: true }],
        page: async ({ page, appReady }, use) => {
            setAppReady(page, appReady);
            await use(page);
        },
    };
}
//# sourceMappingURL=fixtures.js.map