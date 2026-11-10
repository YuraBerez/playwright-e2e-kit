# playwright-e2e-kit

A project-agnostic kit for Playwright end-to-end suites. It gives a suite three layers (screens,
steps, specs) plus a data layer, and ESLint rules that enforce the layers. It also has a browser
error guard, an axe accessibility step, a cleanup registry and a base Playwright config.

The kit has no application code. Each application keeps its own screens, steps, specs, its
data-layer implementation, its targets and its credentials.

## Install

The kit is a git dependency. There is no registry and no publish step. Pin an exact tag:

```bash
npm install --save-dev "github:YuraBerez/playwright-e2e-kit#v0.2.0"
```

The built output (`dist/`) is committed, so the install does not build anything and works with
`npm ci`. Peer dependencies: `@playwright/test` (required), `@axe-core/playwright` (only for
`playwright-e2e-kit/a11y`) and `eslint` (only for `playwright-e2e-kit/eslint`).

The package also ships `src/` and the source maps (`dist/**/*.map`), so "Go to Definition" in an IDE and stack traces point to the `.ts` files.

**Move the pin:** change the tag in `package.json`, run `npm install`, and commit
`package.json` and `package-lock.json` together. A change that breaks a consumer gets a new major
version.

| Import | Contents |
|---|---|
| `playwright-e2e-kit` | `BaseScreen`, `BaseComponent`, `BaseSteps`, `boxSteps`, `ErrorGuard`, `errorGuardFixture`, `ResourceFactory`, `resourceFixture`, `CleanupRegistry`, `cleanupFixture`, `deterministicUse`, `appReadyFixture`, `AppReady`, `appReadyOption`, `domContentReady`, `nuxtReady`, `angularReady` |
| `playwright-e2e-kit/a11y` | `A11ySteps`, `A11yExclusion`, `withoutExclusions`, `formatViolations` |
| `playwright-e2e-kit/config` | `defineE2EConfig`, `baseConfig`, `quarantineGrepInvert` |
| `playwright-e2e-kit/eslint` | `e2eLayerRules()` (flat config) |
| `playwright-e2e-kit/flutter` | Flutter web only (opt-in; the main entry never imports it): `flutterConfig`, `flutterFixture`, `flutterReady`, `enableFlutterSemantics`, `installFlutterFirstFrameListener`, `FlutterScreen`, `scrollUntilVisible`, `flutterErrorAllowList` |
| `playwright-e2e-kit/compose` | Compose Multiplatform web (wasmJs) only (opt-in; no other entry imports it): `composeConfig`, `composeFixture`, `composeReady`, `composeTap`, `composeType`, `composeClear`, `composeReadText`, `composeScrollUntilVisible`, `ComposeScreen`, `scrollUntilVisible`, `composeErrorAllowList`, `diagnoseCompose` |

## Layout

```text
e2e/
  specs/       *.spec.ts   scenarios: phases in test.step(); may expect the scenario's own subject
  steps/       *.steps.ts  only flows across several screens, or UI + session; boxed test.steps
  screens/     *.screen.ts, components/*.component.ts   page objects: private locators + verbs + verify…()
  data/                    test-data client (API, seed); no UI
  fixtures/                Playwright `test` extension: accounts, page objects, steps, cleanup
  self-tests/  *.test.ts   tests of the tooling itself (raw page and expect allowed)
  __tests__/               unit tests of pure helpers (Vitest), not collected by Playwright
```

Dependency direction: `specs -> fixtures -> steps -> screens`; `fixtures -> data`. Never upwards.

## The layers

### Page objects (`e2e/screens/`)

One class per screen (`login.screen.ts` -> `LoginScreen`) or reusable UI piece
(`components/dialog.component.ts` -> `DialogComponent`). Everything that one screen knows is in its
file.

- **Locators are `private`.** Set them in the constructor, or in small private helpers such as
  `row(text)`. TypeScript then stops all code outside the class from reaching an element.
- **The public surface is verbs, `open()` and `verify…()`.** A verb does an action (`signIn(user)`,
  `addItem(name)`) and can return what the UI showed once. A `verify…()` method states a fact about
  **this** screen only and contains the `expect`. A verb that needs a precondition (for example,
  the form is visible) can `expect` it first.
- **Routed screens extend `BaseScreen`** (`path`, `open()`, `reload()`, `verifyUrl()`). `open()`
  only navigates. A route guard can redirect, so the caller follows it with `verifyShown()` or
  `verifyUrl()`. A parametrised route adds a method on the screen (`openWithToken(token)`) and
  overrides `expectedUrl`. Only routed screens can call `goto`. Components have no `open()`.
- **Components are composed privately** by the screens that show them, and re-exposed as verbs.
  A component can extend `BaseComponent`.
- Allowed locator strategies: `getByRole`, `getByLabel`, `getByText`, `getByTestId`. No CSS, no
  XPath, no `locator()`, no placeholder, alt or title. Add a test id to the app only when no
  accessible locator exists.
- Page objects never import steps, fixtures or data.

To add constructor arguments (for example a translator for accessible names), extend `BaseScreen`
once in the app:

```ts
import type { Page } from '@playwright/test'
import { BaseScreen as KitScreen } from 'playwright-e2e-kit'

export abstract class AppScreen extends KitScreen {
  constructor(page: Page, protected readonly t: Translate) {
    super(page)
  }
}
```

### Steps (`e2e/steps/`)

Only what goes across **more than one screen**: a chain across screens (login -> home), a chain
that mixes UI with the browser session or an API, a check that applies to any screen (the
accessibility audit), or a check that several specs repeat. An action on one screen is a
page-object verb, not a step.

- A step calls page-object verbs and `verify…()` methods. It never reads a locator.
- Extend `BaseSteps` and call `super('<group>')`. Each public method call is then reported as
  `test.step('<group>: <method name>', …, { box: true })`, so reports and traces show named steps
  and a failure points to the spec line. Step methods are therefore always `async`.
- Navigation uses `<screen>.open()`, never `page.goto`.

```ts
import { BaseSteps } from 'playwright-e2e-kit'

export class AuthSteps extends BaseSteps {
  constructor(private readonly pages: { login: LoginScreen; home: HomeScreen }) {
    super('auth')
  }

  async signInToHome(user: Credentials): Promise<void> {
    await this.pages.login.open()
    await this.pages.login.signIn(user)
    await this.pages.home.verifySignedIn()
  }
}
```

### Specs (`e2e/specs/*.spec.ts`)

The scenario, in `test.step('<phase>', …)` blocks. A block is a phase, not one line. A spec gets
page objects and steps from fixtures. It can use `expect` (re-exported from the fixtures) for the
subject of the scenario: values returned by verbs, API oracles, order across screens.

```ts
test('a user archives an item and no longer sees it', async ({ app: { pages: { items } }, item }) => {
  await test.step('open the list', async () => {
    await items.open()
    await items.verifyListed(item.name)
  })
  await test.step('archive the item', async () => {
    const count = await items.archive(item.name)
    expect(count).toBe(0)
    await items.verifyNotListed(item.name)
  })
})
```

Not allowed in specs: locators, the raw `page`, `page.goto`, imports from `screens/` or `data/`.

## Fixtures and data

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

## Error guard

`errorGuardFixture()` is an auto fixture: it runs in **every** test with no spec code. It watches
all pages of the test's browser context and, at teardown, fails the test with a numbered list of
`[kind] message` and URL for each of:

- uncaught page errors (`pageerror`),
- `console.error` messages, including CSP violations (`CSP violation: <directive> blocked <url>`),
- responses with status **>= 500** (`response5xx`, `METHOD url -> status`),
- failed requests (`requestfailed`, `METHOD url -> net::ERR_…`: refused, DNS, CORS, reset).

4xx responses never fail it, so negative tests stay green. The browser's console echo of a 4xx
(`Failed to load resource: … status of 4xx`) is ignored for the same reason. A request that the
browser cancelled itself is ignored on its own engine only (`net::ERR_ABORTED` on Chromium,
`cancelled` / `Load request cancelled` on WebKit).

To watch a second browser context (for example a separate session), call
`errorGuard.watch(context)` in the fixture that creates it.

**Allow-list hook:** `errorGuardFixture({ allow })` takes `{ kind, message, reason }` entries
(`message` is a substring or a RegExp, tested against the message and the URL). Keep the list
empty if possible. Each entry needs a reason and a tracking issue.

**Flutter web (opt-in):** `import { flutterErrorAllowList } from 'playwright-e2e-kit/flutter'` and
pass it as `errorGuardFixture({ allow: flutterErrorAllowList })`. It allows only known noise
(CanvasKit and font fetches from gstatic, service worker registration), each entry with a reason.
Apps that do not import this entry see no change.

**Init scripts and frames.** The guard installs one init script per context. An init script runs in
every frame, also in `about:blank` and in sandboxed or third-party iframes, where `localStorage`,
`sessionStorage` and some other APIs throw a `SecurityError`. The kit scripts are wrapped in
`try/catch` and never touch storage. Do the same in your own init scripts:

```ts
await context.addInitScript(() => {
  try {
    window.localStorage.setItem('consent', 'true')
  } catch {
    /* about:blank or a sandboxed frame: skip */
  }
})
```

**Third-party iframes.** The guard watches the whole context, so it also sees `pageerror`,
`console.error` and failed or 5xx requests that come from an embedded frame (an ad, a map or a
payment widget). It cannot tell the frame from the app. To ignore a frame, add a narrow entry with a reason. Match
by what the entry kind records: `requestfailed` and `console` carry the URL of the failing request
or the logging frame, so a URL (or a pattern of it) works. A `pageerror` carries the URL of the
top page, never the frame's, so match it by a message pattern of the frame's error:

```ts
errorGuardFixture({
  allow: [
    { kind: 'requestfailed', message: 'https://widgets.example.com/', reason: 'Embedded widget, not ours (#12)' },
    { kind: 'console', message: /widgets\.example\.com/, reason: 'Embedded widget, not ours (#12)' },
    { kind: 'pageerror', message: /WidgetSdk is not defined/, reason: 'Embedded widget, not ours (#12)' },
  ],
})
```

## Accessibility

`new A11ySteps(page, { exclusions })` (from `playwright-e2e-kit/a11y`) gives
`expectNoViolations()`. It audits the screen or state that the page shows now against WCAG 2.0/2.1
**A and AA** rules, and fails with each violation: rule, impact, help URL and the nodes.

Fix violations in the app. Only when a fix must wait, add an exclusion: one axe rule on one
matcher, with a reason and a follow-up issue. The matcher is one of:

- `selector`: exact CSS selector, compared as a whole with the axe `node.target`;
- `attribute`: attribute selector, for example `[flt-semantics-identifier="map"]`; matches each
  node whose target contains it, so a changed tag or parent does not break it;
- `selectorPattern`: a RegExp tested against each part of the target, for generated ids
  (`/^#flt-sem-\d+$/`).

When the audit fails, the full axe report (all violations, before exclusions, and the remaining
ones) is attached to the test as `axe-report.json`. Never disable a rule for all elements. The
exclusions file is the only place where raw CSS is allowed in an e2e suite. Axe cannot check all
items (reading order, focus management, screen-reader behaviour), so keep manual checks.

**Third-party iframes.** Axe also audits the content of iframes, so a violation inside an embedded
frame fails the step. A node in a frame has a nested `target`: the iframe selector first, then the
node. To exclude a frame, match the first part (the iframe) with a matcher, for one rule:

```ts
const exclusions: A11yExclusion[] = [
  {
    rule: 'color-contrast',
    selector: '#payment-frame',
    reason: 'Third-party widget: we cannot change its markup.',
    issue: '#13',
  },
]
```

A frame that you do not own cannot be fixed in the app, so the exclusion is allowed there.
Keep one entry per rule and frame; do not exclude the iframe for all rules.

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

## Flutter web (`playwright-e2e-kit/flutter`)

Opt-in. An app that does not import `playwright-e2e-kit/flutter` sees no change: the default
`testIdAttribute` stays `data-testid`, and `BaseScreen` adds no wait. The main entry point never
imports the Flutter modules (a test checks it). See the [framework matrix](#framework-matrix) for
what is on by default.

Flutter draws on a canvas. Playwright sees a widget only through the **semantics tree**: `flt-semantics`
DOM nodes that Flutter builds from `Semantics` widgets and widget labels. This guide follows the order of
a suite: app setup, config and fixtures, locators, waits, screens, then limits.

### 1. Enable semantics in the app

- **In the app:** call `SemanticsBinding.instance.ensureSemantics()` in `main()` of the build that
  e2e tests run against. The tree is then always on and the kit changes nothing. A build flag of
  your own (for example a `--dart-define`) can guard the call; the kit does not read any flag.
- **Without the call:** Flutter web adds an `flt-semantics-placeholder` ("Enable accessibility")
  and builds the tree only after it is activated. `flutterReady` activates it once and waits for the
  first `flt-semantics` node. This is the default path, so an app needs no change to start.

### 2. Config and fixtures

```ts
// playwright.config.ts
import { flutterConfig } from 'playwright-e2e-kit/flutter'

export default flutterConfig({ testDir: './e2e', use: { baseURL: 'http://localhost:8080' } })

// fixtures/app.ts
import { test as base } from '@playwright/test'
import { errorGuardFixture, type AppReady, type ErrorGuard } from 'playwright-e2e-kit'
import { flutterErrorAllowList, flutterFixture } from 'playwright-e2e-kit/flutter'

export const test = base.extend<{ appReady: AppReady | undefined; errorGuard: ErrorGuard }>({
  ...flutterFixture(), // instead of appReadyFixture()
  errorGuard: errorGuardFixture({ allow: flutterErrorAllowList }),
})
```

- **`flutterConfig(config, options)`** is `defineE2EConfig()` plus `use.testIdAttribute:
  'flt-semantics-identifier'` and `appReady: flutterReady`. The app's `use` and `options` win.
- **`flutterFixture()`** replaces `appReadyFixture()`: the `appReady` option defaults to
  `flutterReady`, and the context gets the first-frame listener (see "Waits").

### 3. Locators: what the app exposes

| In the app (Flutter) | In the DOM | Locator |
|---|---|---|
| `Semantics(identifier: 'login-submit', child: …)` (Flutter 3.19+) | `flt-semantics-identifier="login-submit"` | `getByTestId('login-submit')` with `flutterConfig()` |
| `Semantics(label: 'Close', button: true, child: …)` | `role="button"`, `aria-label="Close"` | `getByRole('button', { name: 'Close' })` |
| `Text('Hello')` | text or `aria-label` on a `flt-semantics` node | `getByText('Hello')` |
| `Semantics(header: true, child: Text('Title'))` | `role="heading"` | `getByRole('heading', { name: 'Title' })` |

The identifier is not read by screen readers, so it is safe as a test id. Prefer roles and labels
(`getByRole`, `getByLabel`); add an identifier only when no accessible locator exists, as for
`data-testid`. `getByTestId` finds identifiers only because `flutterConfig()` (or your own `use`)
sets `testIdAttribute`.

**Role-mapping quirks**

- **Buttons:** Material buttons (`ElevatedButton`, `TextButton`, `IconButton`) get
  `role="button"`. A `GestureDetector` or `InkWell` alone gets no button role: wrap it in
  `Semantics(button: true, label: …)` or give it an identifier. An `IconButton` has a name only if
  it has a `tooltip` or a semantic label.
- **Text fields:** a `TextField` becomes a real `<input>` (or `<textarea>`) with
  `role="textbox"`. Its name comes from `InputDecoration.labelText` (or `hintText`), so use
  `getByRole('textbox', { name })` or `getByLabel`. Click the field before `fill()` so that Flutter
  gives it the focus; if `fill()` does not reach the app, use `pressSequentially()`.
- **Lists:** `ListView` items get no `list` / `listitem` role by default, and only the visible
  items (plus a small cache) are in the tree. Give the list and the items identifiers, and use
  `scrollUntilVisible` before you act on an item.
- **Merged semantics:** a widget such as `ListTile` merges the labels of its children into one
  node, so the accessible name can be "Title Subtitle". Match it with a RegExp or `exact: false`.

### 4. Waits

`flutterReady` (an `AppReady`) waits for the `flutter-first-frame` window event, then turns on the
semantics tree. `flutterReadyWith({ timeout })` sets the timeout of each wait. A timeout gives an
error that tells which step failed.

**The first-frame listener must be in place before navigation.** A fast first frame fires before
`goto` returns. `flutterFixture()` adds the listener to the context with `addInitScript`, and
`FlutterScreen.open()` adds it to the page. Elsewhere, call `installFlutterFirstFrameListener(page)`
before the first `goto`. Without it, `flutterReady` fails at once with an error that says so; it
does not wait for a timeout. Do not wait for `networkidle`: a Flutter app never settles. Wait for
a locator or an `expect`.

### 5. Screens and scrolling

```ts
// screens/list.screen.ts
import { FlutterScreen } from 'playwright-e2e-kit/flutter'

export class ListScreen extends FlutterScreen {
  readonly path = '/#/list'
  private readonly list = this.page.getByTestId('items-list')
  private readonly closeButton = this.page.getByRole('button', { name: 'Close' })
  private row(id: string) {
    return this.page.getByTestId(`item-${id}`)
  }

  async openItem(id: string): Promise<void> {
    await this.scrollUntilVisible(this.row(id), { within: this.list })
    await this.row(id).click()
  }

  async close(): Promise<void> {
    await this.closeButton.click()
  }
}
```

`FlutterScreen` extends `BaseScreen` (which does not change). `open()` / `reload()` wait with the
page's app-ready hook, or with `flutterReady` when none is set. Locators stay `private`; the ESLint
layer rules apply as for any screen.

`scrollUntilVisible(locator, { within, maxSwipes, direction, settleTimeout })`: list items outside
the viewport are not in the semantics tree, and `scrollIntoViewIfNeeded` cannot reach them. The
helper moves the mouse over `within` (default: the viewport), turns the wheel by 80% of its size,
and stops when the centre of `locator` is inside `within`. After `maxSwipes` (default 10) it
throws. The raw `page.mouse` stays inside the kit, so screens do not need it. `FlutterScreen`
has it as a protected method.

### 6. Error guard and accessibility

- **Error guard:** `flutterErrorAllowList` (used in the fixture above) allows only known noise:
  CanvasKit and font fetches from gstatic, and service worker registration. Each entry has a
  reason. It never hides a failure from the app's own origin.
- **Accessibility:** Flutter node ids change between builds, so match an exclusion by attribute,
  not by a full selector. `[flt-semantics-identifier="map"]` stays valid when the parent changes;
  a generated id (`flt-sem-42`) needs `selectorPattern`. See "Accessibility".

```ts
// steps/a11y.steps.ts
import type { Page } from '@playwright/test'
import { A11ySteps, type A11yExclusion } from 'playwright-e2e-kit/a11y'

const exclusions: A11yExclusion[] = [
  {
    rule: 'aria-allowed-role',
    attribute: '[flt-semantics-identifier="map"]',
    reason: 'The map view has a Flutter-generated role that axe rejects.',
    issue: '#1',
  },
]

export const makeA11y = (page: Page) => new A11ySteps(page, { exclusions })
```

### 7. Known limits

- **Canvas-rendered text is not in the DOM.** Only widgets with semantics are visible to
  Playwright. Text in a `CustomPaint`, an image, or a widget under `ExcludeSemantics` cannot be
  found by `getByText`. Add a `Semantics(label: …)`, or check it with a screenshot.
- **Platform views and iframes** (embedded web views, ads, payment forms) are separate documents.
  Use `page.frameLocator(...)` in the screen; the Flutter tree shows only the host box.
- **Maps** (a map SDK on a canvas or a platform view) expose no markers or tiles as nodes. Test
  the app's own controls, give the map one identifier, and check map content in a separate test
  with a stubbed data source.
- **CanvasKit and fonts** load from `www.gstatic.com` at runtime, so an offline or blocked CI
  network fails the first load. Self-host them in the Flutter build, or use
  `flutterErrorAllowList` and accept the font fallback.

## Compose Multiplatform web (`playwright-e2e-kit/compose`)

Kotlin Multiplatform (KMP) web builds come in two kinds:

- **Kotlin/JS with Compose HTML** renders real DOM elements. Use the default config, as for React:
  no entry point, no preset.
- **Compose Multiplatform web (wasmJs)** draws on a `<canvas>`. Use the opt-in entry point
  `playwright-e2e-kit/compose`. An app that does not import it sees no change: the default
  `testIdAttribute` stays `data-testid`, and `BaseScreen` adds no wait. No other entry point
  imports the Compose modules (a test checks it).

Native iOS / Android targets of a KMP app are out of scope: Playwright drives only a browser.

### Config, fixtures and screens

```ts
// playwright.config.ts
import { composeConfig } from 'playwright-e2e-kit/compose'

export default composeConfig({ testDir: './e2e', use: { baseURL: 'http://localhost:8080' } })
```

```ts
// fixtures/app.ts
import { test as base } from '@playwright/test'
import { errorGuardFixture, type AppReady, type ErrorGuard } from 'playwright-e2e-kit'
import { composeErrorAllowList, composeFixture } from 'playwright-e2e-kit/compose'

export const test = base.extend<{ appReady: AppReady | undefined; errorGuard: ErrorGuard }>({
  ...composeFixture(), // instead of appReadyFixture()
  errorGuard: errorGuardFixture({ allow: composeErrorAllowList }),
})
```

```ts
// screens/form.screen.ts
import { ComposeScreen } from 'playwright-e2e-kit/compose'

export class FormScreen extends ComposeScreen {
  readonly path = '/'
  private readonly email = this.page.getByTestId('email-field')
  private readonly submit = this.page.getByRole('button', { name: 'Submit' })
  private readonly list = this.page.getByTestId('items-list')
  private item(n: number) {
    return this.page.getByTestId(`item-${n}`)
  }

  async sendEmail(value: string): Promise<void> {
    await this.typeText(this.email, value)
    await this.tap(this.submit)
  }

  async openItem(n: number): Promise<void> {
    await this.scrollUntilVisible(this.item(n), { within: this.list })
    await this.tap(this.item(n))
  }
}
```

- **`composeConfig(config, options)`** is `defineE2EConfig()` plus `use.testIdAttribute: 'id'`
  and `appReady: composeReady`. The app's `use` and `options` win.
- **`composeReady`** (an `AppReady`) waits for the first node in `#cmp_a11y_root`, the
  accessibility tree that Compose builds next to its canvas after the first composition.
  `composeReadyWith({ timeout })` sets the timeout. Compose sends no "first frame" event, so
  nothing must be installed before navigation, and the tree needs no activation. A timeout error
  tells whether the root is missing (not a Compose app, or `isA11YEnabled = false`) or empty.
- **`composeFixture()`** sets the `appReady` option to `composeReady` (wrapped with
  `appReadyOption`).
- **`ComposeScreen`** extends `BaseScreen` (which does not change). It waits with the page's
  app-ready hook, or with `composeReady` when none is set. It gives the subclasses `tap()`,
  `typeText()`, `clearText()`, `readText()` and `scrollUntilVisible()`. Locators stay `private`.
- **`tap(locator)` / `composeTap(locator)`:** the accessibility nodes have
  `pointer-events: none` and the canvas is on top, so a plain `click()` waits until it times out
  ("canvas intercepts pointer events"). `tap` waits until the node is visible, then clicks the
  centre of its box with `force: true`. The pointer events go to the canvas, and Compose hit-tests
  them as for a user.
- **`typeText(locator, text)` / `composeType(locator, text, { clear })`** taps the field, waits
  until Compose focuses its hidden backing `<input>` / `<textarea>`, clears it (select all +
  Backspace; set `clear: false` to keep the text) and types with the keyboard. `fill()` on the
  field reaches the app in Chromium only, so do not use it. Masked, password, multiline and
  submit fields: see "Lists and text fields".
- **`scrollUntilVisible()`** of `ComposeScreen` / **`composeScrollUntilVisible(locator, options)`**
  scroll a lazy list on the `y` or `x` axis, with the wheel or a touch drag, and stop with an
  error at the end of the list. See "Lists and text fields". The exported `scrollUntilVisible(page,
  locator, options)` is still the shared helper of `playwright-e2e-kit/flutter` (no change).
- **`composeErrorAllowList`** has one entry: WebKit logs Skiko's `WEBGL_debug_renderer_info`
  probe as a console error. Chromium logs it as a warning.
- **`diagnoseCompose(page)`** reads the tree and returns a `ComposeDiagnosis`: is there a canvas
  and a `#cmp_a11y_root`, how many nodes it has, the node ids (the test tags), the nodes with a
  role but no accessible name, the computed `pointer-events` of the root, the canvas and the
  nodes, and `hints` (likely cause and fix, as in "Troubleshooting"). It does not change the
  page. When `composeReady` times out, it adds the summary to the error and attaches the full
  diagnosis to the test as `compose-diagnosis.json` (in the HTML report).

### Lists and text fields

```ts
// screens/checkout.screen.ts
import { expect } from '@playwright/test'
import { ComposeScreen } from 'playwright-e2e-kit/compose'

export class CheckoutScreen extends ComposeScreen {
  readonly path = '/checkout'
  private readonly products = this.page.getByTestId('product-list') // LazyColumn
  private readonly sizes = this.page.getByTestId('size-row') // LazyRow
  private readonly phone = this.page.getByRole('textbox', { name: 'Phone' }) // VisualTransformation mask
  private readonly password = this.page.getByRole('textbox', { name: 'Password' })
  private readonly note = this.page.getByRole('textbox', { name: 'Note' }) // multiline
  private readonly search = this.page.getByRole('textbox', { name: 'Search' }) // ImeAction.Search

  async pickProduct(name: string, size: string): Promise<void> {
    await this.scrollUntilVisible(this.page.getByText(name), { within: this.products })
    await this.scrollUntilVisible(this.page.getByText(size), { within: this.sizes, axis: 'x' })
    await this.tap(this.page.getByText(size))
  }

  async enterContact(digits: string, formatted: string, secret: string): Promise<void> {
    await this.typeText(this.phone, digits, { expected: formatted }) // types raw digits, checks the mask
    await this.typeText(this.password, secret) // no read-back of a password
    await this.typeText(this.note, 'Ring twice\nLeave at the door') // \n = new line
  }

  async searchFor(text: string): Promise<void> {
    await this.typeText(this.search, text, { submit: true }) // Enter runs the IME action
  }

  async resetPhone(): Promise<void> {
    await this.clearText(this.phone)
    expect(await this.readText(this.phone)).toBe('')
  }
}
```

**Lists.** A `LazyColumn` or `LazyRow` composes only the items near its viewport, so an item
further away is not in the tree. `scrollUntilVisible(locator, options)` (or
`composeScrollUntilVisible`) scrolls until the centre of `locator` is inside `within`, and queries
`locator` again after each step:

| Option | Default | Meaning |
|---|---|---|
| `within` | the viewport | The list that scrolls on the axis. Give its test tag. |
| `axis` | `'y'` | `'y'` for a `LazyColumn`, `'x'` for a `LazyRow`. |
| `step` | 80% of `within` on the axis | Pixels per step. A negative step scrolls up / left. |
| `maxSteps` | `50` | Steps before it gives up. |
| `mode` | `'wheel'` | `'wheel'` turns the wheel over the centre of `within`. `'drag'` drags a touch pointer across it (for an app that ignores the wheel); it is slower. |
| `settleTimeout` | `500` | ms to wait for the item and for the list to stop after each step. |

When a step does not move the list, the list is at its end: it throws at once ("did not move on
step N … it is at its end") and does not use all `maxSteps`. The old `maxSwipes` and `direction`
options still work. Nested lists: scroll the outer list to the inner one first, then give the
inner list as `within` (a vertical step over a horizontal `LazyRow` scrolls the list around it).

**Text fields.** The node of a text field shows the value after its `VisualTransformation`.

| Field | What to do |
|---|---|
| Mask (`VisualTransformation`, for example a phone or card number) | Type the raw value and give the shown value as `expected`: `typeText(phone, '5551234567', { expected: '555 123 4567' })`. It waits until the field shows it (`timeout`, default 5 s). `expected` can be a `RegExp`. |
| Password (`PasswordVisualTransformation`, `KeyboardType.Password`) | No read-back: the field shows bullets. `expected` throws, and no error of the kit shows the value. The kit sees `KeyboardType.Password`; give `password: true` for other secret fields. Check the result of the input (a sign-in) instead. Playwright's own trace still records typed text. |
| Multiline | Each `\n` in the text presses Enter, which inserts a new line. `submit: true` throws. |
| Single line with an IME action (`ImeAction.Search`, `Done`, `Go`) | `submit: true` presses Enter after the text (and after the `expected` check). A `\n` in the text throws, because Enter would run the action. |

- **`clearText(locator)` / `composeClear(locator, { expected })`** selects all and deletes, then
  waits until the field shows `expected` (default `''`; give the template of a mask that shows
  one when empty). It tries up to three rounds. Its error gives the number of characters left,
  not the text.
- **`readText(locator)` / `composeReadText(locator)`** returns the text that the node shows now,
  with the lines of a multiline field joined by `\n`. To wait for a value, use
  `expect(locator).toHaveText()` or `expected`.

### How the app exposes composables

Compose Multiplatform 1.12 (wasmJs) mirrors the semantics tree into hidden `<div>` nodes inside
the viewport's open shadow root. Playwright locators pierce it.

| In the app (Compose) | In the DOM | Locator |
|---|---|---|
| `Modifier.testTag("submit")` | `id="submit"` | `getByTestId('submit')` with `composeConfig()` |
| `Button(…) { Text("Submit") }` | `role="button"`, text `Submit` | `getByRole('button', { name: 'Submit' })` |
| `Modifier.clickable { … }.semantics { contentDescription = "Add" }` | `role="button"`, `aria-label="Add"` | `getByRole('button', { name: 'Add' })` |
| `Text("Hello")` | text of a `<div>` (no role) | `getByText('Hello')` |
| `Modifier.semantics { heading() }` | `role="heading"` | `getByRole('heading', { name })` |
| `TextField(…)` | `role="textbox"`, `contenteditable`, the value as text | `getByTestId(…)`, or `getByRole('textbox', { name })` with a `contentDescription` |
| `LazyColumn` / `LazyRow` | `role="list"`; items have no role; only the items near the viewport are in the tree | `getByTestId(…)` on the list and the items |

The test tag is the DOM `id`, so keep it unique on the screen. Prefer roles and text; add a test
tag only when no accessible locator exists.

### Gaps of the Compose web tree

- **Text fields have no accessible name:** the `label` of a `TextField` is not exposed. Add
  `Modifier.semantics { contentDescription = "Email" }` (it becomes `aria-label`) or a test tag.
- **No state attributes:** `enabled`, checked, selected and toggle states are not mapped to
  `aria-*`. `toBeDisabled()` / `toBeChecked()` do not work; check the visible result instead. A
  tap on a disabled button goes through the canvas, and Compose ignores it as for a user.
- **Role from a click action:** every node with a click action gets `role="button"`.
- **Accessibility audit:** axe audits the tree. Compose itself produces some WCAG A violations:
  `aria-roles` on the `<canvas>` (`role="generic"`), `aria-required-attr` on headings (no
  `aria-level`) and `aria-required-children` on lists (no `listitem`). The app cannot fix them;
  add one exclusion per rule and node (for example `rule: 'aria-roles'` with
  `selectorPattern: /^canvas$/`) and give the upstream epic CMP-9678 (JetBrains YouTrack) as the
  `issue`. The nodes are in a shadow root, so axe gives a nested target (host, then node);
  `selector` and `selectorPattern` match each part of it. The fixture's spec
  (`e2e/specs/compose.spec.ts`) has the three exclusions.
- **Turned off:** an app that sets `isA11YEnabled = false` in `ComposeViewport` has no tree.
  Then the kit cannot find composables.

### Troubleshooting

Call `diagnoseCompose(page)` (or open `compose-diagnosis.json` of a `composeReady` timeout in the
report) and find the symptom here.

| Symptom | Cause | Fix |
|---|---|---|
| `composeReady` times out; no `#cmp_a11y_root`, but a canvas | The app is still loading (a slow runner, a large wasm module), or `ComposeViewport` sets `isA11YEnabled = false` | Give `composeReadyWith({ timeout })` more time; remove `isA11YEnabled = false` (the tree is on by default) |
| `composeReady` times out; no canvas and no root | Not a Compose Multiplatform wasmJs page, or the wasm module did not load (wrong `baseURL`, a `.wasm` file served without `application/wasm`) | Check the URL, the browser console and the network log |
| `#cmp_a11y_root` stays empty | The first composition did not finish, or the app threw at start-up | Read the browser console (the error guard reports it) |
| `getByTestId('x')` finds nothing, the node is there by role or text | The tag is on a child of a merging node (`Button`, `clickable`, `Modifier.semantics(mergeDescendants = true) { … }`): its semantics are merged into the parent, so the tag does not become an id | Put `Modifier.testTag("x")` (or `Modifier.semantics { testTag = "x" }`) on the merging node itself |
| `getByTestId` finds nothing and `nodesWithId` is empty | No `Modifier.testTag` reached the DOM, or the config is not `composeConfig()` (then `getByTestId` looks for `data-testid`) | Add the test tags; use `composeConfig()`. `testTagsAsResourceId` is for Android (UI Automator); the web tree does not need it (Compose Multiplatform 1.12 sets the id without it) |
| `getByRole(role, { name })` finds nothing; the node is in `nodesWithoutName` | The node has no accessible name (the `label` of a `TextField` is not exposed) | `Modifier.semantics { contentDescription = "…" }`, or a test tag |
| `click()` times out: "canvas intercepts pointer events" | The nodes have `pointer-events: none`; the canvas takes the pointer | `tap()` / `composeTap()`, `typeText()` / `composeType()` |

```ts
// e2e/self-tests/compose-diagnosis.test.ts
import { expect, test } from '@playwright/test'
import { diagnoseCompose } from 'playwright-e2e-kit/compose'

test('the Compose tree has the test tags', async ({ page }) => {
  await page.goto('/')
  const diagnosis = await diagnoseCompose(page)
  expect(diagnosis.hints.filter((hint) => !hint.includes('pointer-events'))).toEqual([])
  expect(diagnosis.nodesWithId).toContain('submit')
})
```

### Compose MP web in CI

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

## Framework matrix

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
as in "App-ready hook".

## Flakes

- **Local:** no retries. **CI** (`CI` is set): one retry and `failOnFlakyTests`, so a test that
  passes only on retry still makes the run red, but the report shows it as *flaky*.
- **Quarantine:** when a test is unstable and the fix is not immediate, tag it `@quarantine` and
  link an **open issue** in a comment above it. `quarantineGrepInvert()` excludes these tests
  unless `E2E_QUARANTINE=include`. Remove the tag when you close the issue.

## Determinism

`deterministicUse()` pins `timezoneId: 'UTC'` and `locale: 'en-US'`, so results do not depend on
the machine or the CI runner. A spec changes the locale only with `test.use({ locale })` at file
or describe level.

## Tags

- `@critical`: each product scenario.
- `@smoke`: the few checks to run after each deploy.
- `@a11y`: accessibility audits.
- `@quarantine`: a known-unstable test (see "Flakes").

Tag with `test('title', { tag: ['@smoke', '@critical'] }, …)`.

## Enforcement (ESLint)

```ts
// eslint.config.ts
import { e2eLayerRules } from 'playwright-e2e-kit/eslint'

export default [
  // …the app's own config, with a TypeScript parser for *.ts…
  ...e2eLayerRules(), // { root: 'e2e' } by default
]
```

The rules use core ESLint rules only (`no-restricted-syntax`, `no-restricted-imports`), so no
plugin is necessary.

| Where | Not allowed |
|---|---|
| all of `<root>/` | importing `expect` from `@playwright/test` or from the fixtures, **except** in `specs/`, `screens/`, `steps/`, `fixtures/`, `self-tests/` (a new directory is guarded by default); `waitForTimeout` |
| `<root>/**/*.spec.ts` | `page.goto`; all locator calls (`locator`, `getBy*`, `$`…); the raw `page`; `page.mouse`/`keyboard`/`touchscreen`; imports from `screens` or `data` |
| `<root>/screens/**` | CSS/XPath/`locator`/`getByPlaceholder`/`getByAltText`/`getByTitle`; `page.evaluate`, `page.click(...)`-style calls and input devices; `filter({ has })`; `goto` outside routed screens (`screens/*.ts`); imports from steps, fixtures or data |
| `<root>/steps/**` | all locator calls; selector-taking `page.*` calls; `page.goto`; imports from specs or `data` |
| `tsc` | reading a page object's `private` locator from outside the class |

Unused arguments with a leading underscore (`{ browserName: _browserName }`, used in fixtures to
force a dependency) are not part of the layer rules. To allow them, name the unused-variable rule
that your config uses: `...e2eLayerRules({ unusedVars: '@typescript-eslint/no-unused-vars' })`
(or `'no-unused-vars'`). The rule is set to `error` with `argsIgnorePattern: '^_'` for files
under the root. Without the option, your own setting stays.

A lint failure means that the code is in the wrong layer. Move the code; do not loosen the rule.

## Conventions

| Item | File | Class / name |
|---|---|---|
| Screen | `screens/<kebab>.screen.ts` | `<Pascal>Screen` |
| Reusable component | `screens/components/<kebab>.component.ts` | `<Pascal>Component` |
| Step group | `steps/<flow>.steps.ts` | `<Flow>Steps extends BaseSteps` |
| Spec | `specs/<feature>.spec.ts` | `test.describe('<feature>')` |
| Locator members | — | `private`, nouns: `emailInput`, `submitButton` |
| Page-object verbs | — | `signIn`, `addItem`; checks `verify…` |

## Testing the suite itself

- **Playwright self-tests** (`e2e/self-tests/*.test.ts`) need a real browser (for example, to
  prove that the error guard fires). They are not specs, so they can use the raw `page` and
  `expect`. Product scenarios never go there.
- **Vitest helper tests** (`e2e/**/__tests__/*.test.ts`) cover pure helpers whose failure would
  be silent.

## Development

```bash
npm ci
npm run lint        # ESLint, check:no-product-refs, and a check that dist/ matches the sources
npm run type-check
npm test            # Vitest; npm run test:coverage for the coverage report
npm run build       # writes dist/; commit it with the source change
```

**`check:no-product-refs`** keeps the kit project-agnostic. It fails when a tracked file, a commit
message or a tag message contains a term from the deny-list, or a URL whose host is not on the
allow-list. The deny-list comes from the `NO_PRODUCT_REFS` environment variable (comma separated)
and from the git-ignored file `.no-product-refs` (one term or `/regex/` per line). The list is never
committed, so it cannot name a product either.

## Release checklist

The kit runs its own suite in a real Chromium against five fixture apps
(`test/fixtures-apps/`: React, Vue, Angular, Flutter web, Compose Multiplatform web; the Compose
app also runs in Firefox and WebKit: projects `compose-firefox`, `compose-webkit`), with
`npm run test:e2e` (`E2E_APP=<app>` for one app; Flutter needs the `flutter` SDK, Compose needs a
JDK 21 in `JAVA_HOME` and builds with its Gradle wrapper). Before you push a `v*` tag:

1. CI on the release commit is green: the `gate` job and **all five** `e2e` jobs (react, vue,
   angular, flutter, and compose, which runs through the reusable `compose-e2e.yml`).
2. `dist/` matches the sources (`npm run lint` checks it).
3. A change that breaks a consumer has a new major version.

## License

MIT
