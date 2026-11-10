import { getAppReady } from './app-ready.js';
import { scrollUntilVisible } from './canvas-scroll.js';
import { flutterReady, installFlutterFirstFrameListener } from './flutter-ready.js';
import { BaseScreen } from './screen.js';
/**
 * `BaseScreen` for a Flutter web app. `open()` installs the `flutter-first-frame` listener before
 * it navigates, and `open()` / `reload()` wait with the page's app-ready hook, or with
 * `flutterReady` when none is set. Subclasses keep their locators `private`, as for `BaseScreen`,
 * and use `scrollUntilVisible()` for items of a virtualised list.
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
}
