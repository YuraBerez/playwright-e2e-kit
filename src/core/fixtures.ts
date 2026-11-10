import type { Browser, BrowserContext, Page, WorkerInfo } from '@playwright/test'
import { setAppReady, type AppReady, type AppReadyOption } from './app-ready.js'
import { CleanupRegistry, formatCleanupFailures, type CleanupFailure, type ResourceFactory } from './data.js'
import { ErrorGuard, type ErrorGuardOptions } from './error-guard.js'

/**
 * Playwright reads the fixture function's source to find its dependencies and requires an
 * object-destructuring first argument. Depending on `browserName` (always available) satisfies
 * that without an empty pattern.
 */
type NoDeps = { browserName: string }

type Use<T> = (value: T) => Promise<void>

/**
 * A fixture that creates a fresh resource for the test and destroys it at teardown, also when the
 * test fails.
 */
export function resourceFixture<T>(factory: ResourceFactory<T>) {
  return async ({ browserName: _browserName }: NoDeps, use: Use<T>): Promise<void> => {
    const resource = await factory.create()
    try {
      await use(resource)
    } finally {
      await factory.destroy(resource)
    }
  }
}

/**
 * A worker fixture (`scope: 'worker'`) that creates one resource per worker, shares it with every
 * test of that worker, and destroys it at worker teardown (also when a test failed). Use it for
 * data that is expensive to create and that no test changes, for example a read-only account.
 * Declare it in the second type argument of `test.extend<TestFixtures, WorkerFixtures>()`.
 */
export function workerResourceFixture<T>(
  factory: ResourceFactory<T>,
): [({ browserName }: NoDeps, use: Use<T>) => Promise<void>, { scope: 'worker' }] {
  return [
    async ({ browserName: _browserName }: NoDeps, use: Use<T>): Promise<void> => {
      const resource = await factory.create()
      try {
        await use(resource)
      } finally {
        await factory.destroy(resource)
      }
    },
    { scope: 'worker' },
  ]
}

/** The cookies and origin storage of a signed-in session, as `context.storageState()` returns it. */
export type SessionState = Awaited<ReturnType<BrowserContext['storageState']>>

/** The signed-in session of one worker (the `workerSession` worker fixture of `sessionPerWorker`). */
export interface WorkerSession {
  /** The state that the next test of this worker starts with. */
  state: SessionState
  /** `workerInfo.parallelIndex` of the worker that signed in. */
  parallelIndex: number
}

export interface SessionPerWorkerOptions {
  /**
   * Signs in on `page`, a fresh page in a context with no storage state (and the project's
   * `baseURL`). Use `workerInfo.parallelIndex` to pick one account per worker if the app allows
   * only one session per account. The kit saves the page's context state when it returns.
   */
  signIn: (args: { page: Page; workerInfo: WorkerInfo }) => Promise<void>
  /**
   * Save the context state back at the end of each test, so the next test of the worker starts
   * with the latest tokens. Turn it on when the app rotates its refresh token: the saved token is
   * used up by the first refresh, and a reuse revokes the session. A test that signs out or
   * changes the session must then set its own `storageState` with `test.use()` (that test is not
   * saved back). Default `false`.
   */
  saveAfterEachTest?: boolean
  /** Also save IndexedDB (Playwright 1.51+), for apps that keep their tokens there. Default `false`. */
  indexedDB?: boolean
}

/** Test fixtures of `sessionPerWorker`: the `storageState` override and the auto save-back fixture. */
export interface SessionPerWorkerFixtures {
  workerSessionSave: void
}

/** Worker fixtures of `sessionPerWorker`. */
export interface SessionPerWorkerWorkerFixtures {
  workerSession: WorkerSession
}

const CONTEXT_OPTION_KEYS = [
  'baseURL',
  'acceptDownloads',
  'bypassCSP',
  'colorScheme',
  'contrast',
  'deviceScaleFactor',
  'extraHTTPHeaders',
  'forcedColors',
  'geolocation',
  'hasTouch',
  'httpCredentials',
  'ignoreHTTPSErrors',
  'isMobile',
  'javaScriptEnabled',
  'locale',
  'offline',
  'permissions',
  'proxy',
  'reducedMotion',
  'screen',
  'serviceWorkers',
  'timezoneId',
  'userAgent',
  'viewport',
] as const

/** The project's context options (`use`) that the sign-in context must share with the tests' contexts. */
function contextOptions(use: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {}
  for (const key of CONTEXT_OPTION_KEYS) if (use[key] !== undefined) picked[key] = use[key]
  return picked
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
export function sessionPerWorker(options: SessionPerWorkerOptions) {
  const save = (context: BrowserContext): Promise<SessionState> =>
    options.indexedDB ? context.storageState({ indexedDB: true }) : context.storageState()
  return {
    workerSession: [
      async ({ browser }: { browser: Browser }, use: Use<WorkerSession>, workerInfo: WorkerInfo): Promise<void> => {
        const context = await browser.newContext({ ...contextOptions(workerInfo.project.use), storageState: undefined })
        let state: SessionState
        try {
          const page = await context.newPage()
          try {
            await options.signIn({ page, workerInfo })
          } catch (cause) {
            throw new Error(`sessionPerWorker: signIn failed in worker ${workerInfo.parallelIndex}.`, { cause })
          }
          state = await save(context)
        } finally {
          await context.close()
        }
        await use({ state, parallelIndex: workerInfo.parallelIndex })
      },
      { scope: 'worker' },
    ] as [
      ({ browser }: { browser: Browser }, use: Use<WorkerSession>, workerInfo: WorkerInfo) => Promise<void>,
      { scope: 'worker' },
    ],
    storageState: async ({ workerSession }: { workerSession: WorkerSession }, use: Use<SessionState>): Promise<void> => {
      await use(workerSession.state)
    },
    workerSessionSave: [
      options.saveAfterEachTest
        ? async (
            { context, storageState, workerSession }: { context: BrowserContext; storageState: unknown; workerSession: WorkerSession },
            use: Use<void>,
          ): Promise<void> => {
            await use()
            // Only a test that started from the worker's state saves it back (not one with its own `test.use({ storageState })`).
            if (storageState === workerSession.state) workerSession.state = await save(context)
          }
        : // Off: depends on nothing, so no test context is opened for it.
          (async ({ browserName: _browserName }: NoDeps, use: Use<void>): Promise<void> => {
            await use()
          }) as never,
      { auto: true },
    ] as [
      (
        args: { context: BrowserContext; storageState: unknown; workerSession: WorkerSession },
        use: Use<void>,
      ) => Promise<void>,
      { auto: true },
    ],
  }
}

export interface CleanupFixtureOptions {
  /** `warn` (default) logs failed cleanup tasks; `throw` fails the test. */
  onFailure?: 'warn' | 'throw'
}

/** A fixture that gives the test a `CleanupRegistry` and runs it at teardown. */
export function cleanupFixture(options: CleanupFixtureOptions = {}) {
  return async ({ browserName: _browserName }: NoDeps, use: Use<CleanupRegistry>): Promise<void> => {
    const registry = new CleanupRegistry()
    let failures: CleanupFailure[]
    try {
      await use(registry)
    } finally {
      // Runs also when the test failed; the test's own error stays the reported one.
      failures = await registry.runAll()
      if (failures.length > 0 && options.onFailure !== 'throw') console.warn(formatCleanupFailures(failures))
    }
    if (failures.length > 0 && options.onFailure === 'throw') throw new Error(formatCleanupFailures(failures))
  }
}

/**
 * The error guard as an auto fixture: it watches the test's browser context and fails the test at
 * teardown. Watch extra contexts with `errorGuard.watch(context)`.
 */
export function errorGuardFixture(
  options: ErrorGuardOptions = {},
): [({ context }: { context: BrowserContext }, use: Use<ErrorGuard>) => Promise<void>, { auto: true }] {
  return [
    async ({ context }: { context: BrowserContext }, use: Use<ErrorGuard>): Promise<void> => {
      const guard = new ErrorGuard(options)
      await guard.watch(context)
      await use(guard)
      guard.assertClean()
    },
    { auto: true },
  ]
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
    appReady: [undefined, { option: true }] as [undefined | AppReadyOption, { option: true }],
    page: async ({ page, appReady }: { page: Page; appReady: AppReady | undefined }, use: Use<Page>): Promise<void> => {
      setAppReady(page, appReady)
      await use(page)
    },
  }
}
