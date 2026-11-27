import type { Browser, PlaywrightWorkerArgs, PlaywrightWorkerOptions, TestInfo, WorkerInfo } from '@playwright/test'
import { launchLightpanda, type LightpandaServerOptions } from './server.js'

type Use<T> = (value: T) => Promise<void>

/** Worker options of `lightpandaFixture()`. */
export interface LightpandaWorkerOptions {
  /** Run the worker's tests in Lightpanda instead of `browserName`. Default `false`. */
  lightpanda: boolean
  /** Options of the `lightpanda serve` process of each worker. */
  lightpandaOptions: LightpandaServerOptions
}

/** Tests with this tag must render: they fail in Lightpanda. */
export const RENDER_REQUIRED_TAG = '@critical'

type BrowserArgs = Pick<PlaywrightWorkerArgs, 'playwright'> &
  Pick<PlaywrightWorkerOptions, 'browserName' | 'connectOptions'> &
  LightpandaWorkerOptions

/**
 * The `browser` worker fixture with a Lightpanda switch, plus the `lightpanda` and
 * `lightpandaOptions` worker options. Spread into
 * `test.extend<{}, LightpandaWorkerOptions>({ ...lightpandaFixture() })`; turn it on per project
 * with `use: { lightpanda: true }` (`lightpandaProjects()` does it for you).
 *
 * With `lightpanda: true` each worker starts its own `lightpanda serve` process (one Lightpanda
 * connection holds one browser context, and Playwright runs one test per worker at a time) and
 * connects over CDP. With `false` it does what Playwright's own `browser` fixture does, so the
 * other projects see no change. A test tagged `@critical` fails in a Lightpanda project: a critical
 * scenario must run in a browser that renders.
 */
export function lightpandaFixture(defaults: LightpandaServerOptions = {}) {
  return {
    lightpanda: [false, { scope: 'worker', option: true }] as [boolean, { scope: 'worker'; option: true }],
    lightpandaOptions: [defaults, { scope: 'worker', option: true }] as [
      LightpandaServerOptions,
      { scope: 'worker'; option: true },
    ],
    browser: [
      async ({ playwright, browserName, connectOptions, lightpanda, lightpandaOptions }: BrowserArgs, use: Use<Browser>): Promise<void> => {
        let browser: Browser
        let stop = async (): Promise<void> => {}
        if (lightpanda) {
          const server = await launchLightpanda(lightpandaOptions)
          stop = server.close
          try {
            browser = await playwright.chromium.connectOverCDP(server.wsEndpoint)
          } catch (error) {
            await stop()
            throw error
          }
        } else if (connectOptions) {
          browser = await playwright[browserName].connect(connectOptions.wsEndpoint, connectOptions)
        } else {
          // Same as Playwright's fixture: the launch options come from its `_browserOptions` auto fixture.
          browser = await playwright[browserName].launch()
        }
        try {
          await use(browser)
        } finally {
          await browser.close({ reason: 'Test ended.' })
          await stop()
        }
      },
      { scope: 'worker', timeout: 0 },
    ] as [(args: BrowserArgs, use: Use<Browser>, workerInfo: WorkerInfo) => Promise<void>, { scope: 'worker'; timeout: 0 }],
    lightpandaGuard: [
      async ({ lightpanda }: Pick<LightpandaWorkerOptions, 'lightpanda'>, use: Use<void>, testInfo: TestInfo): Promise<void> => {
        if (lightpanda && testInfo.tags.includes(RENDER_REQUIRED_TAG)) {
          throw new Error(`"${testInfo.title}" is tagged ${RENDER_REQUIRED_TAG}: it must run in a browser that renders, not in Lightpanda.`)
        }
        await use()
      },
      { auto: true },
    ] as [(args: Pick<LightpandaWorkerOptions, 'lightpanda'>, use: Use<void>, testInfo: TestInfo) => Promise<void>, { auto: true }],
  }
}
