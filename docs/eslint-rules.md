# Enforcement (ESLint)

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

