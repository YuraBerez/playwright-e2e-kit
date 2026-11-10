import type { PlaywrightTestConfig } from '@playwright/test';
import { type E2EConfigOptions } from '../core/config.js';
/** Attribute that Flutter web renders for `Semantics(identifier: …)`. */
export declare const FLUTTER_TEST_ID_ATTRIBUTE = "flt-semantics-identifier";
/**
 * `defineE2EConfig()` for a Flutter web app. On top of the kit defaults it sets
 * `use.testIdAttribute: 'flt-semantics-identifier'` (so `getByTestId` finds
 * `Semantics(identifier:)`) and `appReady: flutterReady`. The app's `config.use` and `options`
 * still win. Apps that do not call it keep Playwright's default `data-testid`.
 */
export declare function flutterConfig(config?: PlaywrightTestConfig, options?: E2EConfigOptions): PlaywrightTestConfig;
//# sourceMappingURL=config.d.ts.map