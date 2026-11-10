import type { Locator } from '@playwright/test';
import { type ScrollUntilVisibleOptions } from './canvas-scroll.js';
import { BaseScreen } from './screen.js';
/**
 * `BaseScreen` for a Flutter web app. `open()` installs the `flutter-first-frame` listener before
 * it navigates, and `open()` / `reload()` wait with the page's app-ready hook, or with
 * `flutterReady` when none is set. Subclasses keep their locators `private`, as for `BaseScreen`,
 * and use `scrollUntilVisible()` for items of a virtualised list.
 */
export declare abstract class FlutterScreen extends BaseScreen {
    open(): Promise<void>;
    protected waitReady(): Promise<void>;
    /** Scrolls `within` (default: the viewport) until `locator` is on screen. See `scrollUntilVisible`. */
    protected scrollUntilVisible(locator: Locator, options?: ScrollUntilVisibleOptions): Promise<void>;
}
