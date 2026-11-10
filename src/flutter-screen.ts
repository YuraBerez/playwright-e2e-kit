import type { Locator, Page } from '@playwright/test'
import { getAppReady } from './app-ready.js'
import { flutterReady, installFlutterFirstFrameListener } from './flutter-ready.js'
import { BaseScreen } from './screen.js'

export interface ScrollUntilVisibleOptions {
  /** The scrollable node (for example the list's `getByTestId`). Default: the viewport. */
  within?: Locator
  /** Wheel steps before it gives up. Default 10. */
  maxSwipes?: number
  /** Scroll direction. Default `down`. */
  direction?: 'down' | 'up' | 'left' | 'right'
  /** How long to wait for the target after each step, in ms. Default 500. */
  settleTimeout?: number
}

type Box = { x: number; y: number; width: number; height: number }

function centerInside(target: Box, area: Box): boolean {
  const cx = target.x + target.width / 2
  const cy = target.y + target.height / 2
  return cx >= area.x && cx <= area.x + area.width && cy >= area.y && cy <= area.y + area.height
}

/**
 * Scrolls a Flutter list until `locator` is on screen. Flutter lists are virtualised and drawn on
 * a canvas: an off-screen item is not in the semantics tree, and `scrollIntoViewIfNeeded` cannot
 * reach it. This moves the mouse over the scrollable and turns the wheel, one step (80% of its
 * size) at a time, until the centre of `locator` is inside the scrollable.
 *
 * Throws after `maxSwipes` steps with no match.
 */
export async function scrollUntilVisible(page: Page, locator: Locator, options: ScrollUntilVisibleOptions = {}): Promise<void> {
  const maxSwipes = options.maxSwipes ?? 10
  const settleTimeout = options.settleTimeout ?? 500
  const direction = options.direction ?? 'down'

  const area = async (): Promise<Box> => {
    if (options.within) {
      const box = await options.within.boundingBox()
      if (!box) throw new Error(`scrollUntilVisible: the scrollable ${options.within} is not visible.`)
      return box
    }
    const size = page.viewportSize()
    if (!size) throw new Error('scrollUntilVisible: the page has no fixed viewport; pass `within`.')
    return { x: 0, y: 0, ...size }
  }
  // `timeout` undefined: check once, no wait (a `waitFor` timeout of 0 means "no timeout").
  const onScreen = async (box: Box, timeout?: number): Promise<boolean> => {
    const target = locator.first()
    if (timeout === undefined) {
      if (!(await target.isVisible())) return false
    } else {
      try {
        await target.waitFor({ state: 'visible', timeout })
      } catch {
        return false
      }
    }
    const targetBox = await target.boundingBox()
    return !!targetBox && centerInside(targetBox, box)
  }

  let box = await area()
  if (await onScreen(box)) return
  for (let swipe = 1; swipe <= maxSwipes; swipe++) {
    const step = direction === 'up' || direction === 'down' ? box.height * 0.8 : box.width * 0.8
    const sign = direction === 'down' || direction === 'right' ? 1 : -1
    const vertical = direction === 'up' || direction === 'down'
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.wheel(vertical ? 0 : sign * step, vertical ? sign * step : 0)
    box = await area()
    if (await onScreen(box, settleTimeout)) return
  }
  throw new Error(`scrollUntilVisible: ${locator} is not on screen after ${maxSwipes} swipes ${direction}.`)
}

/**
 * `BaseScreen` for a Flutter web app. `open()` installs the `flutter-first-frame` listener before
 * it navigates, and `open()` / `reload()` wait with the page's app-ready hook, or with
 * `flutterReady` when none is set. Subclasses keep their locators `private`, as for `BaseScreen`,
 * and use `scrollUntilVisible()` for items of a virtualised list.
 */
export abstract class FlutterScreen extends BaseScreen {
  override async open(): Promise<void> {
    await installFlutterFirstFrameListener(this.page)
    await super.open()
  }

  protected override async waitReady(): Promise<void> {
    await (getAppReady(this.page) ?? flutterReady)(this.page)
  }

  /** Scrolls `within` (default: the viewport) until `locator` is on screen. See `scrollUntilVisible`. */
  protected async scrollUntilVisible(locator: Locator, options: ScrollUntilVisibleOptions = {}): Promise<void> {
    await scrollUntilVisible(this.page, locator, options)
  }
}
