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
