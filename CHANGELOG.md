# Changelog

All notable changes to this project are in this file. The format follows
Keep a Changelog, and the project follows Semantic Versioning. A change that breaks a consumer gets a new major version.

## [Unreleased]

Planned release: **0.2.0** (minor; every change is additive, so React, Vue, Nuxt and Angular apps
see no change). All items below go into it.

### Added

- App-ready hook for `BaseScreen.open()` / `reload()`: `AppReady`, `appReadyFixture`,
  `domContentReady`, `nuxtReady` (#1).
- Accessibility exclusions that match by `attribute` or `selectorPattern`, and the `axe-report.json`
  attachment on failure (#2).
- Opt-in `playwright-e2e-kit/flutter` entry: `flutterConfig`, `flutterFixture`, `flutterReady`,
  `FlutterScreen`, `scrollUntilVisible`, `flutterErrorAllowList` (#3, #4).
- Real-browser CI with an Angular fixture app, and the `angularReady` app-ready helper in the main
  entry (waits for `getAllAngularTestabilities()` to be stable, else for the root `ng-version`
  attribute; works for zoneless apps) (#5).
- README: Flutter web guide, framework matrix (React / Vue / Nuxt / Angular / Flutter web / Kotlin web), and
  typed doc examples in `test/doc-examples/` that `npm run type-check` compiles (#6).

### Release plan

After the real-browser e2e CI (#5) is green on `main`: bump `version` in `package.json` to
`0.2.0`, rebuild `dist/`, move the items above under `## [0.2.0]`, and push the tag `v0.2.0` (see
the Release checklist in the README). Consumers then move their pin to `#v0.2.0`.

## [0.1.0]

- First release: layered screens, steps and specs, boxed `test.step` phases, browser error guard,
  axe accessibility step, data-layer cleanup, base Playwright config and ESLint layer rules.
