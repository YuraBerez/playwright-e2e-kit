import type { Locator } from '@playwright/test';
/** Class of the hidden `<textarea>` / `<input>` that takes the keyboard input of a focused Compose text field. */
export declare const COMPOSE_BACKING_FIELD_CLASS = "compose-backing-field";
export interface ComposeTapOptions {
    /** Timeout of the wait for the node, in ms. Default: the page's default timeout. */
    timeout?: number;
}
export interface ComposeTypeOptions extends ComposeTapOptions {
    /** Select all and delete the current text first. Default `true`. */
    clear?: boolean;
    /**
     * After typing, wait until the field shows this text (`composeReadText`): the value after the
     * field's `VisualTransformation`, for example `555 123 4567` for the digits `5551234567`. A
     * string must match exactly. Not allowed for a password field.
     */
    expected?: string | RegExp;
    /**
     * Press Enter after the text (and after the `expected` check): the IME action of a single-line
     * field (`ImeAction.Search`, `Done`, `Go`…). A multiline field has no IME action on Enter, so
     * `submit: true` on it throws.
     */
    submit?: boolean;
    /**
     * Treat the field as a password field: no read-back, and no error message shows the value. The
     * kit sets it itself when the field has `KeyboardType.Password` (the backing field has
     * `inputmode="password"`). Set it for other secret fields, for example `KeyboardType.NumberPassword`.
     */
    password?: boolean;
}
export interface ComposeClearOptions extends ComposeTapOptions {
    /** The text of the empty field, for a mask that shows a template (for example `___-____`). Default `''`. */
    expected?: string | RegExp;
}
/**
 * Clicks a Compose node. The accessibility nodes have `pointer-events: none` and the canvas is on
 * top, so a plain `locator.click()` waits for ever ("canvas intercepts pointer events"). This
 * waits until the node is visible, then clicks the centre of its box with `force: true`: the real
 * pointer events go to the canvas, and Compose hit-tests them as for a user (a disabled button
 * stays disabled, a dialog on top gets the click).
 *
 * Compose re-syncs the nodes after a recomposition, so a node can be hidden or replaced for a
 * moment between the wait and the click. A forced click does not wait again, so the click is
 * tried again (up to 5 times, inside `timeout`) when it fails with "not visible" or "not attached".
 */
export declare function composeTap(locator: Locator, options?: ComposeTapOptions): Promise<void>;
/**
 * Reads the text that a Compose node shows. For a text field it is the value after the field's
 * `VisualTransformation`: a masked field gives the formatted value (`555 123 4567`), a password
 * field gives bullets (`•••`). The lines of a multiline field are joined with `\n`.
 *
 * Compose updates the accessibility node a moment after the change. To wait for a value, use
 * `expect(locator).toHaveText()` or the `expected` option of `composeType`.
 */
export declare function composeReadText(locator: Locator, options?: ComposeTapOptions): Promise<string>;
/**
 * Clears a Compose text field: taps it, waits for the backing field, selects all and deletes, then
 * waits until the field shows `expected` (default `''`). The error gives only the number of
 * characters left, never the text.
 */
export declare function composeClear(locator: Locator, options?: ComposeClearOptions): Promise<void>;
/**
 * Types into a Compose text field: taps it, waits until Compose focuses its hidden backing field,
 * clears it (select all + Backspace, unless `clear: false`) and types `text` with the keyboard.
 *
 * - **Masked field** (`VisualTransformation`): type the raw value (the digits) and pass the
 *   formatted value as `expected`; it waits until the field shows it.
 * - **Password field:** no read-back. `expected` throws, and no error message shows the value.
 * - **Multiline field:** each `\n` in `text` presses Enter, which inserts a newline.
 * - **Single-line field:** a `\n` in `text` throws (Enter would run the IME action); pass
 *   `submit: true` to press Enter after the text.
 *
 * `locator.fill()` on the `contenteditable` node reaches the app in Chromium only, and `fill()` or
 * `pressSequentially()` after the tap move the focus away from the backing field. Keyboard input
 * works in Chromium, Firefox and WebKit.
 */
export declare function composeType(locator: Locator, text: string, options?: ComposeTypeOptions): Promise<void>;
//# sourceMappingURL=input.d.ts.map