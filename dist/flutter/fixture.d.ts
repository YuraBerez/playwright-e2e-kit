import type { BrowserContext } from '@playwright/test';
import { type AppReadyOption } from '../core/app-ready.js';
type Use<T> = (value: T) => Promise<void>;
/**
 * `appReadyFixture()` for a Flutter web app: the `appReady` option defaults to `flutterReady`, and
 * a `context` override installs the `flutter-first-frame` listener before any navigation (also in
 * popups). Spread into `test.extend({ ...flutterFixture() })`, instead of `appReadyFixture()`.
 */
export declare function flutterFixture(): {
    appReady: [undefined | AppReadyOption, {
        option: true;
    }];
    context: ({ context }: {
        context: BrowserContext;
    }, use: Use<BrowserContext>) => Promise<void>;
    page: ({ page, appReady }: {
        page: import("@playwright/test").Page;
        appReady: import("../core/app-ready.js").AppReady | undefined;
    }, use: (value: import("@playwright/test").Page) => Promise<void>) => Promise<void>;
};
export {};
//# sourceMappingURL=fixture.d.ts.map