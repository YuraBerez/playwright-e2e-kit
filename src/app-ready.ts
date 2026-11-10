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
