# Lightpanda

`playwright-e2e-kit/lightpanda` runs a part of the suite in
[Lightpanda](https://lightpanda.io), a headless browser without layout and paint. Lightpanda
starts faster and uses less memory than Chromium. Playwright controls it through CDP
(`chromium.connectOverCDP`), so screens, steps and specs do not change.

Use Lightpanda for tests that examine behaviour, not pixels. Keep each test that needs a
renderer in Chromium, Firefox or WebKit.

## How it works

- A test with the tag `@lightpanda` runs in the Lightpanda project only. All other tests run in
  the rendering project.
- Each worker starts its own `lightpanda serve` process on a free local port. One Lightpanda
  process holds one browser context, and a worker runs one test at a time.
- A test with the tag `@critical` fails in a Lightpanda project. A critical scenario must run in
  a browser that renders.
- The entry point is opt-in. No other entry point imports it, and it has no new dependency.

## Install the binary

The kit does not download Lightpanda. Install a pinned release:

1. Download the binary for your platform from the GitHub releases of `lightpanda-io/browser`
   (for example `lightpanda-x86_64-linux` or `lightpanda-aarch64-macos`).
2. Examine the SHA-256 of the file.
3. Set `LIGHTPANDA_EXECUTABLE_PATH` to the path of the file.

If `LIGHTPANDA_EXECUTABLE_PATH` is not set, the kit uses `~/.cache/lightpanda-node/lightpanda`.
`npx @lightpanda/browser install` writes the binary there. But that command installs the
nightly build, so do not use it in CI.

## Config and fixtures

`lightpandaProjects(project)` gives two projects. The first is `project` with the tag in
`grepInvert`. The second is `<name>-lightpanda` with the tag in `grep`:

```ts
// playwright.config.ts
import { devices } from '@playwright/test'
import { defineE2EConfig } from 'playwright-e2e-kit/config'
import { lightpandaProjects } from 'playwright-e2e-kit/lightpanda'

export default defineE2EConfig({
  testDir: './e2e',
  projects: lightpandaProjects({
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], baseURL: 'https://localhost:4173' },
  }),
})
```

The Lightpanda project keeps the context options of `project.use` (`baseURL`, `storageState`,
`locale` and the other options). It removes the device keys that need a renderer (`viewport`,
`screen`, `deviceScaleFactor`, `isMobile`, `hasTouch`) and the Chrome `userAgent`. It sets
`userAgent: LIGHTPANDA_USER_AGENT`, because Lightpanda uses an empty user agent from Playwright
as it is. Options: `tag` (default `/@lightpanda/`), `name` and `use`.

`lightpandaFixture()` replaces the `browser` worker fixture. With `use.lightpanda: true` it
starts Lightpanda. With `false` (the default) it does the same as the Playwright fixture, so the
rendering projects do not change. Add it to the `test` of the suite:

```ts
// e2e/fixtures/app.ts
import { expect, test as base } from '@playwright/test'
import { errorGuardFixture, type ErrorGuard } from 'playwright-e2e-kit'
import { lightpandaFixture, type LightpandaWorkerOptions } from 'playwright-e2e-kit/lightpanda'

export const test = base.extend<{ errorGuard: ErrorGuard }, LightpandaWorkerOptions>({
  ...lightpandaFixture(),
  errorGuard: errorGuardFixture(),
})

// e2e/specs/sign-in.spec.ts: a negative path, no pixels. It runs in Lightpanda.
test('shows an error for a wrong password', { tag: '@lightpanda' }, async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Password').fill('wrong')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Wrong email or password')
})
```

`lightpandaFixture({ args, executablePath, startTimeout })` sets the options of each
`lightpanda serve` process. The `lightpandaOptions` worker option changes them for one project.
The kit always adds `--cdp-allow-timezone-override`, so the pinned `timezoneId` (`UTC`) applies.

## Which tests to tag

Tag a test `@lightpanda` when the browser engine does not change its result:

- validation messages, required fields, error texts;
- API errors and faults from `networkFault`, for example a 500 or a 401 from the backend;
- redirects, permissions that the server checks, empty states;
- data setup and cleanup, sessions and storage state.

Do not tag these tests. They need a browser that renders, or a browser feature that Lightpanda
does not have:

| Test | Reason |
|---|---|
| Layout, visual and screenshot checks | Lightpanda has no layout and no paint. A screenshot is not a real image of the page. |
| Accessibility (`A11ySteps`) | axe does not run in Lightpanda. |
| CORS, CSP and other browser security rules | Lightpanda does not apply all of them. A negative test can pass in Lightpanda and fail in Chrome. |
| A test that opens a second context (`browser.newContext()`) | One Lightpanda process holds one browser context. |
| Flutter web and Compose Multiplatform web | Lightpanda has no canvas. |
| Each `@critical` scenario | The guard fixture fails it in Lightpanda. |

"Negative" does not mean "safe for Lightpanda". A negative test of a browser rule (CORS, CSP,
mixed content) must run in a rendering browser.

## CI

Run the two groups as two parallel jobs. The Lightpanda job needs no
`npx playwright install`. Select the projects with `--project`:

```yaml
jobs:
  e2e-playwright:
    runs-on: ubuntu-latest
    steps:
      # checkout, setup-node, npm ci, npx playwright install --with-deps chromium
      - run: npx playwright test --project chromium
  e2e-lightpanda:
    runs-on: ubuntu-latest
    env:
      LIGHTPANDA_VERSION: '1.0.6'
      LIGHTPANDA_SHA256: '<sha256 of lightpanda-x86_64-linux>'
    steps:
      # checkout, setup-node, npm ci
      - name: Install Lightpanda
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          bin="$RUNNER_TEMP/lightpanda/lightpanda-x86_64-linux"
          gh release download "$LIGHTPANDA_VERSION" -R lightpanda-io/browser -p lightpanda-x86_64-linux -D "$(dirname "$bin")"
          echo "$LIGHTPANDA_SHA256  $bin" | sha256sum --check
          chmod +x "$bin"
          echo "LIGHTPANDA_EXECUTABLE_PATH=$bin" >> "$GITHUB_ENV"
      - run: npx playwright test --project chromium-lightpanda
```

Move the pin of Lightpanda in a separate PR, and run the full suite on it. Lightpanda changes
fast, and its CDP support is not complete.

## License

The Lightpanda browser has its own license (AGPL-3.0). The kit does not include the binary.
Each app installs it as a test tool.
