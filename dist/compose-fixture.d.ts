import type { AppReady } from './app-ready.js';
/** Playwright fixture function that provides `hook` as the value of the `appReady` option. */
export type ComposeAppReadyOption = (deps: {
    browserName: string;
}, use: (hook: AppReady | undefined) => Promise<void>) => Promise<void>;
/**
 * Wraps a hook as the value of the `appReady` option. Playwright treats a function given to an
 * option (fixture default, config `use`, `test.use()`) as a fixture function and parses its first
 * parameter, so a bare `composeReady` fails at load time ("First argument must use the object
 * destructuring pattern"). Same shape as the core `appReadyOption` of PR #13.
 */
export declare function composeAppReadyOption(hook: AppReady | undefined): ComposeAppReadyOption;
/**
 * `appReadyFixture()` for a Compose Multiplatform web (wasmJs) app: the `appReady` option defaults
 * to `composeReady`. Spread into `test.extend({ ...composeFixture() })`, instead of
 * `appReadyFixture()`.
 */
export declare function composeFixture(): {
    appReady: [ComposeAppReadyOption | undefined, {
        option: true;
    }];
    page: ({ page, appReady }: {
        page: import("playwright-core").Page;
        appReady: AppReady | undefined;
    }, use: (value: import("playwright-core").Page) => Promise<void>) => Promise<void>;
};
