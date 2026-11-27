// Angular only: the opt-in `angularReady` hook, set per describe with `appReadyOption()`.
// The shared suite (specs/web.spec.ts) runs on Angular with the default config, no hook.
import { expect } from '@playwright/test'
import { angularBootstrapped, angularReady, appReadyOption } from 'playwright-e2e-kit'
import { webTest as test } from '../fixtures.js'
import { WebGreeterScreen } from '../screens/greeter.screen.js'
import { GreeterSteps } from '../steps/greeter.steps.js'

test.describe('angularReady', () => {
  test.use({ appReady: appReadyOption(angularReady) })

  test('open() returns once the zoneless app is bootstrapped', async ({ page }) => {
    await new WebGreeterScreen(page).open()
    // No polling: the hook already waited for the bootstrapped root.
    expect(await page.locator('app-root[ng-version]').count()).toBe(1)
    // Zoneless production build: no testability API, so the ng-version fallback was the check.
    expect(await page.evaluate(() => typeof (window as unknown as Record<string, unknown>).getAllAngularTestabilities)).toBe('undefined')
    const greeter = new GreeterSteps(new WebGreeterScreen(page))
    await greeter.greet('Lin')
    await greeter.verifyGreeted('Lin')
  })
})

test.describe('angularBootstrapped', () => {
  test.use({ appReady: appReadyOption(angularBootstrapped) })

  test('open() returns once the root is bootstrapped, with a zone that never gets stable', async ({ page }) => {
    // A testability that is never stable, as in an app with a SignalR connection: angularReady would wait until the timeout.
    await page.addInitScript(() => {
      ;(window as unknown as Record<string, unknown>).getAllAngularTestabilities = () => [{ isStable: () => false }]
    })
    await new WebGreeterScreen(page).open()
    expect(await page.locator('app-root[ng-version] > *').count()).toBeGreaterThan(0)
    const greeter = new GreeterSteps(new WebGreeterScreen(page))
    await greeter.greet('Lin')
    await greeter.verifyGreeted('Lin')
  })
})
