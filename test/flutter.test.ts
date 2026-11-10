import { describe, expect, it, vi } from 'vitest'
import type { BrowserContext, Locator, Page } from '@playwright/test'
import { getAppReady, setAppReady } from '../src/core/app-ready.js'
import { baseConfig } from '../src/core/config.js'
import { resolveOption } from './option-helper.js'
import {
  FLUTTER_FIRST_FRAME_FLAG,
  FLUTTER_TEST_ID_ATTRIBUTE,
  FlutterScreen,
  enableFlutterSemantics,
  flutterConfig,
  flutterFixture,
  flutterReady,
  flutterReadyWith,
  installFlutterFirstFrameListener,
  scrollUntilVisible,
} from '../src/flutter.js'

type Win = Record<string, unknown> & { addEventListener: (type: string, cb: () => void) => void }

/** A fake page whose `evaluate` / `waitForFunction` run the callbacks against a fake `window`. */
function fakePage(opts: { semantics?: number; placeholder?: number; treeAppears?: boolean } = {}) {
  const win: Win = { addEventListener: vi.fn() }
  const counts: Record<string, number> = {
    'flt-semantics': opts.semantics ?? 0,
    'flt-semantics-placeholder': opts.placeholder ?? 0,
  }
  const dispatchEvent = vi.fn(async () => undefined)
  const waitFor = vi.fn(async () => {
    if (opts.treeAppears === false) throw new Error('Timeout 30000ms exceeded.')
  })
  const run = <A, R>(fn: (arg: A) => R, arg: A): R => {
    const g = globalThis as unknown as { window?: unknown }
    g.window = win
    try {
      return fn(arg)
    } finally {
      delete g.window
    }
  }
  const page = {
    win,
    dispatchEvent,
    waitFor,
    addInitScript: vi.fn(async <A>(fn: (arg: A) => void, arg: A) => run(fn, arg)),
    evaluate: vi.fn(async <A, R>(fn: (arg: A) => R, arg: A) => run(fn, arg)),
    waitForFunction: vi.fn(async <A>(fn: (arg: A) => boolean, arg: A) => {
      if (!run(fn, arg)) throw new Error('Timeout 30000ms exceeded.')
    }),
    locator: vi.fn((selector: string) => ({
      count: async () => counts[selector] ?? 0,
      dispatchEvent,
      first: () => ({ waitFor }),
    })),
    goto: vi.fn(async () => null),
    reload: vi.fn(async () => null),
  }
  return page
}
const asPage = (p: unknown) => p as Page

describe('first-frame listener', () => {
  it('installs once per target and records the event in a window flag', async () => {
    const page = fakePage()
    await installFlutterFirstFrameListener(asPage(page))
    await installFlutterFirstFrameListener(asPage(page))
    expect(page.addInitScript).toHaveBeenCalledOnce()
    expect(page.win[FLUTTER_FIRST_FRAME_FLAG]).toBe(false)
    const [type, onFrame] = (page.win.addEventListener as ReturnType<typeof vi.fn>).mock.calls[0] as [string, () => void]
    expect(type).toBe('flutter-first-frame')
    onFrame()
    expect(page.win[FLUTTER_FIRST_FRAME_FLAG]).toBe(true)
  })

  it('the init script is idempotent inside one document', async () => {
    const page = fakePage()
    await installFlutterFirstFrameListener(asPage(page))
    const script = (page.addInitScript.mock.calls[0] as unknown as [(flag: string) => void])[0]
    page.win[FLUTTER_FIRST_FRAME_FLAG] = true
    const g = globalThis as unknown as { window?: unknown }
    g.window = page.win
    script(FLUTTER_FIRST_FRAME_FLAG)
    delete g.window
    expect(page.win[FLUTTER_FIRST_FRAME_FLAG]).toBe(true)
    expect(page.win.addEventListener).toHaveBeenCalledOnce()
  })
})

describe('flutterReady', () => {
  it('fails at once with a clear error when the listener was not installed', async () => {
    const page = fakePage({ semantics: 1 })
    await expect(flutterReady(asPage(page))).rejects.toThrow(/listener is not installed.*flutterFixture/)
    expect(page.waitForFunction).not.toHaveBeenCalled()
  })

  it('does not wait when the first frame was already recorded', async () => {
    const page = fakePage({ semantics: 3 })
    page.win[FLUTTER_FIRST_FRAME_FLAG] = true
    await flutterReady(asPage(page))
    expect(page.waitForFunction).not.toHaveBeenCalled()
    expect(page.dispatchEvent).not.toHaveBeenCalled()
  })

  it('waits for the first frame, then enables semantics', async () => {
    const page = fakePage({ placeholder: 1 })
    page.win[FLUTTER_FIRST_FRAME_FLAG] = false
    page.waitForFunction.mockImplementationOnce(async () => {
      page.win[FLUTTER_FIRST_FRAME_FLAG] = true
    })
    await flutterReadyWith({ timeout: 1234 })(asPage(page))
    expect(page.waitForFunction).toHaveBeenCalledWith(expect.any(Function), FLUTTER_FIRST_FRAME_FLAG, { timeout: 1234 })
    expect(page.dispatchEvent).toHaveBeenCalledWith('click')
    expect(page.waitFor).toHaveBeenCalledWith({ state: 'attached', timeout: 1234 })
  })

  it('wraps a first-frame timeout in a clear error', async () => {
    const page = fakePage()
    page.win[FLUTTER_FIRST_FRAME_FLAG] = false
    const error = await flutterReady(asPage(page), { timeout: 50 }).catch((e: Error) => e)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toMatch(/no flutter-first-frame event within 50 ms/)
    expect((error as Error).cause).toBeInstanceOf(Error)
  })
})

describe('enableFlutterSemantics', () => {
  it('is a no-op when the tree is already there', async () => {
    const page = fakePage({ semantics: 1, placeholder: 1 })
    await enableFlutterSemantics(asPage(page))
    expect(page.dispatchEvent).not.toHaveBeenCalled()
    expect(page.waitFor).not.toHaveBeenCalled()
  })

  it('without a placeholder only waits for the tree (ensureSemantics pending)', async () => {
    const page = fakePage()
    await enableFlutterSemantics(asPage(page))
    expect(page.dispatchEvent).not.toHaveBeenCalled()
    expect(page.waitFor).toHaveBeenCalledOnce()
  })

  it('reports a missing tree clearly', async () => {
    const page = fakePage({ placeholder: 1, treeAppears: false })
    await expect(enableFlutterSemantics(asPage(page))).rejects.toThrow(
      /semantics tree \(flt-semantics\) did not appear within the default timeout.*ensureSemantics/,
    )
  })
})

describe('flutterFixture', () => {
  it('defaults appReady to flutterReady and keeps the page override', async () => {
    const f = flutterFixture()
    expect(f.appReady[1]).toEqual({ option: true })
    // Wrapped: a bare function default would be run by Playwright as the fixture function.
    expect(typeof f.appReady[0]).toBe('function')
    expect(f.appReady[0]).not.toBe(flutterReady)
    expect(await resolveOption(f.appReady[0])).toBe(flutterReady)
    const p = asPage({})
    await f.page({ page: p, appReady: flutterReady }, async () => {
      expect(getAppReady(p)).toBe(flutterReady)
    })
  })

  it('installs the listener on the context before the test uses it', async () => {
    const context = { addInitScript: vi.fn(async () => undefined) }
    const used = vi.fn(async () => {
      expect(context.addInitScript).toHaveBeenCalledOnce()
    })
    await flutterFixture().context({ context: context as unknown as BrowserContext }, used)
    expect(used).toHaveBeenCalledWith(context)
  })

  it('keeps the destructured first arguments Playwright requires', () => {
    const f = flutterFixture()
    expect(f.context.toString()).toMatch(/^async \(\{/)
    expect(f.page.toString()).toMatch(/^async \(\{/)
  })
})

describe('flutterConfig', () => {
  it('sets the Flutter test id attribute and flutterReady', async () => {
    const use = flutterConfig({ use: { baseURL: 'http://localhost:1' } }).use as Record<string, unknown>
    expect(use.testIdAttribute).toBe(FLUTTER_TEST_ID_ATTRIBUTE)
    expect(await resolveOption(use.appReady)).toBe(flutterReady)
    expect(use.baseURL).toBe('http://localhost:1')
  })

  it('lets the app override both', async () => {
    const hook = async () => undefined
    const use = flutterConfig({ use: { testIdAttribute: 'data-qa' } }, { appReady: hook }).use as Record<string, unknown>
    expect(use.testIdAttribute).toBe('data-qa')
    expect(await resolveOption(use.appReady)).toBe(hook)
  })

  it('does not change the kit defaults for other apps', () => {
    expect(baseConfig().use).not.toHaveProperty('testIdAttribute')
    expect(baseConfig().use).not.toHaveProperty('appReady')
  })
})

type Box = { x: number; y: number; width: number; height: number }

/** A list item that becomes visible at `box` after `appearsAfter` wheel steps. */
function scrollPage(appearsAfter: number, opts: { box?: Box; viewport?: { width: number; height: number } | null } = {}) {
  let wheels = 0
  const visible = () => wheels >= appearsAfter
  const item = {
    isVisible: vi.fn(async () => visible()),
    waitFor: vi.fn(async () => {
      if (!visible()) throw new Error('Timeout')
    }),
    boundingBox: vi.fn(async () => (visible() ? (opts.box ?? { x: 10, y: 100, width: 100, height: 40 }) : null)),
  }
  const locator = { first: () => item, toString: () => "getByTestId('row-42')" } as unknown as Locator
  const list = { boundingBox: vi.fn(async () => ({ x: 0, y: 50, width: 400, height: 500 })), toString: () => "getByTestId('list')" }
  const mouse = { move: vi.fn(async () => undefined), wheel: vi.fn(async () => void wheels++) }
  const page = asPage({ mouse, viewportSize: () => (opts.viewport === undefined ? { width: 800, height: 600 } : opts.viewport) })
  return { page, locator, list: list as unknown as Locator, listMock: list, mouse, item }
}

describe('scrollUntilVisible', () => {
  it('does not scroll when the item is already on screen', async () => {
    const s = scrollPage(0)
    await scrollUntilVisible(s.page, s.locator, { within: s.list })
    expect(s.mouse.wheel).not.toHaveBeenCalled()
    expect(s.item.waitFor).not.toHaveBeenCalled()
  })

  it('turns the wheel over the centre of the scrollable until the item shows', async () => {
    const s = scrollPage(3)
    await scrollUntilVisible(s.page, s.locator, { within: s.list, settleTimeout: 7 })
    expect(s.mouse.wheel).toHaveBeenCalledTimes(3)
    expect(s.mouse.move).toHaveBeenCalledWith(200, 300)
    expect(s.mouse.wheel).toHaveBeenCalledWith(0, 400)
    expect(s.item.waitFor).toHaveBeenLastCalledWith({ state: 'visible', timeout: 7 })
  })

  it('scrolls up and sideways with the sign of the direction', async () => {
    const up = scrollPage(1)
    await scrollUntilVisible(up.page, up.locator, { within: up.list, direction: 'up' })
    expect(up.mouse.wheel).toHaveBeenCalledWith(0, -400)
    const left = scrollPage(1)
    await scrollUntilVisible(left.page, left.locator, { within: left.list, direction: 'left' })
    expect(left.mouse.wheel).toHaveBeenCalledWith(-320, 0)
  })

  it('uses the viewport when no scrollable is given', async () => {
    const s = scrollPage(1)
    await scrollUntilVisible(s.page, s.locator)
    expect(s.mouse.move).toHaveBeenCalledWith(400, 300)
    expect(s.mouse.wheel).toHaveBeenCalledWith(0, 480)
  })

  it('does not count an item outside the scrollable (cache extent) as on screen', async () => {
    const s = scrollPage(0, { box: { x: 10, y: 900, width: 100, height: 40 } })
    await expect(scrollUntilVisible(s.page, s.locator, { within: s.list, maxSwipes: 2 })).rejects.toThrow(
      "scrollUntilVisible: getByTestId('row-42') is not on screen after 2 swipes down.",
    )
    expect(s.mouse.wheel).toHaveBeenCalledTimes(2)
  })

  it('throws clearly when the scrollable is hidden or there is no viewport', async () => {
    const s = scrollPage(5)
    s.listMock.boundingBox.mockResolvedValueOnce(null as never)
    await expect(scrollUntilVisible(s.page, s.locator, { within: s.list })).rejects.toThrow(/getByTestId\('list'\) is not visible/)
    const n = scrollPage(5, { viewport: null })
    await expect(scrollUntilVisible(n.page, n.locator)).rejects.toThrow(/no fixed viewport; pass `within`/)
  })
})

describe('FlutterScreen', () => {
  class ListScreen extends FlutterScreen {
    readonly path = '/list'
    async showRow(locator: Locator): Promise<void> {
      await this.scrollUntilVisible(locator, { maxSwipes: 1 })
    }
  }

  it('installs the listener before goto and waits with flutterReady by default', async () => {
    const page = fakePage({ semantics: 1 })
    const order: string[] = []
    page.addInitScript.mockImplementation(async () => void order.push('init'))
    page.goto.mockImplementation(async () => {
      order.push('goto')
      page.win[FLUTTER_FIRST_FRAME_FLAG] = true
      return null
    })
    page.evaluate.mockImplementation((async () => {
      order.push('ready')
      return page.win[FLUTTER_FIRST_FRAME_FLAG]
    }) as never)
    const screen = new ListScreen(asPage(page))
    await screen.open()
    await screen.reload()
    expect(order).toEqual(['init', 'goto', 'ready', 'ready'])
  })

  it('uses the page hook when one is set', async () => {
    const page = fakePage()
    const hook = vi.fn(async () => undefined)
    setAppReady(asPage(page), hook)
    await new ListScreen(asPage(page)).open()
    expect(hook).toHaveBeenCalledOnce()
    expect(page.evaluate).not.toHaveBeenCalled()
  })

  it('exposes scrollUntilVisible to subclasses', async () => {
    const s = scrollPage(1)
    await new ListScreen(s.page).showRow(s.locator)
    expect(s.mouse.wheel).toHaveBeenCalledOnce()
  })
})
