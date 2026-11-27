import type { Browser, BrowserType, PlaywrightWorkerArgs } from '@playwright/test'
import type { TestFixture, WorkerFixture, WorkerOption } from '../core/fixture-types.js'
import { launchLightpanda, type LightpandaServerOptions } from './server.js'

/** Worker options of `lightpandaFixture()`. */
export interface LightpandaWorkerOptions {
  /** Run the worker's tests in Lightpanda instead of `browserName`. Default `false`. */
  lightpanda: boolean
  /** Options of the `lightpanda serve` process of each worker. */
  lightpandaOptions: LightpandaServerOptions
}

/** Tests with this tag must render: they fail in Lightpanda. */
export const RENDER_REQUIRED_TAG = '@critical'

type Playwright = PlaywrightWorkerArgs['playwright']

/** Starts a Lightpanda process and connects to it. `close()` of the browser also stops the process. */
async function lightpandaBrowser(chromium: BrowserType, options: LightpandaServerOptions): Promise<Browser> {
  const server = await launchLightpanda(options)
  let browser: Browser
  try {
    browser = await chromium.connectOverCDP(server.wsEndpoint)
  } catch (error) {
    await server.close()
    throw error
  }
  const closeBrowser = browser.close.bind(browser)
  browser.close = async (closeOptions) => {
    try {
      await closeBrowser(closeOptions)
    } finally {
      await server.close()
    }
  }
  return browser
}

/**
 * `playwright` with `chromium.launch()` replaced by a Lightpanda launch. All other members are the
 * real ones, and a property set through the proxy (Playwright sets `_defaultLaunchOptions`) goes
 * to the real object.
 */
export function withLightpanda(playwright: Playwright, options: LightpandaServerOptions): Playwright {
  const chromium = new Proxy(playwright.chromium, {
    get: (target, prop) => (prop === 'launch' ? () => lightpandaBrowser(target, options) : Reflect.get(target, prop, target)),
  })
  return new Proxy(playwright, {
    get: (target, prop) => (prop === 'chromium' ? chromium : Reflect.get(target, prop, target)),
  })
}

/**
 * The Lightpanda switch: the `lightpanda` and `lightpandaOptions` worker options, and an override
 * of the `playwright` worker fixture. Spread into
 * `test.extend<{}, LightpandaWorkerOptions>({ ...lightpandaFixture() })`; turn it on per project
 * with `use: { lightpanda: true }` (`lightpandaProjects()` does it for you).
 *
 * With `lightpanda: true`, `playwright.chromium.launch()` starts a `lightpanda serve` process and
 * connects to it over CDP. Playwright's own `browser` fixture calls it, so the kit does not copy
 * that fixture: each Playwright version keeps its own. One process for each worker: one Lightpanda
 * connection holds one browser context, and a worker runs one test at a time. With `false` the
 * `playwright` fixture is the real one, so the other projects see no change. A test tagged
 * `@critical` fails in a Lightpanda project: a critical scenario must run in a browser that renders.
 */
export function lightpandaFixture(defaults: LightpandaServerOptions = {}) {
  const lightpanda: WorkerOption<boolean> = [false, { scope: 'worker', option: true }]
  const lightpandaOptions: WorkerOption<LightpandaServerOptions> = [defaults, { scope: 'worker', option: true }]
  type Deps = { playwright: Playwright } & LightpandaWorkerOptions
  const playwright: WorkerFixture<Playwright, Deps> = [
    async ({ playwright, lightpanda, lightpandaOptions }, use) => {
      await use(lightpanda ? withLightpanda(playwright, lightpandaOptions) : playwright)
    },
    { scope: 'worker' },
  ]
  const lightpandaGuard: TestFixture<void, Pick<LightpandaWorkerOptions, 'lightpanda'>> = [
    async ({ lightpanda }, use, testInfo) => {
      if (lightpanda && testInfo.tags.includes(RENDER_REQUIRED_TAG)) {
        throw new Error(`"${testInfo.title}" is tagged ${RENDER_REQUIRED_TAG}: it must run in a browser that renders, not in Lightpanda.`)
      }
      await use()
    },
    { auto: true },
  ]
  return { lightpanda, lightpandaOptions, playwright, lightpandaGuard }
}
