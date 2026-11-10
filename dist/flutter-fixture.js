import { appReadyFixture } from './fixtures.js';
import { flutterReady, installFlutterFirstFrameListener } from './flutter-ready.js';
/**
 * `appReadyFixture()` for a Flutter web app: the `appReady` option defaults to `flutterReady`, and
 * a `context` override installs the `flutter-first-frame` listener before any navigation (also in
 * popups). Spread into `test.extend({ ...flutterFixture() })`, instead of `appReadyFixture()`.
 */
export function flutterFixture() {
    return {
        ...appReadyFixture(),
        appReady: [flutterReady, { option: true }],
        context: async ({ context }, use) => {
            await installFlutterFirstFrameListener(context);
            await use(context);
        },
    };
}
