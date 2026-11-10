import { getAppReady } from '../core/app-ready.js';
import { scrollUntilVisible } from '../canvas/scroll.js';
import { composeTap, composeType } from './input.js';
import { composeReady } from './ready.js';
import { BaseScreen } from '../core/screen.js';
/**
 * `BaseScreen` for a Compose Multiplatform web (wasmJs) app. `open()` / `reload()` wait with the
 * page's app-ready hook, or with `composeReady` when none is set. Subclasses keep their locators
 * `private`, as for `BaseScreen`, and use `tap()` / `typeText()` (a plain `click()` / `fill()`
 * does not reach the canvas) and `scrollUntilVisible()` for items of a lazy list.
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
    /** Scrolls `within` (default: the viewport) until `locator` is on screen. See `scrollUntilVisible`. */
    async scrollUntilVisible(locator, options = {}) {
        await scrollUntilVisible(this.page, locator, options);
    }
}
//# sourceMappingURL=screen.js.map