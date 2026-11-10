import type { PlaywrightTestConfig } from '@playwright/test'
import { composeAppReadyOption } from './compose-fixture.js'
import { composeReady } from './compose-ready.js'
import { defineE2EConfig, type E2EConfigOptions } from './config.js'

/** Attribute that Compose Multiplatform web (wasmJs) renders for `Modifier.testTag(…)`: the DOM `id`. */
export const COMPOSE_TEST_ID_ATTRIBUTE = 'id'

/**
 * `defineE2EConfig()` for a Compose Multiplatform web (wasmJs) app. On top of the kit defaults it
 * sets `use.testIdAttribute: 'id'` (so `getByTestId` finds `Modifier.testTag`) and the `appReady`
 * option to `composeReady` (or `options.appReady`), wrapped so that Playwright does not call the
 * hook as a fixture. The app's `config.use` still wins. Apps that do not call it keep Playwright's
 * default `data-testid`.
 */
export function composeConfig(config: PlaywrightTestConfig = {}, options: E2EConfigOptions = {}): PlaywrightTestConfig {
  const { appReady = composeReady, ...rest } = options
  // `appReady` is a custom option, not a key of Playwright's `use` type.
  const composeUse = { testIdAttribute: COMPOSE_TEST_ID_ATTRIBUTE, appReady: composeAppReadyOption(appReady) }
  return defineE2EConfig({ ...config, use: { ...composeUse, ...config.use } }, rest)
}
