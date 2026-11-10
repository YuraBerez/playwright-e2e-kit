import type { Locator } from '@playwright/test';
import { type ScrollUntilVisibleOptions } from '../canvas/scroll.js';
import { type ComposeTapOptions, type ComposeTypeOptions } from './input.js';
import { BaseScreen } from '../core/screen.js';
/**
 * `BaseScreen` for a Compose Multiplatform web (wasmJs) app. `open()` / `reload()` wait with the
 * page's app-ready hook, or with `composeReady` when none is set. Subclasses keep their locators
 * `private`, as for `BaseScreen`, and use `tap()` / `typeText()` (a plain `click()` / `fill()`
 * does not reach the canvas) and `scrollUntilVisible()` for items of a lazy list.
 */
export declare abstract class ComposeScreen extends BaseScreen {
    protected waitReady(): Promise<void>;
    /** Clicks a Compose node through the canvas. See `composeTap`. */
    protected tap(locator: Locator, options?: ComposeTapOptions): Promise<void>;
    /** Types into a Compose text field (clears it first by default). See `composeType`. */
    protected typeText(locator: Locator, text: string, options?: ComposeTypeOptions): Promise<void>;
    /** Scrolls `within` (default: the viewport) until `locator` is on screen. See `scrollUntilVisible`. */
    protected scrollUntilVisible(locator: Locator, options?: ScrollUntilVisibleOptions): Promise<void>;
}
//# sourceMappingURL=screen.d.ts.map