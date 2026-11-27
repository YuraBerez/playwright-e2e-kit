import type { BrowserContext } from '@playwright/test';
import { type AppReadyOption } from '../core/app-ready.js';
import type { TestOption, Use } from '../core/fixture-types.js';
/**
 * `appReadyFixture()` for a Flutter web app: the `appReady` option defaults to `flutterReady`, and
 * a `context` override installs the `flutter-first-frame` listener before any navigation (also in
 * popups). Spread into `test.extend({ ...flutterFixture() })`, instead of `appReadyFixture()`.
 */
export declare function flutterFixture(): {
    appReady: TestOption<undefined | AppReadyOption>;
    context: ({ context }: {
        context: BrowserContext;
    }, use: Use<BrowserContext>) => Promise<void>;
    page: ({ page, appReady }: {
        page: import("@playwright/test").Page;
        appReady: import("../core/app-ready.js").AppReady | undefined;
    }, use: Use<import("@playwright/test").Page>) => Promise<void>;
};
//# sourceMappingURL=fixture.d.ts.map