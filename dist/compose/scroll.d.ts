import type { Locator, Page } from '@playwright/test';
export interface ComposeScrollOptions {
    /** The scrollable node (for example the list's `getByTestId`). Default: the viewport. */
    within?: Locator;
    /** Scroll axis: `y` for a `LazyColumn`, `x` for a `LazyRow`. Default `y`. */
    axis?: 'y' | 'x';
    /**
     * Distance of one step, in CSS px. A positive step goes down (`y`) or right (`x`), a negative
     * step goes up or left. Default: 80% of the scrollable's size on the axis.
     */
    step?: number;
    /** Steps before it gives up. Default 50. It stops earlier when the list reaches its end. */
    maxSteps?: number;
    /**
     * `wheel` (default) turns the mouse wheel over the scrollable. `drag` drags a touch pointer
     * across it, for apps that do not scroll on the wheel.
     */
    mode?: 'wheel' | 'drag';
    /** How long to wait for the target and for the list to settle after each step, in ms. Default 500. */
    settleTimeout?: number;
    /** Same as `maxSteps`; the name of the shared `scrollUntilVisible` option. */
    maxSwipes?: number;
    /** Same as `axis` plus the sign of `step`; the name of the shared `scrollUntilVisible` option. */
    direction?: 'down' | 'up' | 'left' | 'right';
}
/** Axis and sign from the options. The shared `direction` option sets both. */
export declare function scrollPlan(options: ComposeScrollOptions): {
    axis: 'x' | 'y';
    sign: 1 | -1;
};
/**
 * `composeScrollUntilVisible` on a given page. `ComposeScreen.scrollUntilVisible` calls it with
 * its own page.
 */
export declare function scrollComposeUntilVisible(page: Page, locator: Locator, options?: ComposeScrollOptions): Promise<void>;
/**
 * Scrolls a Compose list until the centre of `locator` is inside the scrollable. A `LazyColumn` or
 * `LazyRow` composes only the items near its viewport, so an item further away is not in the
 * accessibility tree, and `scrollIntoViewIfNeeded` cannot reach it.
 *
 * Each step turns the mouse wheel over the centre of `within` (`mode: 'wheel'`), or drags a touch
 * pointer across it (`mode: 'drag'`), on `axis` (`y` or `x`). After each step it queries
 * `locator` again. It throws when the list stops moving (its end) or after `maxSteps` steps.
 *
 * Nested lists: pass the list that scrolls on the axis as `within`. A vertical step over a
 * horizontal `LazyRow` scrolls the vertical list around it.
 */
export declare function composeScrollUntilVisible(locator: Locator, options?: ComposeScrollOptions): Promise<void>;
//# sourceMappingURL=scroll.d.ts.map