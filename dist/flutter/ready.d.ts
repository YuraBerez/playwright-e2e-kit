import type { BrowserContext, Page } from '@playwright/test';
import type { AppReady } from '../core/app-ready.js';
/**
 * Window property set by the first-frame init script: `false` once the listener is installed,
 * `true` after the `flutter-first-frame` event. `undefined` means the listener was not installed.
 */
export declare const FLUTTER_FIRST_FRAME_FLAG = "__e2eKitFlutterFirstFrame";
/**
 * Installs the `flutter-first-frame` listener on a page or a whole context. Call it **before**
 * navigation: a fast first frame fires before `goto` returns, and a listener added later misses
 * it. `flutterFixture()` and `FlutterScreen.open()` call it for you. A second call is a no-op.
 */
export declare function installFlutterFirstFrameListener(target: Page | BrowserContext): Promise<void>;
export interface FlutterReadyOptions {
    /** Timeout of each wait, in ms. Default: the page's default timeout. */
    timeout?: number;
}
/**
 * Turns on the Flutter semantics tree, so that `getByRole` / `getByLabel` / `getByTestId` can see
 * the canvas-rendered widgets. If the app called `SemanticsBinding.instance.ensureSemantics()`,
 * the tree is already there and this is a no-op. Otherwise it activates the
 * `flt-semantics-placeholder` once and waits for the first `flt-semantics` node.
 */
export declare function enableFlutterSemantics(page: Page, options?: FlutterReadyOptions): Promise<void>;
/**
 * App-ready hook for a Flutter web app: waits for the `flutter-first-frame` event, then turns on
 * the semantics tree (see `enableFlutterSemantics`).
 *
 * Requires the first-frame listener before navigation (`flutterFixture()`, `FlutterScreen.open()`
 * or `installFlutterFirstFrameListener()`); without it, it throws at once instead of waiting.
 */
export declare const flutterReady: (page: Page, options?: FlutterReadyOptions) => Promise<void>;
/** `flutterReady` with fixed options, as an `AppReady`. */
export declare function flutterReadyWith(options: FlutterReadyOptions): AppReady;
//# sourceMappingURL=ready.d.ts.map