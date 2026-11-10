# Layout and layers

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

