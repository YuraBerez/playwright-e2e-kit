import type { Page } from '@playwright/test';
import type { AppReady } from '../core/app-ready.js';
/**
 * Selector of the accessibility root that Compose Multiplatform web (wasmJs) builds next to its
 * canvas, inside the viewport's open shadow root. Playwright CSS pierces open shadow roots.
 */
export declare const COMPOSE_A11Y_ROOT = "#cmp_a11y_root";
export interface ComposeReadyOptions {
    /** Timeout of the wait, in ms. Default: the page's default timeout. */
    timeout?: number;
}
/**
 * App-ready hook for a Compose Multiplatform web (wasmJs) app. `ComposeViewport` creates the
 * canvas and an empty `#cmp_a11y_root` when the wasm module starts, and fills the root with one
 * node per semantics node after the first composition and layout. This hook waits for that first
 * node: from then on `getByRole` / `getByText` / `getByTestId` see the widgets.
 *
 * Compose sends no "first frame" event, so nothing must be installed before navigation. The tree
 * needs no activation: it is on by default (`isA11YEnabled = true`). An app that sets
 * `isA11YEnabled = false` has no tree, and this hook fails with an error that says so.
 */
export declare const composeReady: (page: Page, options?: ComposeReadyOptions) => Promise<void>;
/** `composeReady` with fixed options, as an `AppReady`. */
export declare function composeReadyWith(options: ComposeReadyOptions): AppReady;
//# sourceMappingURL=ready.d.ts.map