# playwright-e2e-kit

A project-agnostic kit for Playwright end-to-end suites. It gives a suite three layers (screens,
steps, specs) plus a data layer, and ESLint rules that enforce the layers. It also has a browser
error guard, an axe accessibility step, a cleanup registry and a base Playwright config.

The kit has no application code. Each application keeps its own screens, steps, specs, its
data-layer implementation, its targets and its credentials.

## Install

The kit is a git dependency. There is no registry and no publish step. Pin an exact tag:

```bash
npm install --save-dev "github:YuraBerez/playwright-e2e-kit#v0.1.0"
```

The built output (`dist/`) is committed, so the install does not build anything and works with
`npm ci`. Peer dependencies: `@playwright/test` (required), `@axe-core/playwright` (only for
`playwright-e2e-kit/a11y`) and `eslint` (only for `playwright-e2e-kit/eslint`).

**Move the pin:** change the tag in `package.json`, run `npm install`, and commit
`package.json` and `package-lock.json` together. A change that breaks a consumer gets a new major
version.

| Import | Contents |
|---|---|
| `playwright-e2e-kit` | `BaseScreen`, `BaseComponent`, `BaseSteps`, `boxSteps`, `ErrorGuard`, `errorGuardFixture`, `ResourceFactory`, `resourceFixture`, `CleanupRegistry`, `cleanupFixture`, `deterministicUse` |
| `playwright-e2e-kit/a11y` | `A11ySteps`, `A11yExclusion`, `withoutExclusions`, `formatViolations` |
| `playwright-e2e-kit/config` | `defineE2EConfig`, `baseConfig`, `quarantineGrepInvert` |
| `playwright-e2e-kit/eslint` | `e2eLayerRules()` (flat config) |

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

## Accessibility

`new A11ySteps(page, { exclusions })` (from `playwright-e2e-kit/a11y`) gives
`expectNoViolations()`. It audits the screen or state that the page shows now against WCAG 2.0/2.1
**A and AA** rules, and fails with each violation: rule, impact, help URL and the nodes.

Fix violations in the app. Only when a fix must wait, add an exclusion: one axe rule on one CSS
selector, with a reason and a follow-up issue. Never disable a rule for all elements. The
exclusions file is the only place where raw CSS is allowed in an e2e suite. Axe cannot check all
items (reading order, focus management, screen-reader behaviour), so keep manual checks.

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

## License

MIT
