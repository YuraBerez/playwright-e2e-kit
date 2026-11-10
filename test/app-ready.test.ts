import { describe, expect, it, vi } from 'vitest'
import type { Page } from '@playwright/test'
import { angularReady, appReadyOption, domContentReady, getAppReady, nuxtReady, setAppReady } from '../src/core/app-ready.js'
import { appReadyFixture } from '../src/core/fixtures.js'
import { baseConfig, defineE2EConfig } from '../src/core/config.js'
import { resolveOption } from './option-helper.js'

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

  it('angularReady waits for stable testabilities, else for the ng-version root', async () => {
    const waitForFunction = vi.fn(async () => undefined)
    await angularReady({ waitForFunction } as unknown as Page)
    const fn = (waitForFunction.mock.calls[0] as unknown as [() => boolean])[0]
    const g = globalThis as unknown as { window?: unknown; document?: unknown }
    const doc = (root: boolean) => ({ querySelector: (s: string) => (root && s === '[ng-version]' ? {} : null) })
    // Zoneless production build: no testabilities, the bootstrapped root has ng-version.
    g.window = {}
    g.document = doc(false)
    expect(fn()).toBe(false)
    g.document = doc(true)
    expect(fn()).toBe(true)
    // An empty testability list falls back to ng-version too.
    g.window = { getAllAngularTestabilities: () => [] }
    expect(fn()).toBe(true)
    // With testabilities, every one must be stable (ng-version alone is not enough).
    g.window = { getAllAngularTestabilities: () => [{ isStable: () => true }, { isStable: () => false }] }
    expect(fn()).toBe(false)
    g.window = { getAllAngularTestabilities: () => [{ isStable: () => true }, { isStable: () => true }] }
    g.document = doc(false)
    expect(fn()).toBe(true)
    delete g.window
    delete g.document
  })
})

describe('appReadyOption', () => {
  it('is a fixture function that provides the hook', async () => {
    const hook = vi.fn(async () => undefined)
    expect(await resolveOption(appReadyOption(hook))).toBe(hook)
    expect(await resolveOption(appReadyOption(undefined))).toBeUndefined()
  })

  it('keeps the destructured first argument Playwright requires', () => {
    expect(appReadyOption(nuxtReady).toString()).toMatch(/^async \(\{/)
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

  it('sets the option in use, wrapped as a fixture, and a preset can pass it through defineE2EConfig', async () => {
    const hook = async () => undefined
    const base = (baseConfig({ appReady: hook }).use as Record<string, unknown>).appReady
    const defined = (defineE2EConfig({}, { appReady: hook }).use as Record<string, unknown>).appReady
    // A bare function in `use` would be called by Playwright as a fixture function.
    expect(base).not.toBe(hook)
    expect(await resolveOption(base)).toBe(hook)
    expect(await resolveOption(defined)).toBe(hook)
  })
})
