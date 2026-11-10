import { type AppReadyOption } from './app-ready.js';
/**
 * `appReadyFixture()` for a Compose Multiplatform web (wasmJs) app: the `appReady` option defaults
 * to `composeReady`. Spread into `test.extend({ ...composeFixture() })`, instead of
 * `appReadyFixture()`.
 */
export declare function composeFixture(): {
    appReady: [undefined | AppReadyOption, {
        option: true;
    }];
    page: ({ page, appReady }: {
        page: import("playwright-core").Page;
        appReady: import("./app-ready.js").AppReady | undefined;
    }, use: (value: import("playwright-core").Page) => Promise<void>) => Promise<void>;
};
