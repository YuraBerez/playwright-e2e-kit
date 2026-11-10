# Flutter web (`playwright-e2e-kit/flutter`)

Opt-in. An app that does not import `playwright-e2e-kit/flutter` sees no change: the default
`testIdAttribute` stays `data-testid`, and `BaseScreen` adds no wait. The main entry point never
imports the Flutter modules (a test checks it). See the [framework matrix](framework-matrix.md) for
what is on by default.

Flutter draws on a canvas. Playwright sees a widget only through the **semantics tree**: `flt-semantics`
DOM nodes that Flutter builds from `Semantics` widgets and widget labels. This guide follows the order of
a suite: app setup, config and fixtures, locators, waits, screens, then limits.

## 1. Enable semantics in the app

- **In the app:** call `SemanticsBinding.instance.ensureSemantics()` in `main()` of the build that
  e2e tests run against. The tree is then always on and the kit changes nothing. A build flag of
  your own (for example a `--dart-define`) can guard the call; the kit does not read any flag.
- **Without the call:** Flutter web adds an `flt-semantics-placeholder` ("Enable accessibility")
  and builds the tree only after it is activated. `flutterReady` activates it once and waits for the
  first `flt-semantics` node. This is the default path, so an app needs no change to start.

## 2. Config and fixtures

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

## 3. Locators: what the app exposes

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
  `getByRole('textbox', { name })` or `getByLabel`. Type with `typeText()` / `flutterType()` (see
  "Text fields"), not with a bare `fill()`.
- **Lists:** `ListView` items get no `list` / `listitem` role by default, and only the visible
  items (plus a small cache) are in the tree. Give the list and the items identifiers, and use
  `scrollUntilVisible` before you act on an item.
- **Merged semantics:** a widget such as `ListTile` merges the labels of its children into one
  node, so the accessible name can be "Title Subtitle". Match it with a RegExp or `exact: false`.

## 4. Waits

`flutterReady` (an `AppReady`) waits for the `flutter-first-frame` window event, then turns on the
semantics tree. `flutterReadyWith({ timeout })` sets the timeout of each wait. A timeout gives an
error that tells which step failed.

**The first-frame listener must be in place before navigation.** A fast first frame fires before
`goto` returns. `flutterFixture()` adds the listener to the context with `addInitScript`, and
`FlutterScreen.open()` adds it to the page. Elsewhere, call `installFlutterFirstFrameListener(page)`
before the first `goto`. Without it, `flutterReady` fails at once with an error that says so; it
does not wait for a timeout. Do not wait for `networkidle`: a Flutter app never settles. Wait for
a locator or an `expect`.

## 5. Screens and scrolling

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

## 6. Error guard and accessibility

- **Error guard:** `flutterErrorAllowList` (used in the fixture above) allows only known noise:
  CanvasKit and font fetches from gstatic, and service worker registration. Each entry has a
  reason. It never hides a failure from the app's own origin.
- **Accessibility:** Flutter node ids change between builds, so match an exclusion by attribute,
  not by a full selector. `[flt-semantics-identifier="map"]` stays valid when the parent changes;
  a generated id (`flt-sem-42`) needs `selectorPattern`. See [Accessibility](accessibility.md).

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

## 7. Known limits

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

## 8. Text fields

Flutter attaches its text-editing listeners to a field only after the field takes the focus, in
a later frame. A `fill()` made before that is lost: the DOM shows the text, but the app never
gets it. `flutterType(locator, text, { timeout, attempts })` (and `FlutterScreen.typeText()`):

1. clicks the field and waits until it has the focus;
2. waits two animation frames;
3. fills `text` (it replaces the current text);
4. after two more frames, reads the value of the semantics `<input>` and compares it with `text`.
   If it does not match, it does steps 1 to 4 again, up to `attempts` (default 3), then throws.

`locator` is the text field (`getByRole('textbox', { name })`) or the `Semantics(identifier:)`
node that wraps it (`getByTestId(…)`); the kit finds the `<input>` inside.

```ts
// screens/login.screen.ts
import { FlutterScreen } from 'playwright-e2e-kit/flutter'

export class LoginScreen extends FlutterScreen {
  readonly path = '/#/login'
  private readonly email = this.page.getByRole('textbox', { name: 'Email' })
  private readonly password = this.page.getByTestId('password-field') // Semantics(identifier:) around the field
  private readonly submit = this.page.getByRole('button', { name: 'Sign in' })

  async signIn(email: string, password: string): Promise<void> {
    await this.typeText(this.email, email)
    await this.typeText(this.password, password)
    await this.submit.click()
  }
}
```

