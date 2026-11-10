import type { Locator, Page } from '@playwright/test';
import { BaseScreen } from './screen.js';
export interface ScrollUntilVisibleOptions {
    /** The scrollable node (for example the list's `getByTestId`). Default: the viewport. */
    within?: Locator;
    /** Wheel steps before it gives up. Default 10. */
    maxSwipes?: number;
    /** Scroll direction. Default `down`. */
    direction?: 'down' | 'up' | 'left' | 'right';
    /** How long to wait for the target after each step, in ms. Default 500. */
    settleTimeout?: number;
}
/**
 * Scrolls a Flutter list until `locator` is on screen. Flutter lists are virtualised and drawn on
 * a canvas: an off-screen item is not in the semantics tree, and `scrollIntoViewIfNeeded` cannot
 * reach it. This moves the mouse over the scrollable and turns the wheel, one step (80% of its
 * size) at a time, until the centre of `locator` is inside the scrollable.
 *
 * Throws after `maxSwipes` steps with no match.
 */
export declare function scrollUntilVisible(page: Page, locator: Locator, options?: ScrollUntilVisibleOptions): Promise<void>;
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
