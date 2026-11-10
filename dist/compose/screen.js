import { getAppReady } from '../core/app-ready.js';
import { composeClear, composeReadText, composeTap, composeType, } from './input.js';
import { scrollComposeUntilVisible } from './scroll.js';
import { composeReady } from './ready.js';
import { BaseScreen } from '../core/screen.js';
/**
 * `BaseScreen` for a Compose Multiplatform web (wasmJs) app. `open()` / `reload()` wait with the
 * page's app-ready hook, or with `composeReady` when none is set. Subclasses keep their locators
 * `private`, as for `BaseScreen`, and use `tap()` / `typeText()` / `clearText()` / `readText()`
 * (a plain `click()` / `fill()` does not reach the canvas) and `scrollUntilVisible()` for items of
 * a lazy list.
 */
export class ComposeScreen extends BaseScreen {
    async waitReady() {
        await (getAppReady(this.page) ?? composeReady)(this.page);
    }
    /** Clicks a Compose node through the canvas. See `composeTap`. */
    async tap(locator, options = {}) {
        await composeTap(locator, options);
    }
    /** Types into a Compose text field (clears it first by default). See `composeType`. */
    async typeText(locator, text, options = {}) {
        await composeType(locator, text, options);
    }
    /** Clears a Compose text field. See `composeClear`. */
    async clearText(locator, options = {}) {
        await composeClear(locator, options);
    }
    /** The text that a Compose node shows (a masked field: the formatted value). See `composeReadText`. */
    async readText(locator, options = {}) {
        return composeReadText(locator, options);
    }
    /**
     * Scrolls `within` (default: the viewport) until `locator` is on screen, on `axis` `y` or `x`,
     * with the wheel or a touch drag. See `composeScrollUntilVisible`.
     */
    async scrollUntilVisible(locator, options = {}) {
        await scrollComposeUntilVisible(this.page, locator, options);
    }
}
//# sourceMappingURL=screen.js.map