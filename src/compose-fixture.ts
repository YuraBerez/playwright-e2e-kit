import type { AppReady } from './app-ready.js'
import { composeReady } from './compose-ready.js'
import { appReadyFixture } from './fixtures.js'

/** Playwright fixture function that provides `hook` as the value of the `appReady` option. */
export type ComposeAppReadyOption = (
  deps: { browserName: string },
  use: (hook: AppReady | undefined) => Promise<void>,
) => Promise<void>

/**
 * Wraps a hook as the value of the `appReady` option. Playwright treats a function given to an
 * option (fixture default, config `use`, `test.use()`) as a fixture function and parses its first
 * parameter, so a bare `composeReady` fails at load time ("First argument must use the object
 * destructuring pattern"). Same shape as the core `appReadyOption` of PR #13.
 */
export function composeAppReadyOption(hook: AppReady | undefined): ComposeAppReadyOption {
  // The destructured first argument is required: Playwright reads it to find the dependencies.
  return async ({ browserName: _browserName }, use) => {
    await use(hook)
  }
}

/**
 * `appReadyFixture()` for a Compose Multiplatform web (wasmJs) app: the `appReady` option defaults
 * to `composeReady`. Spread into `test.extend({ ...composeFixture() })`, instead of
 * `appReadyFixture()`.
 */
export function composeFixture() {
  return {
    ...appReadyFixture(),
    appReady: [composeAppReadyOption(composeReady), { option: true }] as [
      ComposeAppReadyOption | undefined,
      { option: true },
    ],
  }
}
