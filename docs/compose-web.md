# Compose Multiplatform web (`playwright-e2e-kit/compose`)

Kotlin Multiplatform (KMP) web builds come in two kinds:

- **Kotlin/JS with Compose HTML** renders real DOM elements. Use the default config, as for React:
  no entry point, no preset.
- **Compose Multiplatform web (wasmJs)** draws on a `<canvas>`. Use the opt-in entry point
  `playwright-e2e-kit/compose`. An app that does not import it sees no change: the default
  `testIdAttribute` stays `data-testid`, and `BaseScreen` adds no wait. No other entry point
  imports the Compose modules (a test checks it).

Native iOS / Android targets of a KMP app are out of scope: Playwright drives only a browser.

## Config, fixtures and screens

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

## Lists and text fields

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

## How the app exposes composables

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

## Gaps of the Compose web tree

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

## Troubleshooting

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

