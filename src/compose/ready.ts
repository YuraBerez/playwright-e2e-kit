import type { Page } from '@playwright/test'
import type { AppReady } from '../core/app-ready.js'

/**
 * Selector of the accessibility root that Compose Multiplatform web (wasmJs) builds next to its
 * canvas, inside the viewport's open shadow root. Playwright CSS pierces open shadow roots.
 */
export const COMPOSE_A11Y_ROOT = '#cmp_a11y_root'

export interface ComposeReadyOptions {
  /** Timeout of the wait, in ms. Default: the page's default timeout. */
  timeout?: number
}

function within(timeout: number | undefined): string {
  return timeout === undefined ? 'within the default timeout' : `within ${timeout} ms`
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
export const composeReady = async (page: Page, options: ComposeReadyOptions = {}): Promise<void> => {
  try {
    await page.locator(`${COMPOSE_A11Y_ROOT} > *`).first().waitFor({ state: 'attached', timeout: options.timeout })
  } catch (cause) {
    const hasRoot = (await page.locator(COMPOSE_A11Y_ROOT).count()) > 0
    const hint = hasRoot
      ? `${COMPOSE_A11Y_ROOT} is there but has no nodes: the first composition did not finish (see the browser console).`
      : `There is no ${COMPOSE_A11Y_ROOT}: check that the page is a Compose Multiplatform wasmJs app and that ` +
        'ComposeViewport does not set isA11YEnabled = false.'
    throw new Error(`composeReady: the Compose accessibility tree did not get a node ${within(options.timeout)}. ${hint}`, {
      cause,
    })
  }
}

/** `composeReady` with fixed options, as an `AppReady`. */
export function composeReadyWith(options: ComposeReadyOptions): AppReady {
  return (page) => composeReady(page, options)
}
