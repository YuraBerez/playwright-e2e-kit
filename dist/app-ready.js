const hooks = new WeakMap();
/** Registers the hook for one page. `undefined` removes it. */
export function setAppReady(page, hook) {
    if (hook)
        hooks.set(page, hook);
    else
        hooks.delete(page);
}
/** The hook registered for `page`, or `undefined` (the default: no wait). */
export function getAppReady(page) {
    return hooks.get(page);
}
/** Ready when the DOM is parsed. No network wait. */
export const domContentReady = (page) => page.waitForLoadState('domcontentloaded');
/** Ready when Nuxt has hydrated (`window.useNuxtApp()` exists and `isHydrating` is false). */
export const nuxtReady = async (page) => {
    await page.waitForFunction(() => {
        const nuxt = window.useNuxtApp?.();
        return !!nuxt && !nuxt.isHydrating;
    });
};
