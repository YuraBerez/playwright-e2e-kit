import { getAppReady } from '../core/app-ready.js';
import { scrollUntilVisible } from '../canvas/scroll.js';
import { flutterType } from './input.js';
import { flutterReady, installFlutterFirstFrameListener } from './ready.js';
import { BaseScreen } from '../core/screen.js';
/**
 * `BaseScreen` for a Flutter web app. `open()` installs the `flutter-first-frame` listener before
 * it navigates, and `open()` / `reload()` wait with the page's app-ready hook, or with
 * `flutterReady` when none is set. Subclasses keep their locators `private`, as for `BaseScreen`,
 * use `scrollUntilVisible()` for items of a virtualised list and `typeText()` for text fields.
 */
export class FlutterScreen extends BaseScreen {
    async open() {
        await installFlutterFirstFrameListener(this.page);
        await super.open();
    }
    async waitReady() {
        await (getAppReady(this.page) ?? flutterReady)(this.page);
    }
    /** Scrolls `within` (default: the viewport) until `locator` is on screen. See `scrollUntilVisible`. */
    async scrollUntilVisible(locator, options = {}) {
        await scrollUntilVisible(this.page, locator, options);
    }
    /** Focuses the text field, fills `text` and confirms the value. See `flutterType`. */
    async typeText(locator, text, options = {}) {
        await flutterType(locator, text, options);
    }
}
//# sourceMappingURL=screen.js.map