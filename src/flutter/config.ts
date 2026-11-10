import type { PlaywrightTestConfig } from '@playwright/test'
import { defineE2EConfig, type E2EConfigOptions } from '../core/config.js'
import { flutterReady } from './ready.js'

/** Attribute that Flutter web renders for `Semantics(identifier: …)`. */
export const FLUTTER_TEST_ID_ATTRIBUTE = 'flt-semantics-identifier'

/**
 * `defineE2EConfig()` for a Flutter web app. On top of the kit defaults it sets
 * `use.testIdAttribute: 'flt-semantics-identifier'` (so `getByTestId` finds
 * `Semantics(identifier:)`) and `appReady: flutterReady`. The app's `config.use` and `options`
 * still win. Apps that do not call it keep Playwright's default `data-testid`.
 */
export function flutterConfig(config: PlaywrightTestConfig = {}, options: E2EConfigOptions = {}): PlaywrightTestConfig {
  return defineE2EConfig(
    { ...config, use: { testIdAttribute: FLUTTER_TEST_ID_ATTRIBUTE, ...config.use } },
    { appReady: flutterReady, ...options },
  )
}
