import { appReadyOption, type AppReadyOption } from './app-ready.js'
import { composeReady } from './compose-ready.js'
import { appReadyFixture } from './fixtures.js'

/**
 * `appReadyFixture()` for a Compose Multiplatform web (wasmJs) app: the `appReady` option defaults
 * to `composeReady`. Spread into `test.extend({ ...composeFixture() })`, instead of
 * `appReadyFixture()`.
 */
export function composeFixture() {
  return {
    ...appReadyFixture(),
    // Wrapped: Playwright would call a bare `composeReady` as the fixture function.
    appReady: [appReadyOption(composeReady), { option: true }] as [undefined | AppReadyOption, { option: true }],
  }
}
