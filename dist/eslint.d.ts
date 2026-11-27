import type { Linter } from 'eslint';
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
    root?: string;
    /** Name prefix of each config object. Default `e2e`. */
    name?: string;
    /**
     * Also configure the unused-variable rule for files under `root`, so that a leading-underscore
     * argument (`{ browserName: _browserName }`, `(_page) => …`) is allowed. Name the rule the app
     * already uses: `'no-unused-vars'` or `'@typescript-eslint/no-unused-vars'` (its plugin must be
     * loaded by the app's own config). The rule is set to `error` with `argsIgnorePattern: '^_'`.
     * Default: not set, the app's own setting stays.
     */
    unusedVars?: 'no-unused-vars' | '@typescript-eslint/no-unused-vars';
    /**
     * Tags of the app, on top of `KIT_TAGS`. A `tag` in the details of `test()` or `test.describe()`
     * that is not in either list is an error: a typo would send the test to the wrong project or let
     * a `grep` drop it. Each tag starts with `@`.
     */
    tags?: readonly string[];
}
/** The tags that the kit gives a meaning to (docs/conventions.md "Tags"). */
export declare const KIT_TAGS: readonly string[];
/** Options that the `unusedVars` setting gives to the rule: unused args are fine when they start with `_`. */
export declare const UNDERSCORE_ARGS_OPTIONS: {
    readonly args: "after-used";
    readonly argsIgnorePattern: "^_";
};
/** Every locator factory on a page or locator. */
export declare const LOCATOR_APIS: readonly string[];
/** CSS / XPath / non-accessible strategies: forbidden even in page objects. */
export declare const NON_ACCESSIBLE_APIS: readonly string[];
/** Selector-taking methods of Page itself (`page.click('#x')`). */
export declare const PAGE_SELECTOR_METHODS: readonly string[];
/** Builds the flat-config array. Spread it into the app's `eslint.config`. */
export declare function e2eLayerRules(options?: E2ELayerRulesOptions): Linter.Config[];
//# sourceMappingURL=eslint.d.ts.map