import type { Locator } from '@playwright/test';
import { type ScrollUntilVisibleOptions } from '../canvas/scroll.js';
import { type FlutterTypeOptions } from './input.js';
import { BaseScreen } from '../core/screen.js';
/**
 * `BaseScreen` for a Flutter web app. `open()` installs the `flutter-first-frame` listener before
 * it navigates, and `open()` / `reload()` wait with the page's app-ready hook, or with
 * `flutterReady` when none is set. Subclasses keep their locators `private`, as for `BaseScreen`,
 * use `scrollUntilVisible()` for items of a virtualised list and `typeText()` for text fields.
 */
export declare abstract class FlutterScreen extends BaseScreen {
    open(): Promise<void>;
    protected waitReady(): Promise<void>;
    /** Scrolls `within` (default: the viewport) until `locator` is on screen. See `scrollUntilVisible`. */
    protected scrollUntilVisible(locator: Locator, options?: ScrollUntilVisibleOptions): Promise<void>;
    /** Focuses the text field, fills `text` and confirms the value. See `flutterType`. */
    protected typeText(locator: Locator, text: string, options?: FlutterTypeOptions): Promise<void>;
}
//# sourceMappingURL=screen.d.ts.map