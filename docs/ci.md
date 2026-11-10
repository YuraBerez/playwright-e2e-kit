# Compose MP web in CI

The reusable workflow `.github/workflows/compose-e2e.yml` (`workflow_call`) does the steps that the
kit's own CI does for its Compose fixture (the `e2e (compose)` job uses it):

1. JDK (Temurin 21) with the Gradle cache (key: every `*.gradle*`, `gradle-wrapper.properties`
   and `gradle/libs.versions.toml` under `gradle-dir`), then `./gradlew <gradle-task>` in
   `gradle-dir`.
2. Node.js with the npm cache, `npm ci` in `e2e-dir`.
3. Playwright browsers from a cache (key: OS, architecture, Playwright version, browsers);
   `--with-deps` on Linux only.
4. A static server (no dependencies) serves `app-dir/dist-dir` on `port` under `base-path`, with
   `application/wasm` for `.wasm`. Only a navigation (no file extension, or `Accept: text/html`)
   falls back to `index.html`; a missing `.wasm`, `.js` or `.css` is a 404. The step waits until
   this server listens and fails with a clear error when the port is taken. Then
   `playwright test` runs; the tests get the app URL in `E2E_BASE_URL`.
5. On failure, the report and the test output go up as an artifact. Traces (`*.zip`) stay out
   unless `upload-traces: true`: a trace keeps request headers, cookies and typed text.

```yaml
# .github/workflows/e2e.yml of the app
name: e2e
on: [pull_request]
jobs:
  web:
    uses: YuraBerez/playwright-e2e-kit/.github/workflows/compose-e2e.yml@v0.3.0
    with:
      # Standard Compose Multiplatform layout: gradlew at the repository root, web module composeApp.
      gradle-dir: .                 # where gradlew is (the default)
      app-dir: composeApp           # the web module; its build/dist/wasmJs/productionExecutable is served
      gradle-task: ':composeApp:wasmJsBrowserDistribution'
      e2e-dir: e2e                  # package.json and playwright.config.ts of the tests
      playwright-project: chromium
      # runs-on: '["self-hosted", "macOS"]'   # default '"ubuntu-latest"'
```

```ts
// e2e/playwright.config.ts: the workflow serves the app, so no webServer here.
import { composeConfig } from 'playwright-e2e-kit/compose'

export default composeConfig({ use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8080/' } })
```

Inputs: `gradle-dir` (default `.`, the directory with `gradlew`), `app-dir` (required, the web
module), `gradle-task` (run in `gradle-dir`), `dist-dir` (relative to `app-dir`, default
`build/dist/wasmJs/productionExecutable`), `base-path` (default `/`), `port` (default `8080`),
`e2e-dir`, `install-command` (default `npm ci`), `playwright-config`, `playwright-project`,
`browsers` (default `chromium`, separated by spaces), `report-dir`, `results-dir`,
`upload-report` (`on-failure`, `always`, `never`), `upload-traces` (default `false`),
`artifact-name`, `runs-on` (JSON), `node-version` (default `24`), `java-version` (default `21`),
`timeout-minutes`. It takes no secrets. Tests that need secrets copy the steps into their own
workflow. Pin the workflow to a release tag or a commit SHA. It runs on GitHub-hosted Linux and
macOS runners and on self-hosted macOS runners (on Linux it needs `sudo` for the browser
dependencies).

