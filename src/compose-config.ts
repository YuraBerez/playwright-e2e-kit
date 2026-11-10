import type { PlaywrightTestConfig } from '@playwright/test'
import { composeReady } from './compose-ready.js'
import { defineE2EConfig, type E2EConfigOptions } from './config.js'

/** Attribute that Compose Multiplatform web (wasmJs) renders for `Modifier.testTag(…)`: the DOM `id`. */
export const COMPOSE_TEST_ID_ATTRIBUTE = 'id'

/**
 * `defineE2EConfig()` for a Compose Multiplatform web (wasmJs) app. On top of the kit defaults it
 * sets `use.testIdAttribute: 'id'` (so `getByTestId` finds `Modifier.testTag`) and
 * `appReady: composeReady` (wrapped by `defineE2EConfig`). The app's `config.use` and `options`
 * still win. Apps that do not call it keep Playwright's default `data-testid`.
 */
export function composeConfig(config: PlaywrightTestConfig = {}, options: E2EConfigOptions = {}): PlaywrightTestConfig {
  return defineE2EConfig(
    { ...config, use: { testIdAttribute: COMPOSE_TEST_ID_ATTRIBUTE, ...config.use } },
    { appReady: composeReady, ...options },
  )
}
