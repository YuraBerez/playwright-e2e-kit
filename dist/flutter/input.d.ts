import type { Locator, Page } from '@playwright/test';
export interface FlutterTypeOptions {
    /** Timeout of each wait (field visible, focus), in ms. Default: the page's default timeout. */
    timeout?: number;
    /** How many times to focus and fill again when the value does not hold. Default 3. */
    attempts?: number;
}
/** Resolves after two animation frames: Flutter attaches its text-editing listeners in the frame after the focus. */
export declare function waitTwoFrames(page: Page): Promise<void>;
/**
 * Types into a Flutter web text field: clicks it, waits until it has the focus, waits two
 * animation frames, fills `text`, and confirms the value through the semantics node two frames
 * later. A `fill()` made before Flutter takes the field is dropped, so the value is checked and,
 * if it did not hold, the field is focused and filled again (up to `attempts`).
 *
 * `locator` is the text field (`getByRole('textbox', { name })`) or a node that wraps it
 * (`getByTestId(…)` on `Semantics(identifier:)`). `fill()` replaces the current text.
 */
export declare function flutterType(locator: Locator, text: string, options?: FlutterTypeOptions): Promise<void>;
//# sourceMappingURL=input.d.ts.map