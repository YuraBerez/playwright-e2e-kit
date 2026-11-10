# Conventions, flakes and tests

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


## Text matching: `\b` and non-ASCII letters

`escapeRegExp(text)` makes every RegExp metacharacter literal. It does not add word boundaries.
In JavaScript, `\b` knows only the ASCII word characters `[A-Za-z0-9_]`. Next to a letter such as
`é`, `Ж` or `ß`, `\b` finds no boundary, so the match fails without an error:

```ts
new RegExp(`\\b${escapeRegExp('café')}\\b`).test('un café noir') // false: "é" is not a word character
new RegExp(`\\b${escapeRegExp('Éclair')}\\b`).test('un Éclair') // false
```

Use lookarounds with Unicode property escapes and the `u` flag instead. They match a whole word
in any language:

```ts
import { escapeRegExp } from 'playwright-e2e-kit'

/** Matches `text` only when no letter, digit or "_" (in any script) touches it. */
export function wholeWord(text: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(text)}(?![\\p{L}\\p{N}_])`, 'u')
}

wholeWord('café').test('un café noir') // true
wholeWord('cafe').test('un cafeteria') // false
```

`escapeRegExp` is safe with the `u` flag: it escapes only syntax characters. Two more points:

- Use a plain string (`getByText('café')`, `{ exact: true }`) when you need no pattern. Only a
  `RegExp` has this problem.
- Case-insensitive matching of non-ASCII letters needs the `i` flag together with `u`
  (`new RegExp(source, 'iu')`).
