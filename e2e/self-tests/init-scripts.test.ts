// Self-test: the kit init scripts never throw where APIs throw (about:blank, sandboxed frames).
// A stub makes addEventListener throw before the kit scripts run; an unguarded control script
// proves that the stub really produces a page error.
import { expect, test } from '@playwright/test'
import { ErrorGuard } from 'playwright-e2e-kit'
import { FLUTTER_FIRST_FRAME_FLAG, installFlutterFirstFrameListener } from 'playwright-e2e-kit/flutter'

const THROWING_API = `EventTarget.prototype.addEventListener = function () { throw new Error('stub: API throws here') }`

test('kit init scripts do not throw when the APIs throw, on about:blank', async ({ browser }) => {
  const context = await browser.newContext()
  const errors: string[] = []
  context.on('weberror', (e) => errors.push(e.error().message))
  try {
    await context.addInitScript({ content: THROWING_API })
    // The guard installs the CSP violation init script.
    await new ErrorGuard().watch(context)
    await installFlutterFirstFrameListener(context)
    // Control: the same call, unguarded, does fail, so the stub bites.
    await context.addInitScript({ content: `try { document.addEventListener('x', () => {}) } catch (e) { throw new Error('control: ' + e.message) }` })
    const page = await context.newPage()
    await page.goto('about:blank')
    await expect.poll(() => errors.length).toBeGreaterThan(0)
    // Only the control failed (it runs once per document: the initial one and the navigated one).
    expect(errors.every((m) => m.startsWith('control: '))).toBe(true)
    // Storage throws on about:blank too; the kit never reads it.
    expect(await page.evaluate(() => { try { void localStorage.length; return false } catch { return true } })).toBe(true)
    // The first-frame script set its flag before the listener call failed, and did not throw.
    expect(await page.evaluate((f) => (window as unknown as Record<string, unknown>)[f], FLUTTER_FIRST_FRAME_FLAG)).toBe(false)
  } finally {
    await context.close()
  }
})
