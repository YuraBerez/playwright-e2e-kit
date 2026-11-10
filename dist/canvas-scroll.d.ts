import type { Locator, Page } from '@playwright/test';
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
 * Scrolls a canvas-rendered list (Flutter web, Compose Multiplatform wasm) until `locator` is on
 * screen. These lists are virtualised and drawn on a canvas: an off-screen item is not in the
 * accessibility DOM tree, and `scrollIntoViewIfNeeded` cannot reach it. This moves the mouse over the scrollable and turns the wheel, one step (80% of its
 * size) at a time, until the centre of `locator` is inside the scrollable.
 *
 * Throws after `maxSwipes` steps with no match.
 */
export declare function scrollUntilVisible(page: Page, locator: Locator, options?: ScrollUntilVisibleOptions): Promise<void>;
