import { appReadyOption } from '../core/app-ready.js';
import { appReadyFixture } from '../core/fixtures.js';
import { flutterReady, installFlutterFirstFrameListener } from './ready.js';
/**
 * `appReadyFixture()` for a Flutter web app: the `appReady` option defaults to `flutterReady`, and
 * a `context` override installs the `flutter-first-frame` listener before any navigation (also in
 * popups). Spread into `test.extend({ ...flutterFixture() })`, instead of `appReadyFixture()`.
 */
export function flutterFixture() {
    return {
        ...appReadyFixture(),
        // Wrapped: Playwright would call a bare `flutterReady` as the fixture function.
        appReady: [appReadyOption(flutterReady), { option: true }],
        context: async ({ context }, use) => {
            await installFlutterFirstFrameListener(context);
            await use(context);
        },
    };
}
//# sourceMappingURL=fixture.js.map