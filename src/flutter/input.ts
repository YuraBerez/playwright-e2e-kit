import type { Locator, Page } from '@playwright/test'

export interface FlutterTypeOptions {
  /** Timeout of each wait (field visible, focus), in ms. Default: the page's default timeout. */
  timeout?: number
  /** How many times to focus and fill again when the value does not hold. Default 3. */
  attempts?: number
}

/** Selector of an editable element: Flutter web puts an `<input>` or `<textarea>` in the text-field semantics node. */
const EDITABLE = 'input, textarea, [contenteditable=""], [contenteditable="true"]'

/** Resolves after two animation frames: Flutter attaches its text-editing listeners in the frame after the focus. */
export async function waitTwoFrames(page: Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  )
}

/** The editable element itself, or the first one inside it (a `Semantics(identifier:)` node that wraps the field). */
async function editable(locator: Locator, timeout: number | undefined): Promise<Locator> {
  await locator.waitFor({ state: 'visible', timeout })
  const isEditable = await locator.evaluate((el, selector) => el.matches(selector), EDITABLE)
  return isEditable ? locator : locator.locator(EDITABLE).first()
}

/** True when the focused element (through open shadow roots) is `el` or inside it. */
function hasFocus(el: Element): boolean {
  let active: Element | null = document.activeElement
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement
  return !!active && (active === el || el.contains(active))
}

/**
 * Types into a Flutter web text field: clicks it, waits until it has the focus, waits two
 * animation frames, fills `text`, and confirms the value through the semantics node two frames
 * later. A `fill()` made before Flutter takes the field is dropped, so the value is checked and,
 * if it did not hold, the field is focused and filled again (up to `attempts`).
 *
 * `locator` is the text field (`getByRole('textbox', { name })`) or a node that wraps it
 * (`getByTestId(…)` on `Semantics(identifier:)`). `fill()` replaces the current text.
 */
export async function flutterType(locator: Locator, text: string, options: FlutterTypeOptions = {}): Promise<void> {
  const page = locator.page()
  const attempts = options.attempts ?? 3
  const field = await editable(locator, options.timeout)
  let last = ''
  for (let attempt = 1; attempt <= attempts; attempt++) {
    await field.click({ timeout: options.timeout })
    await page.waitForFunction(hasFocus, await field.elementHandle({ timeout: options.timeout }), { timeout: options.timeout })
    await waitTwoFrames(page)
    await field.fill(text, { timeout: options.timeout })
    await waitTwoFrames(page)
    last = await field.inputValue({ timeout: options.timeout })
    if (last === text) return
  }
  throw new Error(
    `flutterType: the field shows ${JSON.stringify(last)} instead of ${JSON.stringify(text)} after ${attempts} attempt(s). ` +
      'Check that the locator is the text field (or wraps it) and that the field is enabled.',
  )
}
