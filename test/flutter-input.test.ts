import { describe, expect, it, vi } from 'vitest'
import type { Locator, Page } from '@playwright/test'
import { FlutterScreen, flutterType } from '../src/flutter.js'
import { waitTwoFrames } from '../src/flutter/input.js'

/**
 * A fake Flutter text field. `dropFills` fills are lost (Flutter had not taken the field yet).
 * `wrapped` makes the locator a `Semantics(identifier:)` node with the input inside it.
 */
function fakeField(opts: { dropFills?: number; wrapped?: boolean; focused?: boolean } = {}) {
  let value = ''
  let drops = opts.dropFills ?? 0
  const calls: string[] = []
  const page = {
    evaluate: vi.fn(async () => calls.push('frames')),
    waitForFunction: vi.fn(async (fn: (el: unknown) => boolean, el: unknown, _options: unknown) => {
      calls.push('focus')
      // Runs the focus check in a fake DOM: the element is focused unless `focused: false`.
      const g = globalThis as unknown as { document?: unknown }
      const active = opts.focused === false ? { shadowRoot: null } : el
      g.document = { activeElement: active }
      try {
        if (!fn(el)) throw new Error('Timeout 30000ms exceeded.')
      } finally {
        delete g.document
      }
    }),
  }
  const input = {
    page: () => page,
    click: vi.fn(async () => calls.push('click')),
    elementHandle: vi.fn(async () => ({ contains: () => false })),
    fill: vi.fn(async (text: string) => {
      calls.push('fill')
      if (drops > 0) drops--
      else value = text
    }),
    inputValue: vi.fn(async () => value),
  }
  const wrapper = {
    page: () => page,
    waitFor: vi.fn(async () => undefined),
    evaluate: vi.fn(async (fn: (el: { matches(s: string): boolean }, arg: string) => boolean, arg: string) =>
      fn({ matches: () => !opts.wrapped }, arg),
    ),
    locator: vi.fn(() => ({ first: () => input })),
  }
  // Not wrapped: the locator is the input itself.
  const locator = opts.wrapped ? wrapper : Object.assign(wrapper, input)
  return { locator: locator as unknown as Locator, page, input, wrapper, calls }
}

describe('flutterType', () => {
  it('clicks, waits for the focus and two frames, fills and confirms the value', async () => {
    const { locator, calls } = fakeField()
    await flutterType(locator, 'Ada')
    expect(calls).toEqual(['click', 'focus', 'frames', 'fill', 'frames'])
  })

  it('finds the input inside a Semantics(identifier:) node', async () => {
    const { locator, wrapper, input } = fakeField({ wrapped: true })
    await flutterType(locator, 'Ada')
    expect(wrapper.locator).toHaveBeenCalledWith(expect.stringContaining('input'))
    expect(input.fill).toHaveBeenCalledWith('Ada', { timeout: undefined })
  })

  it('fills again when Flutter dropped the first fill', async () => {
    const { locator, input } = fakeField({ dropFills: 1 })
    await flutterType(locator, 'Ada', { timeout: 500 })
    expect(input.fill).toHaveBeenCalledTimes(2)
  })

  it('throws a clear error when the value never holds', async () => {
    const { locator, input } = fakeField({ dropFills: 5 })
    await expect(flutterType(locator, 'Ada', { attempts: 2 })).rejects.toThrow(
      'flutterType: the field shows "" instead of "Ada" after 2 attempt(s).',
    )
    expect(input.fill).toHaveBeenCalledTimes(2)
  })

  it('waits until the field has the focus', async () => {
    const { locator } = fakeField({ focused: false })
    await expect(flutterType(locator, 'Ada')).rejects.toThrow(/Timeout/)
  })
})

describe('waitTwoFrames', () => {
  it('resolves after two animation frames', async () => {
    const frames: (() => void)[] = []
    const page = {
      evaluate: async (fn: () => Promise<void>) => {
        const g = globalThis as unknown as { requestAnimationFrame?: unknown }
        g.requestAnimationFrame = (cb: () => void) => frames.push(cb)
        try {
          const done = fn()
          frames.shift()?.()
          frames.shift()?.()
          await done
        } finally {
          delete g.requestAnimationFrame
        }
      },
    }
    await waitTwoFrames(page as unknown as Page)
    expect(frames).toEqual([])
  })
})

describe('FlutterScreen.typeText', () => {
  it('delegates to flutterType', async () => {
    const { locator, input, page } = fakeField()
    class Form extends FlutterScreen {
      readonly path = '/'
      async enter(text: string) {
        await this.typeText(locator, text)
      }
    }
    await new Form(page as unknown as Page).enter('Grace')
    expect(input.fill).toHaveBeenCalledWith('Grace', { timeout: undefined })
  })
})
