import type { BrowserContext } from '@playwright/test'
import type { AppReady } from './app-ready.js'
import { appReadyFixture } from './fixtures.js'
import { flutterReady, installFlutterFirstFrameListener } from './flutter-ready.js'

type Use<T> = (value: T) => Promise<void>

/**
 * `appReadyFixture()` for a Flutter web app: the `appReady` option defaults to `flutterReady`, and
 * a `context` override installs the `flutter-first-frame` listener before any navigation (also in
 * popups). Spread into `test.extend({ ...flutterFixture() })`, instead of `appReadyFixture()`.
 */
export function flutterFixture() {
  return {
    ...appReadyFixture(),
    appReady: [flutterReady, { option: true }] as [AppReady | undefined, { option: true }],
    context: async ({ context }: { context: BrowserContext }, use: Use<BrowserContext>): Promise<void> => {
      await installFlutterFirstFrameListener(context)
      await use(context)
    },
  }
}
