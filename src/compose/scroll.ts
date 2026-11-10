import type { Locator, Page } from '@playwright/test'
import { COMPOSE_A11Y_ROOT } from './ready.js'

export interface ComposeScrollOptions {
  /** The scrollable node (for example the list's `getByTestId`). Default: the viewport. */
  within?: Locator
  /** Scroll axis: `y` for a `LazyColumn`, `x` for a `LazyRow`. Default `y`. */
  axis?: 'y' | 'x'
  /**
   * Distance of one step, in CSS px. A positive step goes down (`y`) or right (`x`), a negative
   * step goes up or left. Default: 80% of the scrollable's size on the axis.
   */
  step?: number
  /** Steps before it gives up. Default 50. It stops earlier when the list reaches its end. */
  maxSteps?: number
  /**
   * `wheel` (default) turns the mouse wheel over the scrollable. `drag` drags a touch pointer
   * across it, for apps that do not scroll on the wheel.
   */
  mode?: 'wheel' | 'drag'
  /** How long to wait for the target and for the list to settle after each step, in ms. Default 500. */
  settleTimeout?: number
  /** Same as `maxSteps`; the name of the shared `scrollUntilVisible` option. */
  maxSwipes?: number
  /** Same as `axis` plus the sign of `step`; the name of the shared `scrollUntilVisible` option. */
  direction?: 'down' | 'up' | 'left' | 'right'
}

type Box = { x: number; y: number; width: number; height: number }

const POLL_MS = 50
/** Pause between the touch events of a drag. Compose drops moves that come in the same few ms. */
const DRAG_PAUSE_MS = 40
const DRAG_MOVES = 5
/** Pointer id of the synthetic touch pointer. The mouse has id 0 or 1 in all browsers. */
const DRAG_POINTER_ID = 4242

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function centerInside(target: Box, area: Box): boolean {
  const cx = target.x + target.width / 2
  const cy = target.y + target.height / 2
  return cx >= area.x && cx <= area.x + area.width && cy >= area.y && cy <= area.y + area.height
}

/** Axis and sign from the options. The shared `direction` option sets both. */
export function scrollPlan(options: ComposeScrollOptions): { axis: 'x' | 'y'; sign: 1 | -1 } {
  const { direction, axis } = options
  if (direction) {
    const fromDirection = direction === 'left' || direction === 'right' ? 'x' : 'y'
    if (axis && axis !== fromDirection) {
      throw new Error(`composeScrollUntilVisible: axis '${axis}' does not match direction '${direction}'. Pass one of them.`)
    }
    if (options.step !== undefined && options.step < 0) {
      throw new Error('composeScrollUntilVisible: a negative step and a direction together are ambiguous. Pass one of them.')
    }
    return { axis: fromDirection, sign: direction === 'down' || direction === 'right' ? 1 : -1 }
  }
  if (options.step === 0) throw new Error('composeScrollUntilVisible: step must not be 0.')
  return { axis: axis ?? 'y', sign: options.step !== undefined && options.step < 0 ? -1 : 1 }
}

function describeWay(axis: 'x' | 'y', sign: 1 | -1): string {
  return axis === 'y' ? (sign > 0 ? 'down' : 'up') : sign > 0 ? 'right' : 'left'
}

/**
 * The positions of the nodes in the scrollable (or in the whole tree), as one string. It changes
 * when the list moves; it stays the same when a step did not move it (the list is at its end).
 */
async function snapshot(page: Page, within: Locator | undefined): Promise<string> {
  const read = (root: Element) => {
    const parts: string[] = []
    const nodes = root.querySelectorAll('*')
    for (let i = 0; i < nodes.length && i < 400; i++) {
      const node = nodes[i]!
      const r = node.getBoundingClientRect()
      parts.push(`${node.id || node.textContent?.slice(0, 20)}@${Math.round(r.x)},${Math.round(r.y)}`)
    }
    return parts.join('|')
  }
  return within ? within.evaluate(read) : page.locator(COMPOSE_A11Y_ROOT).evaluate(read)
}

/** Drags a touch pointer from `from` to `to` on the element under `from` (the Compose canvas). */
async function touchDrag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.evaluate(
    async ({ from, to, moves, pause, pointerId }) => {
      let target: Element | null = document.elementFromPoint(from.x, from.y)
      while (target?.shadowRoot) {
        const inner = target.shadowRoot.elementFromPoint(from.x, from.y)
        if (!inner || inner === target) break
        target = inner
      }
      if (!target) throw new Error(`no element at ${from.x},${from.y}`)
      const el = target
      const fire = (type: string, x: number, y: number, pressed: boolean) =>
        el.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerId,
            pointerType: 'touch',
            isPrimary: true,
            clientX: x,
            clientY: y,
            button: 0,
            buttons: pressed ? 1 : 0,
            width: 1,
            height: 1,
            pressure: pressed ? 0.5 : 0,
          }),
        )
      const wait = () => new Promise((resolve) => setTimeout(resolve, pause))
      fire('pointerdown', from.x, from.y, true)
      for (let i = 1; i <= moves; i++) {
        await wait()
        fire('pointermove', from.x + ((to.x - from.x) * i) / moves, from.y + ((to.y - from.y) * i) / moves, true)
      }
      // Hold still before the release: no fling, so one step moves the list by the drag distance.
      await wait()
      await wait()
      fire('pointerup', to.x, to.y, false)
    },
    { from, to, moves: DRAG_MOVES, pause: DRAG_PAUSE_MS, pointerId: DRAG_POINTER_ID },
  )
}

/**
 * `composeScrollUntilVisible` on a given page. `ComposeScreen.scrollUntilVisible` calls it with
 * its own page.
 */
export async function scrollComposeUntilVisible(page: Page, locator: Locator, options: ComposeScrollOptions = {}): Promise<void> {
  const { axis, sign } = scrollPlan(options)
  const maxSteps = options.maxSteps ?? options.maxSwipes ?? 50
  const settleTimeout = options.settleTimeout ?? 500
  const mode = options.mode ?? 'wheel'
  const way = `${describeWay(axis, sign)}, ${mode}`
  const where = options.within ? `in ${options.within}` : 'in the viewport'

  const area = async (): Promise<Box> => {
    if (options.within) {
      const box = await options.within.boundingBox()
      if (!box) throw new Error(`composeScrollUntilVisible: the scrollable ${options.within} is not visible.`)
      return box
    }
    const size = page.viewportSize()
    if (!size) throw new Error('composeScrollUntilVisible: the page has no fixed viewport; pass `within`.')
    return { x: 0, y: 0, ...size }
  }
  // Re-queries the target each time: Compose replaces the nodes of a lazy list as it scrolls.
  const onScreen = async (box: Box): Promise<boolean> => {
    const target = locator.first()
    if (!(await target.isVisible())) return false
    const targetBox = await target.boundingBox()
    return !!targetBox && centerInside(targetBox, box)
  }

  let box = await area()
  if (await onScreen(box)) return
  // A list that loads more items may not move on the first step: confirm the end with a second still step.
  let stillSteps = 0
  for (let n = 1; n <= maxSteps; n++) {
    const size = axis === 'y' ? box.height : box.width
    // A step never exceeds 90% of the scrollable, so no item is skipped between two steps.
    const distance = Math.min(Math.abs(options.step ?? size * 0.8), size * 0.9)
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const before = await snapshot(page, options.within)
    if (mode === 'wheel') {
      await page.mouse.move(cx, cy)
      await page.mouse.wheel(axis === 'x' ? sign * distance : 0, axis === 'y' ? sign * distance : 0)
    } else {
      // The finger moves against the scroll direction. It stays inside the scrollable.
      const half = distance / 2
      const dx = axis === 'x' ? sign * half : 0
      const dy = axis === 'y' ? sign * half : 0
      await touchDrag(page, { x: cx + dx, y: cy + dy }, { x: cx - dx, y: cy - dy })
    }

    // Wait until the target is on screen, or the list moved and stopped, or the time is up.
    const deadline = Date.now() + settleTimeout
    let moved = false
    let last = before
    for (;;) {
      await sleep(POLL_MS)
      box = await area()
      if (await onScreen(box)) return
      const now = await snapshot(page, options.within)
      if (now !== before) moved = true
      if ((moved && now === last) || Date.now() >= deadline) break
      last = now
    }
    if (moved) stillSteps = 0
    else if (++stillSteps < 2) {
      n--
      continue
    }
    if (!moved) {
      throw new Error(
        `composeScrollUntilVisible: ${locator} is not on screen, and the list ${where} did not move on step ${n} (${way}): ` +
          'it is at its end. Check the locator, the `axis` and the sign of `step`' +
          (mode === 'wheel' ? ", or try mode: 'drag' if the app does not scroll on the wheel." : '.'),
      )
    }
  }
  throw new Error(`composeScrollUntilVisible: ${locator} is not on screen after ${maxSteps} steps (${way}) ${where}.`)
}

/**
 * Scrolls a Compose list until the centre of `locator` is inside the scrollable. A `LazyColumn` or
 * `LazyRow` composes only the items near its viewport, so an item further away is not in the
 * accessibility tree, and `scrollIntoViewIfNeeded` cannot reach it.
 *
 * Each step turns the mouse wheel over the centre of `within` (`mode: 'wheel'`), or drags a touch
 * pointer across it (`mode: 'drag'`), on `axis` (`y` or `x`). After each step it queries
 * `locator` again. It throws when the list stops moving (its end) or after `maxSteps` steps.
 *
 * Nested lists: pass the list that scrolls on the axis as `within`. A vertical step over a
 * horizontal `LazyRow` scrolls the vertical list around it.
 */
export async function composeScrollUntilVisible(locator: Locator, options: ComposeScrollOptions = {}): Promise<void> {
  await scrollComposeUntilVisible(locator.page(), locator, options)
}
