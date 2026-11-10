import type { PlaywrightTestConfig } from '@playwright/test';
import { type E2EConfigOptions } from './config.js';
/** Attribute that Compose Multiplatform web (wasmJs) renders for `Modifier.testTag(…)`: the DOM `id`. */
export declare const COMPOSE_TEST_ID_ATTRIBUTE = "id";
/**
 * `defineE2EConfig()` for a Compose Multiplatform web (wasmJs) app. On top of the kit defaults it
 * sets `use.testIdAttribute: 'id'` (so `getByTestId` finds `Modifier.testTag`) and
 * `appReady: composeReady` (wrapped by `defineE2EConfig`). The app's `config.use` and `options`
 * still win. Apps that do not call it keep Playwright's default `data-testid`.
 */
export declare function composeConfig(config?: PlaywrightTestConfig, options?: E2EConfigOptions): PlaywrightTestConfig;
