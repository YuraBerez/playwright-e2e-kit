# Changelog

All notable changes to this project are in this file. The format follows
Keep a Changelog, and the project follows Semantic Versioning. A change that breaks a consumer gets a new major version.

## [Unreleased]

Additive: apps that do not use the new helpers see no change.

### Added

- `workerResourceFixture(factory)`: `resourceFixture` with `scope: 'worker'`, destroyed at worker
  teardown. `sessionPerWorker({ signIn, saveAfterEachTest, indexedDB })`: signs in once per worker
  (`workerSession` worker fixture) and gives the state to each test's `storageState`; with
  `saveAfterEachTest`, each test saves the latest state back for the next test of the worker.
  README "Worker-scoped data and sessions" explains why one shared `storageState` breaks apps
  that rotate refresh tokens (#24).
- `flutterType(locator, text, { timeout, attempts })` in `playwright-e2e-kit/flutter` and
  `FlutterScreen.typeText()`: focus, two animation frames, fill, then confirm the value through
  the semantics node (fill again if Flutter dropped it). Works on the text field or on the
  `Semantics(identifier:)` node that wraps it. README Flutter "8. Text fields" (#25).
- `networkFault(page, { url, status, times, method, body, headers, cors, reason })`: answers the
  next N matching calls with a status, adds CORS headers and answers the preflight (default on),
  and tells the error guard that the faulted responses are expected. `ErrorGuard.expect()`
  (expected errors at run time, optional `times`), `errorGuardsOf(context)` and the public
  `ErrorGuard.minStatus` support it. README "Network faults" (#26).
- Init scripts of the kit (CSP violation listener, Flutter first-frame listener) are wrapped in
  `try/catch`, so they cannot throw in `about:blank` or sandboxed frames. A real-browser e2e self-test
  covers it. README: how the error guard and the axe step treat third-party iframes, with
  examples to exclude a frame (#28).
- `e2eLayerRules({ unusedVars })` (opt-in): sets the named unused-variable rule to `error` with
  `argsIgnorePattern: '^_'` for files under the root, so `{ browserName: _browserName }` passes.
  Also exports `UNDERSCORE_ARGS_OPTIONS` (#30).
- Reusable workflow `.github/workflows/compose-e2e.yml` (`workflow_call`) for Compose
  Multiplatform web e2e tests: JDK 21 and Gradle cache, `wasmJsBrowserDistribution` with a
  separate Gradle root (`gradle-dir`) and web module (`app-dir`), a static server with a base path
  (index.html fallback for navigations only; fails clearly when the port is taken), Playwright
  browsers cache, report upload without traces by default.
  GitHub-hosted runners and self-hosted macOS runners. The kit's `e2e (compose)` CI job uses it.
  README "Compose MP web in CI" (#21).
- `diagnoseCompose(page)` in `playwright-e2e-kit/compose`: a11y root present or empty, node count,
  node ids (test tags), nodes without an accessible name, `pointer-events`, and hints. A
  `composeReady` timeout adds its summary to the error and attaches it as
  `compose-diagnosis.json`. README "Troubleshooting" table (#22).

## [0.2.0] - 2026-11-10

Minor release: every change is additive, so React, Vue, Nuxt and Angular apps see no change.

### Added

- App-ready hook for `BaseScreen.open()` / `reload()`: `AppReady`, `appReadyFixture`,
  `appReadyOption`, `domContentReady`, `nuxtReady` (#1).
- Opt-in `playwright-e2e-kit/flutter` entry: `flutterConfig`, `flutterFixture`, `flutterReady`,
  `enableFlutterSemantics`, `installFlutterFirstFrameListener` (#2), `FlutterScreen`,
  `scrollUntilVisible` (#3).
- Accessibility exclusions that match by `attribute` or `selectorPattern`, the `axe-report.json`
  attachment on failure, and the opt-in `flutterErrorAllowList` (#4).
- Real-browser self-tests on React, Vue, Angular and Flutter web fixture apps in CI, and the
  `angularReady` app-ready helper in the main entry (waits for `getAllAngularTestabilities()` to be
  stable, else for the root `ng-version` attribute; works for zoneless apps) (#5).
- README: Flutter web guide, framework matrix (React / Vue / Nuxt / Angular / Flutter web / Kotlin
  web), and typed doc examples in `test/doc-examples/` that `npm run type-check` compiles (#6).
- Opt-in `playwright-e2e-kit/compose` entry for Compose Multiplatform web (wasmJs, canvas):
  `composeConfig` (`testIdAttribute: 'id'`, because `Modifier.testTag` becomes the DOM `id`),
  `composeFixture`, `composeReady` (first node of the `#cmp_a11y_root` tree), `ComposeScreen`,
  `composeTap` / `composeType` (the canvas intercepts pointer events; `fill()` works in Chromium
  only), `composeErrorAllowList` (WebKit WebGL debug-info console error). `scrollUntilVisible`
  moves to a shared module; the `playwright-e2e-kit/flutter` export does not change (#10).
- Compose Multiplatform web (wasmJs) fixture app (`test/fixtures-apps/compose/`, Gradle wrapper,
  pinned Kotlin 2.3.21 / Compose 1.12.2 / Gradle 8.14.6) in the real-browser suite, with
  `composeConfig`, `ComposeScreen` and `composeErrorAllowList`, and a `compose` job in the CI e2e
  matrix (JDK 21). The release checklist needs all five e2e jobs green (#11).

### Changed

- Internal layout only: `src/` and `dist/` are split into `core/`, `canvas/`, `flutter/` and
  `compose/`, with no API change (#16).
- Sources and source/declaration maps ship with the package, so "Go to Definition" and stack
  traces point to the `.ts` files (#16).

### Fixed (found by the real-browser suite, before any release)

- A hook given as the `appReady` option (fixture default, `test.use`, config `use`) was called by
  Playwright as a fixture function. `appReadyOption(hook)` wraps it; `defineE2EConfig`,
  `flutterConfig` and `flutterFixture` use it (#5).
- An `attribute` a11y exclusion never matched a node that axe targets by its `id` (every Flutter
  semantics node); the element's opening tag is now checked too (#5).
- An a11y exclusion never matched a node inside a shadow root (every Compose Multiplatform web
  node): axe gives its target as a nested array. `selector` and `selectorPattern` now also match
  each part of it; the joined form matches as before (#11).
- `check:no-product-refs` skips the URL check for the generated Gradle wrapper files and
  `yarn.lock` files, as for the other lockfiles; they still get the deny-list check (#11).

## [0.1.0]

- First release: layered screens, steps and specs, boxed `test.step` phases, browser error guard,
  axe accessibility step, data-layer cleanup, base Playwright config and ESLint layer rules.
