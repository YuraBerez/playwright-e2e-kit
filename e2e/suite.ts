import { expect, type Page, type PlaywrightTestArgs, type PlaywrightTestOptions, type PlaywrightWorkerArgs, type PlaywrightWorkerOptions, type TestType } from '@playwright/test'
import { A11ySteps, type A11yExclusion } from 'playwright-e2e-kit/a11y'
import { store } from './data.js'
import type { SuiteFixtures } from './fixtures.js'
import type { Greeter } from './screens/greeter.screen.js'
import { GreeterSteps } from './steps/greeter.steps.js'

type SuiteTest = TestType<PlaywrightTestArgs & PlaywrightTestOptions & SuiteFixtures, PlaywrightWorkerArgs & PlaywrightWorkerOptions>

export interface SuiteOptions {
  screen: (page: Page) => Greeter
  a11yExclusions?: readonly A11yExclusion[]
}

/**
 * The suite that runs unchanged on every fixture app: open (through `BaseScreen` /
 * `FlutterScreen`), a verb, a verify, the error guard (auto fixture: a clean run is the check),
 * the axe step, and the data layer (resource fixture + cleanup registry).
 */
export function greeterSuite(test: SuiteTest, options: SuiteOptions): void {
  test.afterAll(() => {
    // Every record from `resourceFixture` and every cleanup task ran at teardown.
    expect([...store]).toEqual([])
  })

  test('opens the screen, greets and shows the greeting', async ({ page, errorGuard }) => {
    const greeter = new GreeterSteps(options.screen(page))
    await greeter.openGreeter()
    await greeter.greet('Ada')
    await greeter.verifyGreeted('Ada')
    expect(errorGuard.collected).toEqual([])
  })

  test('has no WCAG A/AA violations', async ({ page }) => {
    await new GreeterSteps(options.screen(page)).openGreeter()
    await new A11ySteps(page, { exclusions: options.a11yExclusions }).expectNoViolations()
  })

  test('creates test data through the back door and removes it at teardown', async ({ page, record, cleanup }) => {
    expect(store.has(record.id)).toBe(true)
    const extra = `${record.id}-extra`
    store.add(extra)
    cleanup.add(`remove ${extra}`, () => {
      store.delete(extra)
    })
    const greeter = new GreeterSteps(options.screen(page))
    await greeter.openGreeter()
    await greeter.greet(record.name)
    await greeter.verifyGreeted(record.name)
  })
}
