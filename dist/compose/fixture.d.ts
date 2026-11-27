import { type AppReadyOption } from '../core/app-ready.js';
import type { TestOption } from '../core/fixture-types.js';
/**
 * `appReadyFixture()` for a Compose Multiplatform web (wasmJs) app: the `appReady` option defaults
 * to `composeReady`. Spread into `test.extend({ ...composeFixture() })`, instead of
 * `appReadyFixture()`.
 */
export declare function composeFixture(): {
    appReady: TestOption<undefined | AppReadyOption>;
    page: ({ page, appReady }: {
        page: import("playwright-core").Page;
        appReady: import("../core/app-ready.js").AppReady | undefined;
    }, use: import("../core/fixture-types.js").Use<import("playwright-core").Page>) => Promise<void>;
};
//# sourceMappingURL=fixture.d.ts.map