import type { BrowserContext, Page } from '@playwright/test'
import type { AppReady } from './app-ready.js'

/**
 * Window property set by the first-frame init script: `false` once the listener is installed,
 * `true` after the `flutter-first-frame` event. `undefined` means the listener was not installed.
 */
export const FLUTTER_FIRST_FRAME_FLAG = '__e2eKitFlutterFirstFrame'

/**
 * Init script (run with `addInitScript`, before any page script) that records the
 * `flutter-first-frame` event in a window flag. It is idempotent in one document.
 */
function firstFrameScript(flag: string): void {
  const w = window as unknown as Record<string, unknown>
  if (w[flag] !== undefined) return
  w[flag] = false
  window.addEventListener('flutter-first-frame', () => {
    w[flag] = true
  })
}

const installed = new WeakSet<Page | BrowserContext>()

/**
 * Installs the `flutter-first-frame` listener on a page or a whole context. Call it **before**
 * navigation: a fast first frame fires before `goto` returns, and a listener added later misses
 * it. `flutterFixture()` and `FlutterScreen.open()` call it for you. A second call is a no-op.
 */
export async function installFlutterFirstFrameListener(target: Page | BrowserContext): Promise<void> {
  if (installed.has(target)) return
  installed.add(target)
  await target.addInitScript(firstFrameScript, FLUTTER_FIRST_FRAME_FLAG)
}

export interface FlutterReadyOptions {
  /** Timeout of each wait, in ms. Default: the page's default timeout. */
  timeout?: number
}

function within(timeout: number | undefined): string {
  return timeout === undefined ? 'within the default timeout' : `within ${timeout} ms`
}

/**
 * Turns on the Flutter semantics tree, so that `getByRole` / `getByLabel` / `getByTestId` can see
 * the canvas-rendered widgets. If the app called `SemanticsBinding.instance.ensureSemantics()`,
 * the tree is already there and this is a no-op. Otherwise it activates the
 * `flt-semantics-placeholder` once and waits for the first `flt-semantics` node.
 */
export async function enableFlutterSemantics(page: Page, options: FlutterReadyOptions = {}): Promise<void> {
  const tree = page.locator('flt-semantics')
  if ((await tree.count()) > 0) return
  const placeholder = page.locator('flt-semantics-placeholder')
  // The placeholder is a 1px element outside the viewport: a pointer click cannot reach it, so the
  // click event is dispatched on it. Flutter removes it when semantics are on.
  if ((await placeholder.count()) > 0) await placeholder.dispatchEvent('click')
  try {
    await tree.first().waitFor({ state: 'attached', timeout: options.timeout })
  } catch (cause) {
    throw new Error(
      `flutterReady: the Flutter semantics tree (flt-semantics) did not appear ${within(options.timeout)}. ` +
        'Call SemanticsBinding.instance.ensureSemantics() in the app, or check that the page is a Flutter web app.',
      { cause },
    )
  }
}

/**
 * App-ready hook for a Flutter web app: waits for the `flutter-first-frame` event, then turns on
 * the semantics tree (see `enableFlutterSemantics`).
 *
 * Requires the first-frame listener before navigation (`flutterFixture()`, `FlutterScreen.open()`
 * or `installFlutterFirstFrameListener()`); without it, it throws at once instead of waiting.
 */
export const flutterReady = async (page: Page, options: FlutterReadyOptions = {}): Promise<void> => {
  const state = await page.evaluate((flag) => (window as unknown as Record<string, unknown>)[flag], FLUTTER_FIRST_FRAME_FLAG)
  if (state === undefined) {
    throw new Error(
      'flutterReady: the flutter-first-frame listener is not installed. Install it before navigation with ' +
        'flutterFixture(), FlutterScreen.open() or installFlutterFirstFrameListener(page).',
    )
  }
  if (state !== true) {
    try {
      await page.waitForFunction(
        (flag) => (window as unknown as Record<string, unknown>)[flag] === true,
        FLUTTER_FIRST_FRAME_FLAG,
        { timeout: options.timeout },
      )
    } catch (cause) {
      throw new Error(
        `flutterReady: no flutter-first-frame event ${within(options.timeout)}. ` +
          'Check that the page is a Flutter web app and that it started (see the browser console).',
        { cause },
      )
    }
  }
  await enableFlutterSemantics(page, options)
}

/** `flutterReady` with fixed options, as an `AppReady`. */
export function flutterReadyWith(options: FlutterReadyOptions): AppReady {
  return (page) => flutterReady(page, options)
}
