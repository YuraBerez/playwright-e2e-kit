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
/**
 * Ready when Angular has bootstrapped and is stable. Opt-in, like `nuxtReady`. When the app exposes
 * testabilities (`window.getAllAngularTestabilities`, for example with
 * `provideProtractorTestingSupport()`), it waits until every one `isStable()`. Otherwise (the
 * default for a zoneless production build) it waits until a root element has the `ng-version`
 * attribute, which Angular sets when it bootstraps a component.
 */
export const angularReady = async (page) => {
    await page.waitForFunction(() => {
        const w = window;
        const testabilities = w.getAllAngularTestabilities?.();
        if (testabilities && testabilities.length > 0)
            return testabilities.every((t) => t.isStable());
        return document.querySelector('[ng-version]') !== null;
    });
};
/**
 * Ready when Angular has bootstrapped the root component and rendered its template: a root
 * element has `ng-version` and child nodes (Angular clears the host element, then the first change
 * detection renders the template). It does not wait for stability. Use it instead of
 * `angularReady` when the app is never stable, for example with a SignalR connection, polling or
 * an analytics SDK that keeps timers in the zone. Each screen then waits for its own content.
 */
export const angularBootstrapped = async (page) => {
    await page.waitForFunction(() => {
        const root = document.querySelector('[ng-version]');
        return root !== null && root.hasChildNodes();
    });
};
/**
 * Wraps a hook for the `appReady` option. Playwright treats a function given to an option (in
 * `test.use()`, the config `use` or a fixture default) as a fixture function and calls it with the
 * fixtures, so a bare `AppReady` does not work there. Use `test.use({ appReady: appReadyOption(hook) })`.
 * `defineE2EConfig({ … }, { appReady })` and `flutterConfig()` wrap the hook for you.
 */
export function appReadyOption(hook) {
    // The destructured first argument is required: Playwright reads it to find the dependencies.
    return async ({ browserName: _browserName }, use) => {
        await use(hook);
    };
}
//# sourceMappingURL=app-ready.js.map