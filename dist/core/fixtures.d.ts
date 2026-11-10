import type { Browser, BrowserContext, Page, WorkerInfo } from "@playwright/test";
import { type AppReady, type AppReadyOption } from "./app-ready.js";
import { CleanupRegistry, type ResourceFactory } from "./data.js";
import { ErrorGuard, type ErrorGuardOptions } from "./error-guard.js";
/**
 * Playwright reads the fixture function's source to find its dependencies and requires an
 * object-destructuring first argument. Depending on `browserName` (always available) satisfies
 * that without an empty pattern.
 */
type NoDeps = {
    browserName: string;
};
type Use<T> = (value: T) => Promise<void>;
/**
 * A fixture that creates a fresh resource for the test and destroys it at teardown, also when the
 * test fails.
 */
export declare function resourceFixture<T>(factory: ResourceFactory<T>): ({ browserName: _browserName }: NoDeps, use: Use<T>) => Promise<void>;
/**
 * A worker fixture (`scope: 'worker'`) that creates one resource per worker, shares it with every
 * test of that worker, and destroys it at worker teardown (also when a test failed). Use it for
 * data that is expensive to create and that no test changes, for example a read-only account.
 * Declare it in the second type argument of `test.extend<TestFixtures, WorkerFixtures>()`.
 */
export declare function workerResourceFixture<T>(factory: ResourceFactory<T>): [
    ({ browserName }: NoDeps, use: Use<T>) => Promise<void>,
    {
        scope: "worker";
    }
];
/** The cookies and origin storage of a signed-in session, as `context.storageState()` returns it. */
export type SessionState = Awaited<ReturnType<BrowserContext["storageState"]>>;
/** The signed-in session of one worker (the `workerSession` worker fixture of `sessionPerWorker`). */
export interface WorkerSession {
    /** The state that the next test of this worker starts with. */
    state: SessionState;
    /** `workerInfo.parallelIndex` of the worker that signed in. */
    parallelIndex: number;
}
export interface SessionPerWorkerOptions {
    /**
     * Signs in on `page`, a fresh page in a context with no storage state (and the project's
     * `baseURL`). Use `workerInfo.parallelIndex` to pick one account per worker if the app allows
     * only one session per account. The kit saves the page's context state when it returns.
     */
    signIn: (args: {
        page: Page;
        workerInfo: WorkerInfo;
    }) => Promise<void>;
    /**
     * Save the context state back at the end of each test, so the next test of the worker starts
     * with the latest tokens. Turn it on when the app rotates its refresh token: the saved token is
     * used up by the first refresh, and a reuse revokes the session. A test that signs out or
     * changes the session must then set its own `storageState` with `test.use()` (that test is not
     * saved back). Default `false`.
     */
    saveAfterEachTest?: boolean;
    /** Also save IndexedDB (Playwright 1.51+), for apps that keep their tokens there. Default `false`. */
    indexedDB?: boolean;
}
/** Test fixtures of `sessionPerWorker`: the `storageState` override and the auto save-back fixture. */
export interface SessionPerWorkerFixtures {
    workerSessionSave: void;
}
/** Worker fixtures of `sessionPerWorker`. */
export interface SessionPerWorkerWorkerFixtures {
    workerSession: WorkerSession;
}
export declare function sessionPerWorker(options: SessionPerWorkerOptions): {
    workerSession: [({ browser }: {
        browser: Browser;
    }, use: Use<WorkerSession>, workerInfo: WorkerInfo) => Promise<void>, {
        scope: "worker";
    }];
    storageState: ({ workerSession }: {
        workerSession: WorkerSession;
    }, use: Use<SessionState>) => Promise<void>;
    workerSessionSave: [(args: {
        context: BrowserContext;
        storageState: unknown;
        workerSession: WorkerSession;
    }, use: Use<void>) => Promise<void>, {
        auto: true;
    }];
};
export interface CleanupFixtureOptions {
    /** `warn` (default) logs failed cleanup tasks; `throw` fails the test. */
    onFailure?: "warn" | "throw";
}
/** A fixture that gives the test a `CleanupRegistry` and runs it at teardown. */
export declare function cleanupFixture(options?: CleanupFixtureOptions): ({ browserName: _browserName }: NoDeps, use: Use<CleanupRegistry>) => Promise<void>;
/**
 * The error guard as an auto fixture: it watches the test's browser context and fails the test at
 * teardown. Watch extra contexts with `errorGuard.watch(context)`.
 */
export declare function errorGuardFixture(options?: ErrorGuardOptions): [
    ({ context }: {
        context: BrowserContext;
    }, use: Use<ErrorGuard>) => Promise<void>,
    {
        auto: true;
    }
];
/**
 * Fixtures for the app-ready hook: the `appReady` option (set it with
 * `test.use({ appReady: appReadyOption(hook) })` or `defineE2EConfig({ … }, { appReady: hook })`)
 * and a `page` override that registers it for `BaseScreen`. Spread into
 * `test.extend({ ...appReadyFixture() })`.
 */
export declare function appReadyFixture(): {
    appReady: [undefined | AppReadyOption, {
        option: true;
    }];
    page: ({ page, appReady }: {
        page: Page;
        appReady: AppReady | undefined;
    }, use: Use<Page>) => Promise<void>;
};
export {};
//# sourceMappingURL=fixtures.d.ts.map