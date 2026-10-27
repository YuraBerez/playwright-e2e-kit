import type { Linter } from 'eslint'

/**
 * Layer rules of an e2e suite as an ESLint flat config (core rules only, no plugin). The layout:
 *
 *   <root>/specs/**\/*.spec.ts    scenarios: phases in test.step(); may `expect` the scenario's subject
 *   <root>/steps/**              flows across several screens; no locators
 *   <root>/screens/*.ts          routed screens (page objects): private locators, verbs, verify…()
 *   <root>/screens/components/** reusable UI pieces: no navigation
 *   <root>/fixtures/**, data/**  test extension and test-data layer
 *   <root>/self-tests/**         tests of the tooling itself (raw `page` and `expect` allowed)
 */
export interface E2ELayerRulesOptions {
  /** Directory of the e2e suite, relative to the ESLint config. Default `e2e`. */
  root?: string
  /** Name prefix of each config object. Default `e2e`. */
  name?: string
}

const alt = (names: readonly string[]) => names.join('|')
const callOf = (names: readonly string[]) =>
  `CallExpression[callee.type='MemberExpression'][callee.property.name=/^(${alt(names)})$/]`

/** Every locator factory on a page or locator. */
export const LOCATOR_APIS: readonly string[] = [
  'locator', 'getByRole', 'getByLabel', 'getByText', 'getByTestId', 'getByPlaceholder', 'getByAltText',
  'getByTitle', 'frameLocator', 'waitForSelector', '\\$', '\\$\\$', '\\$eval', '\\$\\$eval',
]
/** CSS / XPath / non-accessible strategies: forbidden even in page objects. */
export const NON_ACCESSIBLE_APIS: readonly string[] = [
  'locator', 'getByPlaceholder', 'getByAltText', 'getByTitle', 'frameLocator', 'waitForSelector',
  '\\$', '\\$\\$', '\\$eval', '\\$\\$eval',
]
/** Selector-taking methods of Page itself (`page.click('#x')`). */
export const PAGE_SELECTOR_METHODS: readonly string[] = [
  'click', 'dblclick', 'fill', 'type', 'press', 'check', 'uncheck', 'setChecked', 'hover', 'selectOption',
  'setInputFiles', 'tap', 'focus', 'dragAndDrop', 'isVisible', 'isHidden', 'isEnabled', 'isDisabled',
  'isChecked', 'isEditable', 'textContent', 'innerText', 'innerHTML', 'inputValue', 'getAttribute',
  'dispatchEvent', 'waitForSelector', '\\$', '\\$\\$', '\\$eval', '\\$\\$eval', 'evaluate', 'evaluateHandle',
]

type Restriction = { selector: string; message: string }

/** Builds the flat-config array. Spread it into the app's `eslint.config`. */
export function e2eLayerRules(options: E2ELayerRulesOptions = {}): Linter.Config[] {
  const root = (options.root ?? 'e2e').replace(/\/+$/, '')
  const name = options.name ?? 'e2e'

  const noFixedWaits: Restriction = {
    selector: callOf(['waitForTimeout']),
    message: 'No fixed sleeps in e2e: wait on a condition (expect / waitForURL), never waitForTimeout.',
  }
  const noNavigation: Restriction = {
    selector: callOf(['goto']),
    message: 'No page.goto here: navigate with `<screen>.open()` (URLs belong to the page object).',
  }
  const ON_PAGE =
    ":matches([callee.object.name='page'], [callee.object.object.type='ThisExpression'][callee.object.property.name='page'])"
  const noPageSelectorMethods: Restriction = {
    selector: `CallExpression[callee.type='MemberExpression'][callee.property.name=/^(${alt(PAGE_SELECTOR_METHODS)})$/]${ON_PAGE}`,
    message: 'No raw Page selector/DOM APIs (page.click/fill/evaluate…): act through a page-object verb.',
  }
  const noPageInputDevices: Restriction = {
    selector:
      "MemberExpression[property.name=/^(mouse|keyboard|touchscreen)$/]:matches([object.name='page'], [object.object.type='ThisExpression'][object.property.name='page'])",
    message: 'No page.mouse/keyboard/touchscreen here: coordinates and raw key events bypass the screens.',
  }
  const noNavigationInComponents: Restriction = {
    selector: callOf(['goto']),
    message: `Components are not routed: only routed screens (${root}/screens/*.ts) may navigate.`,
  }
  const expectOnlyIn = 'Import `expect` only in specs, screens (page objects), steps, fixtures and self-tests.'
  const upperLayers = ['**/steps', '**/steps/*', '**/fixtures', '**/fixtures/*', '**/data', '**/data/*']
  const pageObjectSyntax: Restriction[] = [
    noFixedWaits,
    noPageSelectorMethods,
    noPageInputDevices,
    {
      selector: callOf(NON_ACCESSIBLE_APIS),
      message: 'Page objects may only use getByRole / getByLabel / getByText / getByTestId (no CSS/XPath/placeholder/alt/title).',
    },
    {
      selector: "CallExpression[callee.property.name='filter'] Property[key.name='has']",
      message: 'Keep page objects selector-simple: filter by text, not by nested locators.',
    },
  ]
  const pageObjectImports = {
    patterns: [{ group: upperLayers, message: 'Page objects do not depend on steps, fixtures or data.' }],
  }

  return [
    {
      name: `${name}/all-no-fixed-waits`,
      files: [`${root}/**/*.ts`],
      rules: { 'no-restricted-syntax': ['error', noFixedWaits] },
    },
    {
      // Inverted: banned everywhere under the root, then re-allowed below for the listed layers, so
      // a new directory is guarded by default.
      name: `${name}/expect-import-banned-by-default`,
      files: [`${root}/**/*.ts`],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [{ name: '@playwright/test', importNames: ['expect'], message: expectOnlyIn }],
            // fixtures re-export `expect`; importing it from there must not bypass the ban.
            patterns: [{ group: ['**/fixtures', '**/fixtures/index'], importNames: ['expect'], message: expectOnlyIn }],
          },
        ],
      },
    },
    {
      name: `${name}/expect-allowed-layers`,
      files: [
        `${root}/specs/**/*.ts`,
        `${root}/screens/**/*.ts`,
        `${root}/steps/**/*.ts`,
        `${root}/fixtures/**/*.ts`,
        `${root}/self-tests/**/*.ts`,
      ],
      rules: { 'no-restricted-imports': 'off' },
    },
    {
      name: `${name}/specs-scenario-only`,
      files: [`${root}/**/*.spec.ts`],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              { group: ['**/screens', '**/screens/*'], message: 'Specs get page objects from fixtures; do not import screens.' },
              { group: ['**/data', '**/data/*'], message: 'Specs get test data from fixtures, not the data layer directly.' },
            ],
          },
        ],
        'no-restricted-syntax': [
          'error',
          noFixedWaits,
          noNavigation,
          noPageSelectorMethods,
          noPageInputDevices,
          { selector: "Identifier[name='page']", message: 'No raw `page` in specs: drive the UI through page objects and steps.' },
          { selector: callOf(LOCATOR_APIS), message: `No locators in specs: selectors are private to ${root}/screens/.` },
        ],
      },
    },
    {
      name: `${name}/page-objects`,
      files: [`${root}/screens/**/*.ts`],
      rules: {
        'no-restricted-imports': ['error', pageObjectImports],
        'no-restricted-syntax': ['error', ...pageObjectSyntax, noNavigationInComponents],
      },
    },
    {
      name: `${name}/routed-screens-may-open`,
      files: [`${root}/screens/*.ts`],
      rules: {
        'no-restricted-imports': ['error', pageObjectImports],
        'no-restricted-syntax': ['error', ...pageObjectSyntax],
      },
    },
    {
      name: `${name}/steps-flows-only`,
      files: [`${root}/steps/**/*.ts`],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/specs/*', '**/*.spec', '**/data', '**/data/*'],
                message: 'Steps drive the UI via page objects; test data comes through fixtures.',
              },
            ],
          },
        ],
        'no-restricted-syntax': [
          'error',
          noFixedWaits,
          noNavigation,
          noPageSelectorMethods,
          { selector: callOf(LOCATOR_APIS), message: 'No locators in steps: call a page-object verb or verify…().' },
        ],
      },
    },
  ]
}
