import { describe, expect, it, vi } from 'vitest'
import type { Locator, Page } from '@playwright/test'
import { getAppReady, setAppReady, type AppReady } from '../src/app-ready.js'
import { baseConfig } from '../src/config.js'
import { isAllowed, type CollectedError } from '../src/error-guard.js'
import {
  COMPOSE_A11Y_ROOT,
  COMPOSE_BACKING_FIELD_CLASS,
  COMPOSE_TEST_ID_ATTRIBUTE,
  ComposeScreen,
  composeConfig,
  composeErrorAllowList,
  composeFixture,
  composeReady,
  composeReadyWith,
  composeTap,
  composeType,
  scrollUntilVisible,
} from '../src/compose.js'
import { scrollUntilVisible as flutterScrollUntilVisible } from '../src/flutter.js'
import { resolveOption } from './option-helper.js'

const asPage = (p: unknown) => p as Page

/** A fake page: `#cmp_a11y_root` exists (`root`) and gets its first node (`nodes`) or not. */
function fakePage(opts: { root?: boolean; nodes?: boolean } = {}) {
  const waitFor = vi.fn(async () => {
    if (opts.nodes === false) throw new Error('Timeout 30000ms exceeded.')
  })
  const page = {
    waitFor,
    locator: vi.fn((selector: string) => ({
      count: async () => (selector === COMPOSE_A11Y_ROOT && opts.root !== false ? 1 : 0),
      first: () => ({ waitFor }),
    })),
    goto: vi.fn(async () => null),
    reload: vi.fn(async () => null),
  }
  return page
}

describe('composeReady', () => {
  it('waits for the first node of the accessibility tree', async () => {
    const page = fakePage()
    await composeReady(asPage(page))
    expect(page.locator).toHaveBeenCalledWith('#cmp_a11y_root > *')
    expect(page.waitFor).toHaveBeenCalledWith({ state: 'attached', timeout: undefined })
  })

  it('passes the timeout of composeReadyWith', async () => {
    const page = fakePage()
    await composeReadyWith({ timeout: 1234 })(asPage(page))
    expect(page.waitFor).toHaveBeenCalledWith({ state: 'attached', timeout: 1234 })
  })

  it('tells when the root is there but the first composition did not finish', async () => {
    const error = await composeReady(asPage(fakePage({ nodes: false })), { timeout: 50 }).catch((e: Error) => e)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toMatch(/did not get a node within 50 ms\. #cmp_a11y_root is there but has no nodes/)
    expect((error as Error).cause).toBeInstanceOf(Error)
  })

  it('tells when there is no Compose accessibility root at all', async () => {
    await expect(composeReady(asPage(fakePage({ root: false, nodes: false })))).rejects.toThrow(
      /within the default timeout\. There is no #cmp_a11y_root: .*isA11YEnabled = false/,
    )
  })
})

/** A fake locator on a fake page that records the input calls in order. */
function inputTarget(opts: { focused?: boolean } = {}) {
  const calls: string[] = []
  const page = {
    keyboard: {
      press: vi.fn(async (key: string) => void calls.push(`press ${key}`)),
      type: vi.fn(async (text: string) => void calls.push(`type ${text}`)),
    },
    waitForFunction: vi.fn(async (fn: (cls: string) => boolean, cls: string, options: { timeout?: number }) => {
      calls.push(`focus ${cls} ${options.timeout}`)
      if (opts.focused === false) throw new Error('Timeout')
      return fn
    }),
  }
  const locator = {
    page: () => page,
    waitFor: vi.fn(async (o: { state: string; timeout?: number }) => void calls.push(`wait ${o.state} ${o.timeout}`)),
    click: vi.fn(async (o: { force?: boolean; timeout?: number }) => void calls.push(`click force=${o.force} ${o.timeout}`)),
  }
  return { calls, page, locator: locator as unknown as Locator }
}

describe('composeTap', () => {
  it('waits until the node is visible, then clicks through the canvas with force', async () => {
    const t = inputTarget()
    await composeTap(t.locator)
    expect(t.calls).toEqual(['wait visible undefined', 'click force=true undefined'])
  })

  it('passes what is left of the timeout to each wait', async () => {
    const t = inputTarget()
    await composeTap(t.locator, { timeout: 10_000 })
    const [wait, click] = t.calls.map((c) => Number(c.split(' ').at(-1)))
    expect(wait).toBeGreaterThan(9_000)
    expect(click).toBeLessThanOrEqual(10_000)
  })

  it('tries again when the node was hidden or replaced before the click', async () => {
    const t = inputTarget()
    const click = (t.locator as unknown as { click: ReturnType<typeof vi.fn> }).click
    click.mockRejectedValueOnce(new Error('locator.click: Element is not visible'))
    click.mockRejectedValueOnce(new Error('locator.click: Element is not attached to the DOM'))
    await composeTap(t.locator)
    expect(click).toHaveBeenCalledTimes(3)
  })

  it('rethrows other errors at once and gives up after 5 attempts', async () => {
    const t = inputTarget()
    const click = (t.locator as unknown as { click: ReturnType<typeof vi.fn> }).click
    click.mockRejectedValueOnce(new Error('Timeout 30000ms exceeded.'))
    await expect(composeTap(t.locator)).rejects.toThrow('Timeout')
    expect(click).toHaveBeenCalledTimes(1)

    click.mockClear()
    click.mockRejectedValue(new Error('Element is not visible'))
    await expect(composeTap(t.locator)).rejects.toThrow('not visible')
    expect(click).toHaveBeenCalledTimes(5)
  })
})

describe('composeType', () => {
  it('taps, waits for the backing field, clears it and types', async () => {
    const t = inputTarget()
    await composeType(t.locator, 'a@b.c')
    expect(t.calls).toEqual([
      'wait visible undefined',
      'click force=true undefined',
      `focus ${COMPOSE_BACKING_FIELD_CLASS} undefined`,
      'press ControlOrMeta+A',
      'press Backspace',
      'type a@b.c',
    ])
  })

  it('keeps the current text with clear: false', async () => {
    const t = inputTarget()
    await composeType(t.locator, '!', { clear: false })
    expect(t.calls).toEqual([
      'wait visible undefined',
      'click force=true undefined',
      `focus ${COMPOSE_BACKING_FIELD_CLASS} undefined`,
      'type !',
    ])
  })

  it('does not type when the field never takes the focus', async () => {
    const t = inputTarget({ focused: false })
    await expect(composeType(t.locator, 'x')).rejects.toThrow('Timeout')
    expect(t.page.keyboard.type).not.toHaveBeenCalled()
  })

  it('finds the focused backing field through nested shadow roots', async () => {
    const t = inputTarget()
    await composeType(t.locator, 'x')
    const predicate = t.page.waitForFunction.mock.calls[0]![0]
    const field = { classList: { contains: (c: string) => c === COMPOSE_BACKING_FIELD_CLASS } }
    const host = { shadowRoot: { activeElement: field }, classList: { contains: () => false } }
    const g = globalThis as unknown as { document?: unknown }
    try {
      g.document = { activeElement: host }
      expect(predicate(COMPOSE_BACKING_FIELD_CLASS)).toBe(true)
      g.document = { activeElement: { classList: { contains: () => false } } }
      expect(predicate(COMPOSE_BACKING_FIELD_CLASS)).toBe(false)
      g.document = { activeElement: null }
      expect(predicate(COMPOSE_BACKING_FIELD_CLASS)).toBe(false)
    } finally {
      delete g.document
    }
  })
})

describe('composeFixture', () => {
  it('defaults appReady to composeReady, wrapped as a fixture function', async () => {
    const [option, meta] = composeFixture().appReady
    expect(meta).toEqual({ option: true })
    expect(option).not.toBe(composeReady)
    expect(await resolveOption(option)).toBe(composeReady)
  })

  it('keeps the destructured first arguments Playwright requires', () => {
    const f = composeFixture()
    expect(f.appReady[0]!.toString()).toMatch(/^async \(\{/)
    expect(f.page.toString()).toMatch(/^async \(\{/)
  })

  it('registers the hook on the page for the screens', async () => {
    const p = asPage({})
    await composeFixture().page({ page: p, appReady: composeReady }, async () => {
      expect(getAppReady(p)).toBe(composeReady)
    })
  })
})

describe('composeConfig', () => {
  const use = (c: ReturnType<typeof composeConfig>) => c.use as Record<string, unknown>

  it('sets the Compose test id attribute and composeReady', async () => {
    const u = use(composeConfig({ use: { baseURL: 'http://localhost:1' } }))
    expect(COMPOSE_TEST_ID_ATTRIBUTE).toBe('id')
    expect(u.testIdAttribute).toBe('id')
    expect(u.baseURL).toBe('http://localhost:1')
    expect(await resolveOption(u.appReady)).toBe(composeReady)
  })

  it('lets the app override the attribute, the hook and the other options', async () => {
    const hook: AppReady = async () => undefined
    const u = use(composeConfig({ use: { testIdAttribute: 'data-qa' } }, { appReady: hook, ci: true }))
    expect(u.testIdAttribute).toBe('data-qa')
    expect(await resolveOption(u.appReady)).toBe(hook)
    expect(composeConfig({}, { ci: true }).retries).toBe(1)
  })

  it('does not change the kit defaults for other apps', () => {
    expect(baseConfig().use).not.toHaveProperty('testIdAttribute')
    expect(baseConfig().use).not.toHaveProperty('appReady')
  })
})

describe('composeErrorAllowList', () => {
  const err = (kind: CollectedError['kind'], text: string): CollectedError => ({ kind, text, url: 'http://localhost/app.js' })
  const webgl = 'WebGL: INVALID_ENUM: getParameter: invalid parameter name, WEBGL_debug_renderer_info not enabled'

  it('documents every entry with a reason', () => {
    for (const e of composeErrorAllowList) expect(e.reason.length).toBeGreaterThan(20)
  })

  it('allows the WebKit WebGL debug-info console error and stays narrow', () => {
    expect(isAllowed(err('console', webgl), composeErrorAllowList)).toBe(true)
    expect(isAllowed(err('pageerror', webgl), composeErrorAllowList)).toBe(false)
    expect(isAllowed(err('console', 'WebGL: CONTEXT_LOST_WEBGL: loseContext: context lost'), composeErrorAllowList)).toBe(false)
    expect(isAllowed(err('console', `Uncaught Error: ${webgl}`), composeErrorAllowList)).toBe(false)
  })
})

describe('ComposeScreen', () => {
  class FormScreen extends ComposeScreen {
    readonly path = '/form'
    async submit(locator: Locator): Promise<void> {
      await this.tap(locator)
    }
    async enter(locator: Locator, text: string): Promise<void> {
      await this.typeText(locator, text, { clear: false })
    }
    async show(locator: Locator): Promise<void> {
      await this.scrollUntilVisible(locator, { maxSwipes: 1 })
    }
  }

  it('waits with composeReady after goto and reload by default', async () => {
    const page = fakePage()
    const screen = new FormScreen(asPage(page))
    await screen.open()
    await screen.reload()
    expect(page.goto).toHaveBeenCalledWith('/form')
    expect(page.waitFor).toHaveBeenCalledTimes(2)
  })

  it('uses the page hook when one is set', async () => {
    const page = fakePage()
    const hook = vi.fn(async () => undefined)
    setAppReady(asPage(page), hook)
    await new FormScreen(asPage(page)).open()
    expect(hook).toHaveBeenCalledOnce()
    expect(page.waitFor).not.toHaveBeenCalled()
  })

  it('exposes tap, typeText and scrollUntilVisible to subclasses', async () => {
    const t = inputTarget()
    const screen = new FormScreen(t.page as unknown as Page)
    await screen.submit(t.locator)
    await screen.enter(t.locator, 'hi')
    expect(t.calls.filter((c) => c.startsWith('click'))).toHaveLength(2)
    expect(t.calls.at(-1)).toBe('type hi')

    const item = { isVisible: async () => true, boundingBox: async () => ({ x: 10, y: 10, width: 10, height: 10 }) }
    const mouse = { move: vi.fn(), wheel: vi.fn() }
    const listPage = asPage({ mouse, viewportSize: () => ({ width: 800, height: 600 }) })
    await new FormScreen(listPage).show({ first: () => item } as unknown as Locator)
    expect(mouse.wheel).not.toHaveBeenCalled()
  })

  it('shares scrollUntilVisible with the Flutter entry point', () => {
    expect(scrollUntilVisible).toBe(flutterScrollUntilVisible)
  })
})
