import type { Page } from '@playwright/test';
/** Resolves when the app under test can take input. Set once per suite, awaited by `BaseScreen`. */
export type AppReady = (page: Page) => Promise<void>;
/** Registers the hook for one page. `undefined` removes it. */
export declare function setAppReady(page: Page, hook: AppReady | undefined): void;
/** The hook registered for `page`, or `undefined` (the default: no wait). */
export declare function getAppReady(page: Page): AppReady | undefined;
/** Ready when the DOM is parsed. No network wait. */
export declare const domContentReady: AppReady;
/** Ready when Nuxt has hydrated (`window.useNuxtApp()` exists and `isHydrating` is false). */
export declare const nuxtReady: AppReady;
/**
 * Ready when Angular has bootstrapped and is stable. Opt-in, like `nuxtReady`. When the app exposes
 * testabilities (`window.getAllAngularTestabilities`, for example with
 * `provideProtractorTestingSupport()`), it waits until every one `isStable()`. Otherwise (the
 * default for a zoneless production build) it waits until a root element has the `ng-version`
 * attribute, which Angular sets when it bootstraps a component.
 */
export declare const angularReady: AppReady;
/** Playwright fixture function that provides `hook` as the value of the `appReady` option. */
export type AppReadyOption = (deps: {
    browserName: string;
}, use: (hook: AppReady | undefined) => Promise<void>) => Promise<void>;
/**
 * Wraps a hook for the `appReady` option. Playwright treats a function given to an option (in
 * `test.use()`, the config `use` or a fixture default) as a fixture function and calls it with the
 * fixtures, so a bare `AppReady` does not work there. Use `test.use({ appReady: appReadyOption(hook) })`.
 * `defineE2EConfig({ … }, { appReady })` and `flutterConfig()` wrap the hook for you.
 */
export declare function appReadyOption(hook: AppReady | undefined): AppReadyOption;
