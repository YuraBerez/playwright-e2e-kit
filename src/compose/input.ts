import type { Locator } from '@playwright/test'

/** Class of the hidden `<textarea>` / `<input>` that takes the keyboard input of a focused Compose text field. */
export const COMPOSE_BACKING_FIELD_CLASS = 'compose-backing-field'

export interface ComposeTapOptions {
  /** Timeout of the wait for the node, in ms. Default: the page's default timeout. */
  timeout?: number
}

export interface ComposeTypeOptions extends ComposeTapOptions {
  /** Select all and delete the current text first. Default `true`. */
  clear?: boolean
  /**
   * After typing, wait until the field shows this text (`composeReadText`): the value after the
   * field's `VisualTransformation`, for example `555 123 4567` for the digits `5551234567`. A
   * string must match exactly. Not allowed for a password field.
   */
  expected?: string | RegExp
  /**
   * Press Enter after the text (and after the `expected` check): the IME action of a single-line
   * field (`ImeAction.Search`, `Done`, `Go`…). A multiline field has no IME action on Enter, so
   * `submit: true` on it throws.
   */
  submit?: boolean
  /**
   * Treat the field as a password field: no read-back, and no error message shows the value. The
   * kit sets it itself when the field has `KeyboardType.Password` (the backing field has
   * `inputmode="password"`). Set it for other secret fields, for example `KeyboardType.NumberPassword`.
   */
  password?: boolean
}

export interface ComposeClearOptions extends ComposeTapOptions {
  /** The text of the empty field, for a mask that shows a template (for example `___-____`). Default `''`. */
  expected?: string | RegExp
}

/** Default wait of the read-back checks (`expected` of `composeType` and `composeClear`), in ms. */
const READ_BACK_TIMEOUT = 5_000
const READ_BACK_POLL_MS = 50
/**
 * Select all + Backspace rounds of a clear. A second tap on a focused field right after the first
 * one (a double tap) can leave select all with no effect in a password field; one more round clears it.
 */
const CLEAR_ROUNDS = 3
const CLEAR_ROUND_MS = 1_000
/** How long the clear step of `composeType` waits for an empty field before one more round. */
const TYPE_CLEAR_CHECK_MS = 300

/** Click errors that mean "no click was sent, try again": the node was hidden or replaced. */
const RETRYABLE_CLICK = /not visible|not attached|detached/i
const MAX_TAP_ATTEMPTS = 5

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
export async function composeTap(locator: Locator, options: ComposeTapOptions = {}): Promise<void> {
  const deadline = options.timeout === undefined ? undefined : Date.now() + options.timeout
  for (let attempt = 1; ; attempt++) {
    const timeout = deadline === undefined ? undefined : Math.max(1, deadline - Date.now())
    await locator.waitFor({ state: 'visible', timeout })
    try {
      await locator.click({ force: true, timeout })
      return
    } catch (error) {
      if (attempt >= MAX_TAP_ATTEMPTS || !(error instanceof Error) || !RETRYABLE_CLICK.test(error.message)) throw error
    }
  }
}

/** The hidden backing field that Compose focused for the text field: its tag and its `inputmode`. */
interface BackingField {
  multiline: boolean
  inputMode: string
}

/** Taps the field and waits until Compose focuses its backing field. */
async function focusField(locator: Locator, options: ComposeTapOptions): Promise<BackingField> {
  const page = locator.page()
  await composeTap(locator, options)
  await page.waitForFunction(
    (cls) => {
      let active: Element | null = document.activeElement
      while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
      return !!active?.classList.contains(cls)
    },
    COMPOSE_BACKING_FIELD_CLASS,
    { timeout: options.timeout },
  )
  return page.evaluate(() => {
    let active: Element | null = document.activeElement
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
    return { multiline: active?.tagName === 'TEXTAREA', inputMode: active?.getAttribute('inputmode') ?? '' }
  })
}

async function selectAllAndDelete(locator: Locator): Promise<void> {
  const keyboard = locator.page().keyboard
  await keyboard.press('ControlOrMeta+A')
  await keyboard.press('Backspace')
}

const matches = (text: string, expected: string | RegExp) => (typeof expected === 'string' ? text === expected : expected.test(text))

/**
 * Waits until `composeReadText(locator)` matches `expected`. Returns the last text when it does
 * not match within `timeout`.
 */
async function waitForText(locator: Locator, expected: string | RegExp, timeout: number): Promise<{ ok: boolean; text: string }> {
  const deadline = Date.now() + timeout
  let text = ''
  for (;;) {
    try {
      // Compose can replace the node for a moment after a change: a failed read is tried again.
      text = await composeReadText(locator, { timeout: Math.max(READ_BACK_POLL_MS * 4, deadline - Date.now()) })
      if (matches(text, expected)) return { ok: true, text }
    } catch (error) {
      if (Date.now() >= deadline) throw error
    }
    if (Date.now() >= deadline) return { ok: false, text }
    await new Promise((resolve) => setTimeout(resolve, READ_BACK_POLL_MS))
  }
}

/**
 * Reads the text that a Compose node shows. For a text field it is the value after the field's
 * `VisualTransformation`: a masked field gives the formatted value (`555 123 4567`), a password
 * field gives bullets (`•••`). The lines of a multiline field are joined with `\n`.
 *
 * Compose updates the accessibility node a moment after the change. To wait for a value, use
 * `expect(locator).toHaveText()` or the `expected` option of `composeType`.
 */
export async function composeReadText(locator: Locator, options: ComposeTapOptions = {}): Promise<string> {
  await locator.waitFor({ state: 'attached', timeout: options.timeout })
  return locator.evaluate((node) => {
    // Compose writes each line break of the value as a <br>.
    const read = (n: Node): string =>
      n.nodeType === 3 ? (n.nodeValue ?? '') : n.nodeName === 'BR' ? '\n' : Array.from(n.childNodes, read).join('')
    return read(node)
  })
}

/**
 * Clears a Compose text field: taps it, waits for the backing field, selects all and deletes, then
 * waits until the field shows `expected` (default `''`). The error gives only the number of
 * characters left, never the text.
 */
export async function composeClear(locator: Locator, options: ComposeClearOptions = {}): Promise<void> {
  await focusField(locator, options)
  const expected = options.expected ?? ''
  const deadline = Date.now() + (options.timeout ?? READ_BACK_TIMEOUT)
  let result = { ok: false, text: '' }
  for (let round = 1; round <= CLEAR_ROUNDS && !result.ok; round++) {
    await selectAllAndDelete(locator)
    const left = deadline - Date.now()
    result = await waitForText(locator, expected, round < CLEAR_ROUNDS ? Math.min(CLEAR_ROUND_MS, left) : left)
  }
  if (!result.ok) {
    throw new Error(
      `composeClear: ${locator} still shows ${result.text.length} characters after select all + Backspace ` +
        `(expected ${typeof expected === 'string' ? `${expected.length} characters` : expected}).`,
    )
  }
}

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
export async function composeType(locator: Locator, text: string, options: ComposeTypeOptions = {}): Promise<void> {
  const page = locator.page()
  const field = await focusField(locator, options)
  const secret = options.password ?? field.inputMode === 'password'
  if (secret && options.expected !== undefined) {
    throw new Error(`composeType: ${locator} is a password field; it shows bullets, so \`expected\` cannot check it. Check the result of the input instead.`)
  }
  if (!field.multiline && text.includes('\n')) {
    throw new Error(
      `composeType: ${locator} is a single-line field, and a newline in the text would press Enter (its IME action). ` +
        'Remove the newline, and pass `submit: true` to press Enter after the text.',
    )
  }
  if (field.multiline && options.submit) {
    throw new Error(`composeType: ${locator} is a multiline field: Enter inserts a newline, so \`submit: true\` cannot run an IME action.`)
  }
  if (options.clear ?? true) {
    await selectAllAndDelete(locator)
    // One more round when the field is not empty yet (see CLEAR_ROUNDS). A mask that shows a
    // template when empty only costs the short wait: Backspace on an empty field does nothing.
    if (!(await waitForText(locator, '', TYPE_CLEAR_CHECK_MS)).ok) await selectAllAndDelete(locator)
  }
  await page.keyboard.type(text)
  if (options.expected !== undefined) {
    const result = await waitForText(locator, options.expected, options.timeout ?? READ_BACK_TIMEOUT)
    if (!result.ok) {
      throw new Error(`composeType: ${locator} shows ${JSON.stringify(result.text)}, expected ${typeof options.expected === 'string' ? JSON.stringify(options.expected) : options.expected}.`)
    }
  }
  if (options.submit) await page.keyboard.press('Enter')
}
