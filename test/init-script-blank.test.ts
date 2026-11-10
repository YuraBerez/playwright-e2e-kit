import { chromium, type Browser } from '@playwright/test'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CSP_VIOLATION_SCRIPT } from '../src/core/error-guard.js'
import { installFlutterFirstFrameListener, FLUTTER_FIRST_FRAME_FLAG } from '../src/flutter/ready.js'

// Real browser: init scripts run in about:blank, where localStorage / sessionStorage throw.
let browser: Browser
beforeAll(async () => {
  browser = await chromium.launch()
})
afterAll(async () => {
  await browser?.close()
})

describe('kit init scripts on about:blank', () => {
  it('storage throws there, the kit scripts do not', async () => {
    const context = await browser.newContext()
    const errors: string[] = []
    context.on('weberror', (e) => errors.push(e.error().message))
    await context.addInitScript({ content: CSP_VIOLATION_SCRIPT })
    await installFlutterFirstFrameListener(context)
    const page = await context.newPage()
    await page.goto('about:blank')
    expect(page.url()).toBe('about:blank')
    const storageThrows = await page.evaluate(() => {
      try {
        void window.localStorage.length
        return false
      } catch {
        return true
      }
    })
    expect(storageThrows).toBe(true)
    expect(await page.evaluate((f) => (window as unknown as Record<string, unknown>)[f], FLUTTER_FIRST_FRAME_FLAG)).toBe(false)
    expect(errors).toEqual([])
    await context.close()
  })
})
