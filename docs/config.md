# Config and app-ready hook

## Playwright config

```ts
import { devices } from '@playwright/test'
import { defineE2EConfig, quarantineGrepInvert } from 'playwright-e2e-kit/config'

const quarantine = quarantineGrepInvert()

export default defineE2EConfig({
  testDir: './e2e',
  use: { baseURL: 'https://localhost:4173' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] }, grepInvert: quarantine }],
})
```

`baseConfig()` defaults: Playwright collects only `specs/**/*.spec.ts` and `self-tests/**/*.test.ts`
and ignores `__tests__/`; fully parallel; `test.only` fails in CI; trace kept on failure; timezone
`UTC` and locale `en-US` pinned. Top-level keys of the app config replace the defaults; `use` is
merged key by key.

## App-ready hook

`BaseScreen.open()` returns after `page.goto`. A SPA or canvas app may not take input then. Set one
optional hook, `AppReady = (page: Page) => Promise<void>`. `open()` and `reload()` await it. With no
hook they do only `goto` / `reload`, so an app that sets nothing sees no change.

```ts
// fixtures/app.ts
import { test as base } from '@playwright/test'
import { appReadyFixture, type AppReady } from 'playwright-e2e-kit'

export const test = base.extend<{ appReady: AppReady | undefined }>(appReadyFixture())

// playwright.config.ts
import { nuxtReady } from 'playwright-e2e-kit'
import { defineE2EConfig } from 'playwright-e2e-kit/config'

export default defineE2EConfig({ testDir: './e2e' }, { appReady: nuxtReady })
```

Ready-made hooks (none is on by default): `domContentReady`, `nuxtReady` (Nuxt hydrated),
`angularReady` (Angular bootstrapped; every testability stable, or the `ng-version` root when the
app is zoneless). Playwright calls a bare function in `test.use()` as a fixture, so wrap a hook
there with `appReadyOption(hook)`; `defineE2EConfig` and `flutterConfig` wrap it for you. A screen
can override `protected waitReady()`. A preset (for example a Flutter one) sets `appReady` the same
way, through the config `use`.


## Timeouts for slow backends

Playwright has four separate time limits. A slow backend (a cold start, a database that wakes up, a
sign-in that calls a third-party service) needs the right one, not all of them.

| Limit | Default | What it covers | Where to set it |
|---|---|---|---|
| Test `timeout` | 30 s | The whole test, with its fixtures and hooks. | `timeout` in the config, `test.setTimeout()`, `test.slow()` |
| `expect.timeout` | 5 s | One web-first assertion (`toBeVisible`, `toHaveText`, …). | `expect: { timeout }` in the config, or `{ timeout }` on one call |
| `use.actionTimeout` | none | One action (`click`, `fill`, …). | `use: { actionTimeout }` |
| `use.navigationTimeout` | none | `goto`, `reload`, `waitForURL`. | `use: { navigationTimeout }` |

`baseConfig()` does not change any of them, so Playwright's defaults apply. Top-level keys of the
app config replace the defaults and `use` is merged key by key, so you set them like this:

```ts
export default defineE2EConfig({
  testDir: './e2e',
  timeout: 60_000, // the test, including its fixtures
  expect: { timeout: 10_000 }, // one assertion
  use: {
    baseURL: 'https://localhost:4173',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
})
```

Rules that keep the suite fast and honest:

- **Raise the limit of the slow step only.** A slow sign-in or a first page load gets
  `{ timeout }` on that one `expect` or `test.slow()` on that one test. A high global
  `expect.timeout` makes every real failure slower to report.
- **A fixture counts against the test timeout** unless it has its own limit. Give a slow
  fixture (for example a sign-in at worker level) `{ scope: 'worker', timeout: 120_000 }`; then
  it does not use the budget of the first test.
- **The timeout of the application's own requests is a different setting.** The `timeout` of a
  `request` call, a `fetch` or an `AbortController` in the app, and the limits of a proxy or an
  API client in your data layer, are not changed by the Playwright limits above. If the app gives
  up after 10 s, a test timeout of 60 s does not help. Raise the app's timeout in the test
  environment (a build flag, an environment variable), or make the backend faster.
- **Do not use `waitForTimeout`.** The layer rules forbid it. Wait for a condition: a locator, a
  URL, a response.
- **App-ready waits have their own timeout** (`flutterReadyWith({ timeout })`,
  `composeReadyWith({ timeout })`). They also count against the test timeout.

## Traces and secrets

`baseConfig()` sets `trace: 'retain-on-failure'`. A Playwright trace (`trace.zip`) is a full
record of the test, and it is not redacted:

- every value passed to `fill()` and `type()` (passwords, one-time codes, tokens), also in the
  action log and in the DOM snapshots;
- request and response headers (`Authorization`, `Cookie`, `Set-Cookie`) and bodies of the API
  calls the page makes, including sign-in responses;
- screenshots, console messages and the source of the test.

The error guard and the kit's own messages do not print typed values, but the trace does. So:

- **Keep traces out of public CI artifacts.** Upload `playwright-report/` and the test output
  without `*.zip`, or keep the artifact private and short-lived (`retention-days`). The
  reusable Compose workflow already leaves traces out unless you set `upload-traces: true`
  (see [Compose MP web in CI](ci.md)).
- **Use test accounts and test secrets only.** Never put a production credential in a test. A
  trace of a failed run is then safe to share inside the team.
- **Turn the trace off for a sensitive test** with `test.use({ trace: 'off' })` at file or describe
  level, or set `trace: 'off'` in the project `use` for a whole suite that signs in with real
  secrets.
- **Rotate a secret that leaked** into a trace that was uploaded or shared.
