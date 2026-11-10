# Fixtures and data

**Set up state through a back door (API, seed), not through the UI.** Implement a
`ResourceFactory` per kind of test data and wrap it with `resourceFixture`. The resource is
created fresh for each test and destroyed at teardown, also when the test fails:

```ts
import { test as base } from '@playwright/test'
import { errorGuardFixture, resourceFixture, type ErrorGuard } from 'playwright-e2e-kit'

export const test = base.extend<{ errorGuard: ErrorGuard; user: User }>({
  errorGuard: errorGuardFixture({ allow: ALLOWED_ERRORS }),
  user: resourceFixture({ create: () => createUser(), destroy: (u) => deleteUser(u.id) }),
})
```

For data that a test creates while it runs, use `cleanupFixture()`. It gives the test a
`CleanupRegistry`; the registry runs its tasks last-in first-out at teardown and continues after a
failed task. By default a failed task is a warning; `cleanupFixture({ onFailure: 'throw' })` fails
the test.

Give each test fresh data. Never depend on data that another test left.

## Worker-scoped data and sessions

**`workerResourceFixture(factory)`** is `resourceFixture` with `scope: 'worker'`: the resource is
created once per worker, every test of the worker gets the same one, and it is destroyed at
worker teardown (also when a test failed). Use it only for data that no test changes (a read-only
catalog, a reference account). Declare it in the second type argument of `test.extend`.

**`sessionPerWorker({ signIn, saveAfterEachTest, indexedDB })`** signs in once per worker and starts
each test of that worker signed in:

- the `workerSession` worker fixture opens a fresh context (no storage state, the project's
  `baseURL`), runs `signIn({ page, workerInfo })`, and keeps the context state (cookies and
  `localStorage`; also IndexedDB with `indexedDB: true`, Playwright 1.51+) in memory;
- the `storageState` fixture gives that state to each test's context;
- with `saveAfterEachTest: true`, the auto fixture `workerSessionSave` saves the context state
  back at the end of each test, so the next test of the worker starts with the latest tokens.

```ts
// fixtures/session.ts
import { test as base } from '@playwright/test'
import {
  sessionPerWorker,
  workerResourceFixture,
  type SessionPerWorkerFixtures,
  type SessionPerWorkerWorkerFixtures,
} from 'playwright-e2e-kit'

interface Account {
  email: string
  password: string
}
interface Catalog {
  id: string
}

// One account per worker: an app that allows one session per account needs it.
const accounts = JSON.parse(process.env.E2E_ACCOUNTS ?? '[]') as Account[]
const api = process.env.E2E_API_URL ?? 'http://localhost:8080/test-data'

export const test = base.extend<SessionPerWorkerFixtures, SessionPerWorkerWorkerFixtures & { catalog: Catalog }>({
  ...sessionPerWorker({
    signIn: async ({ page, workerInfo }) => {
      const account = accounts[workerInfo.parallelIndex % accounts.length]!
      await page.goto('/login')
      await page.getByLabel('Email').fill(account.email)
      await page.getByLabel('Password').fill(account.password)
      await page.getByRole('button', { name: 'Sign in' }).click()
      await page.waitForURL('**/home')
    },
    saveAfterEachTest: true, // the app rotates its refresh token
  }),
  // Read-only data that every test of the worker shares; removed at worker teardown.
  catalog: workerResourceFixture({
    create: async () => (await (await fetch(`${api}/catalogs`, { method: 'POST' })).json()) as Catalog,
    destroy: async (catalog) => {
      await fetch(`${api}/catalogs/${catalog.id}`, { method: 'DELETE' })
    },
  }),
})
```

**Why one session per worker and not one for the run.** The common pattern signs in once in a
global setup and gives one saved `storageState` file to every worker. That fails for an app that
rotates its refresh token (each refresh returns a new refresh token and invalidates the old one):

1. All workers start with the same refresh token.
2. The first worker that refreshes uses it up and gets a new one.
3. The next worker sends the old token. The server sees a reused refresh token, takes it as a
   theft, and revokes the whole session (often every token of the account). All workers are
   signed out, and the tests fail at random places.

`sessionPerWorker` gives each worker its own sign-in, so each worker has its own token chain.
Inside one worker the tests run one after the other, but each test starts from the saved state:
when the app refreshes in one test, the next test starts with the used token. Turn on
`saveAfterEachTest` for such an app. Then:

- a test that signs out, or that changes the session (another user, a revoked token), sets its own
  state with `test.use({ storageState: { cookies: [], origins: [] } })`. A test with its own state
  is never saved back;
- if the app allows one session per account, give each worker its own account
  (`workerInfo.parallelIndex`, as in the example);
- a worker that restarts after a failure signs in again.

