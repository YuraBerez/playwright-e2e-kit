import { describe, expect, it, vi } from 'vitest'
import type { Page } from '@playwright/test'
import { domContentReady, getAppReady, nuxtReady, setAppReady } from '../src/app-ready.js'
import { appReadyFixture } from '../src/fixtures.js'
import { baseConfig, defineE2EConfig } from '../src/config.js'

const page = () => ({}) as unknown as Page

describe('registry', () => {
  it('stores, returns and removes a hook per page', () => {
    const a = page()
    const b = page()
    const hook = vi.fn(async () => undefined)
    expect(getAppReady(a)).toBeUndefined()
    setAppReady(a, hook)
    expect(getAppReady(a)).toBe(hook)
    expect(getAppReady(b)).toBeUndefined()
    setAppReady(a, undefined)
    expect(getAppReady(a)).toBeUndefined()
  })
})

describe('helpers', () => {
  it('domContentReady waits for domcontentloaded, not networkidle', async () => {
    const waitForLoadState = vi.fn(async () => undefined)
    await domContentReady({ waitForLoadState } as unknown as Page)
    expect(waitForLoadState).toHaveBeenCalledWith('domcontentloaded')
  })

  it('nuxtReady waits for a hydrated Nuxt app', async () => {
    const waitForFunction = vi.fn(async () => undefined)
    await nuxtReady({ waitForFunction } as unknown as Page)
    const fn = (waitForFunction.mock.calls[0] as unknown as [() => boolean])[0]
    const g = globalThis as unknown as { window?: unknown }
    g.window = {}
    expect(fn()).toBe(false)
    g.window = { useNuxtApp: () => ({ isHydrating: true }) }
    expect(fn()).toBe(false)
    g.window = { useNuxtApp: () => ({ isHydrating: false }) }
    expect(fn()).toBe(true)
    delete g.window
  })
})

describe('appReadyFixture', () => {
  it('declares an option and registers it for the page', async () => {
    const f = appReadyFixture()
    expect(f.appReady).toEqual([undefined, { option: true }])
    const p = page()
    const hook = vi.fn(async () => undefined)
    await f.page({ page: p, appReady: hook }, async () => {
      expect(getAppReady(p)).toBe(hook)
    })
  })

  it('keeps the destructured first argument Playwright requires', () => {
    expect(appReadyFixture().page.toString()).toMatch(/^async \(\{/)
  })
})

describe('config', () => {
  it('sets no appReady by default', () => {
    expect(baseConfig().use).not.toHaveProperty('appReady')
  })

  it('sets the option in use, and a preset can pass it through defineE2EConfig', () => {
    const hook = async () => undefined
    expect((baseConfig({ appReady: hook }).use as Record<string, unknown>).appReady).toBe(hook)
    expect((defineE2EConfig({}, { appReady: hook }).use as Record<string, unknown>).appReady).toBe(hook)
  })
})
