# Changelog

All notable changes to this project are in this file. The format follows
Keep a Changelog, and the project follows Semantic Versioning. A change that breaks a consumer gets a new major version.

## [Unreleased]

Additive: only apps that import `playwright-e2e-kit/compose` see a change.

### Added

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
