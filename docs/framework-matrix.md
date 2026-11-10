# Framework matrix

What an app gets with no extra code ("default") and what it turns on ("opt-in", with the import
or option named in the cell).

| Feature | React | Vue | Nuxt | Angular | Flutter web | Kotlin/JS + Compose HTML | Compose Multiplatform web (wasmJs, canvas) |
|---|---|---|---|---|---| ---|---|
| App-ready hook (`BaseScreen.open()`) | default: none (`goto` only); own `AppReady` or `domContentReady` opt-in | same as React | default: none; `nuxtReady` opt-in | default: none; `angularReady` opt-in (added in #5, planned for 0.2.0) | on with `flutterConfig()` / `flutterFixture()` (`flutterReady`); none otherwise | default: none, as React | on with `composeConfig()` / `composeFixture()` (`composeReady`); none otherwise |
| `testIdAttribute` | `data-testid` | `data-testid` | `data-testid` | `data-testid` | `flt-semantics-identifier` with `flutterConfig()`; `data-testid` otherwise | `data-testid` | `id` (from `Modifier.testTag`) with `composeConfig()`; `data-testid` otherwise |
| Error-guard allow list | default: empty (`errorGuardFixture({ allow })`) | same | same | same | `flutterErrorAllowList`, opt-in | default: empty | `composeErrorAllowList`, opt-in |
| Accessibility (`A11ySteps`) | axe on the DOM; exclusions by `selector` | same | same | same | same engine; exclusions by `attribute` / `selectorPattern` on `flt-semantics` nodes; canvas content not audited | same as React (DOM) | same engine on the hidden `#cmp_a11y_root` tree; exclusions for the Compose-generated `aria-roles` / `aria-required-attr` / `aria-required-children` violations; canvas content not audited |
| Scrolling | Playwright auto-scroll | same | same | same | `scrollUntilVisible` (virtualised lists, wheel based), opt-in | Playwright auto-scroll | `scrollUntilVisible` (lazy lists, `y` / `x` axis, wheel or touch drag, end detection), opt-in |
| Entry point | `playwright-e2e-kit` | `playwright-e2e-kit` | `playwright-e2e-kit` | `playwright-e2e-kit` | `playwright-e2e-kit/flutter` | `playwright-e2e-kit` | `playwright-e2e-kit/compose` |

Kotlin/JS with Compose HTML renders real DOM, so it behaves like React. Compose Multiplatform for
web (wasmJs) draws on a canvas like Flutter; it uses the opt-in `playwright-e2e-kit/compose` preset. Native iOS and Android
apps are out of scope: Playwright drives only a browser.

React, Vue and Angular apps have no default wait. Pass your own `AppReady` or the ready-made hook
as in [App-ready hook](config.md#app-ready-hook).

