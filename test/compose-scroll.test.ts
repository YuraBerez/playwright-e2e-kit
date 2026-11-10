import { describe, expect, it, vi } from 'vitest'
import type { Locator, Page } from '@playwright/test'
import { composeScrollUntilVisible } from '../src/compose.js'
import { scrollComposeUntilVisible, scrollPlan } from '../src/compose/scroll.js'

const LIST = { x: 0, y: 100, width: 400, height: 500 }

/**
 * A fake list: `offset` grows with each step (wheel delta or drag distance), up to `end`. The
 * target item is on screen while `offset` is in `[from, to]`.
 */
function fakeList(opts: { from: number; to?: number; end?: number; start?: number; moves?: boolean }) {
  let offset = opts.start ?? 0
  const end = opts.end ?? 10_000
  const scroll = (delta: number) => {
    if (opts.moves === false) return
    offset = Math.max(0, Math.min(end, offset + delta))
  }
  const visible = () => offset >= opts.from && offset <= (opts.to ?? Infinity)
  const mouse = { move: vi.fn(async () => undefined), wheel: vi.fn(async (dx: number, dy: number) => scroll(dx + dy)) }
  const page = {
    mouse,
    viewportSize: () => ({ width: 800, height: 600 }),
    // The drag: the finger goes from `from` to `to`; the list scrolls against it.
    evaluate: vi.fn(async (_fn: unknown, arg: { from: { x: number; y: number }; to: { x: number; y: number } }) =>
      scroll(arg.from.x - arg.to.x + arg.from.y - arg.to.y),
    ),
    locator: vi.fn(() => ({ evaluate: async () => `root@${offset}` })),
  }
  const within = { boundingBox: async () => LIST, evaluate: async () => `list@${offset}`, toString: () => 'list' } as unknown as Locator
  const target = { isVisible: async () => visible(), boundingBox: async () => (visible() ? { x: 10, y: 300, width: 50, height: 20 } : null) }
  const locator = { first: () => target, page: () => page, toString: () => 'item' } as unknown as Locator
  return { page, asPage: page as unknown as Page, within, locator, mouse, offset: () => offset }
}

describe('scrollPlan', () => {
  it('defaults to y, forward', () => {
    expect(scrollPlan({})).toEqual({ axis: 'y', sign: 1 })
  })

  it('takes the axis and the sign of step', () => {
    expect(scrollPlan({ axis: 'x', step: -100 })).toEqual({ axis: 'x', sign: -1 })
  })

  it('maps the shared direction option', () => {
    expect(scrollPlan({ direction: 'up' })).toEqual({ axis: 'y', sign: -1 })
    expect(scrollPlan({ direction: 'right' })).toEqual({ axis: 'x', sign: 1 })
  })

  it('refuses options that contradict each other', () => {
    expect(() => scrollPlan({ direction: 'up', axis: 'x' })).toThrow(/does not match/)
    expect(() => scrollPlan({ direction: 'up', step: -10 })).toThrow(/ambiguous/)
    expect(() => scrollPlan({ step: 0 })).toThrow(/must not be 0/)
  })
})

describe('composeScrollUntilVisible', () => {
  it('returns at once when the item is on screen', async () => {
    const f = fakeList({ from: 0 })
    await composeScrollUntilVisible(f.locator, { within: f.within })
    expect(f.mouse.wheel).not.toHaveBeenCalled()
  })

  it('wheels over the centre of within by 80% of its height until the item shows', async () => {
    const f = fakeList({ from: 1000 })
    await composeScrollUntilVisible(f.locator, { within: f.within })
    expect(f.mouse.move).toHaveBeenCalledWith(200, 350)
    expect(f.mouse.wheel).toHaveBeenCalledWith(0, 400)
    expect(f.mouse.wheel).toHaveBeenCalledTimes(3)
  })

  it('wheels on x with a negative step', async () => {
    const f = fakeList({ from: 0, to: 100, start: 1000 })
    await composeScrollUntilVisible(f.locator, { within: f.within, axis: 'x', step: -300 })
    expect(f.mouse.wheel).toHaveBeenCalledWith(-300, 0)
  })

  it('drags a touch pointer against the scroll direction in drag mode', async () => {
    const f = fakeList({ from: 600 })
    await composeScrollUntilVisible(f.locator, { within: f.within, mode: 'drag', step: 300 })
    expect(f.mouse.wheel).not.toHaveBeenCalled()
    const arg = f.page.evaluate.mock.calls[0]![1]
    expect(arg.from).toEqual({ x: 200, y: 500 })
    expect(arg.to).toEqual({ x: 200, y: 200 })
  })

  it('keeps a drag inside the scrollable', async () => {
    const f = fakeList({ from: 100 })
    await composeScrollUntilVisible(f.locator, { within: f.within, mode: 'drag', step: 5000 })
    const arg = f.page.evaluate.mock.calls[0]![1]
    expect(arg.from.y - arg.to.y).toBe(450)
  })

  it('stops with a clear error when the list does not move any more', async () => {
    const f = fakeList({ from: 99_999, end: 900 })
    const error = await composeScrollUntilVisible(f.locator, { within: f.within, settleTimeout: 200 }).catch((e: Error) => e)
    expect(String(error)).toMatch(/item is not on screen, and the list in list did not move on step 4 \(down, wheel\): it is at its end\..*mode: 'drag'/)
  })

  it('does not call the end after one still step (a lazy list that loads more)', async () => {
    // The first wheel is lost while the list loads; the repeat scrolls.
    const g = fakeList({ from: 300 })
    const real = g.mouse.wheel.getMockImplementation()!
    let n = 0
    g.mouse.wheel.mockImplementation(async (dx: number, dy: number) => {
      if (++n > 1) await real(dx, dy)
    })
    await composeScrollUntilVisible(g.locator, { within: g.within, settleTimeout: 100 })
    expect(n).toBe(2)
  })

  it('caps a wheel step at 90% of the scrollable', async () => {
    const f = fakeList({ from: 1000 })
    await composeScrollUntilVisible(f.locator, { within: f.within, step: 5000 })
    expect(f.mouse.wheel.mock.calls[0]![1]).toBe(450)
  })

  it('suggests no other mode when a drag reaches the end', async () => {
    const f = fakeList({ from: 99_999, moves: false })
    const error = await composeScrollUntilVisible(f.locator, { within: f.within, mode: 'drag', settleTimeout: 100 }).catch((e: Error) => e)
    expect(String(error)).toMatch(/did not move on step 1 \(down, drag\)/)
    expect(String(error)).not.toMatch(/mode: 'drag'/)
  })

  it('gives up after maxSteps (or the shared maxSwipes)', async () => {
    const f = fakeList({ from: 99_999 })
    await expect(composeScrollUntilVisible(f.locator, { within: f.within, maxSteps: 2 })).rejects.toThrow(
      'composeScrollUntilVisible: item is not on screen after 2 steps (down, wheel) in list.',
    )
    const g = fakeList({ from: 99_999 })
    await expect(composeScrollUntilVisible(g.locator, { within: g.within, maxSwipes: 1, direction: 'down' })).rejects.toThrow(/after 1 steps/)
  })

  it('uses the viewport and the whole tree without within', async () => {
    const f = fakeList({ from: 400 })
    await scrollComposeUntilVisible(f.asPage, f.locator)
    expect(f.mouse.move).toHaveBeenCalledWith(400, 300)
    expect(f.page.locator).toHaveBeenCalledWith('#cmp_a11y_root')
  })

  it('tells when within is not visible or the page has no viewport', async () => {
    const f = fakeList({ from: 400 })
    const hidden = { boundingBox: async () => null, toString: () => 'list' } as unknown as Locator
    await expect(composeScrollUntilVisible(f.locator, { within: hidden })).rejects.toThrow(/the scrollable list is not visible/)
    const noViewport = { ...f.page, viewportSize: () => null } as unknown as Page
    await expect(scrollComposeUntilVisible(noViewport, f.locator)).rejects.toThrow(/no fixed viewport/)
  })
})
