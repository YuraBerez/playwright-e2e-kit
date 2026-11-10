import type { Page } from '@playwright/test'

/** Resolves when the app under test can take input. Set once per suite, awaited by `BaseScreen`. */
export type AppReady = (page: Page) => Promise<void>

const hooks = new WeakMap<Page, AppReady>()

/** Registers the hook for one page. `undefined` removes it. */
export function setAppReady(page: Page, hook: AppReady | undefined): void {
  if (hook) hooks.set(page, hook)
  else hooks.delete(page)
}

/** The hook registered for `page`, or `undefined` (the default: no wait). */
export function getAppReady(page: Page): AppReady | undefined {
  return hooks.get(page)
}

/** Ready when the DOM is parsed. No network wait. */
export const domContentReady: AppReady = (page) => page.waitForLoadState('domcontentloaded')

/** Ready when Nuxt has hydrated (`window.useNuxtApp()` exists and `isHydrating` is false). */
export const nuxtReady: AppReady = async (page) => {
  await page.waitForFunction(() => {
    const nuxt = (window as unknown as { useNuxtApp?: () => { isHydrating?: boolean } }).useNuxtApp?.()
    return !!nuxt && !nuxt.isHydrating
  })
}

/**
 * Ready when Angular has bootstrapped and is stable. Opt-in, like `nuxtReady`. When the app exposes
 * testabilities (`window.getAllAngularTestabilities`, for example with
 * `provideProtractorTestingSupport()`), it waits until every one `isStable()`. Otherwise (the
 * default for a zoneless production build) it waits until a root element has the `ng-version`
 * attribute, which Angular sets when it bootstraps a component.
 */
export const angularReady: AppReady = async (page) => {
  await page.waitForFunction(() => {
    const w = window as unknown as { getAllAngularTestabilities?: () => { isStable(): boolean }[] }
    const testabilities = w.getAllAngularTestabilities?.()
    if (testabilities && testabilities.length > 0) return testabilities.every((t) => t.isStable())
    return document.querySelector('[ng-version]') !== null
  })
}

/** Playwright fixture function that provides `hook` as the value of the `appReady` option. */
export type AppReadyOption = (
  deps: { browserName: string },
  use: (hook: AppReady | undefined) => Promise<void>,
) => Promise<void>

/**
 * Wraps a hook for the `appReady` option. Playwright treats a function given to an option (in
 * `test.use()`, the config `use` or a fixture default) as a fixture function and calls it with the
 * fixtures, so a bare `AppReady` does not work there. Use `test.use({ appReady: appReadyOption(hook) })`.
 * `defineE2EConfig({ … }, { appReady })` and `flutterConfig()` wrap the hook for you.
 */
export function appReadyOption(hook: AppReady | undefined): AppReadyOption {
  // The destructured first argument is required: Playwright reads it to find the dependencies.
  return async ({ browserName: _browserName }, use) => {
    await use(hook)
  }
}
