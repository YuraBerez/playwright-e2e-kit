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
}

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

/**
 * Types into a Compose text field: taps it, waits until Compose focuses its hidden backing field,
 * clears it (select all + Backspace, unless `clear: false`) and types `text` with the keyboard.
 *
 * `locator.fill()` on the `contenteditable` node reaches the app in Chromium only, and `fill()` or
 * `pressSequentially()` after the tap move the focus away from the backing field. Keyboard input
 * works in Chromium and WebKit.
 */
export async function composeType(locator: Locator, text: string, options: ComposeTypeOptions = {}): Promise<void> {
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
  if (options.clear ?? true) {
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.press('Backspace')
  }
  await page.keyboard.type(text)
}
