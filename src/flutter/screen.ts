import type { Locator } from '@playwright/test'
import { getAppReady } from '../core/app-ready.js'
import { scrollUntilVisible, type ScrollUntilVisibleOptions } from '../canvas/scroll.js'
import { flutterReady, installFlutterFirstFrameListener } from './ready.js'
import { BaseScreen } from '../core/screen.js'

/**
 * `BaseScreen` for a Flutter web app. `open()` installs the `flutter-first-frame` listener before
 * it navigates, and `open()` / `reload()` wait with the page's app-ready hook, or with
 * `flutterReady` when none is set. Subclasses keep their locators `private`, as for `BaseScreen`,
 * and use `scrollUntilVisible()` for items of a virtualised list.
 */
export abstract class FlutterScreen extends BaseScreen {
  override async open(): Promise<void> {
    await installFlutterFirstFrameListener(this.page)
    await super.open()
  }

  protected override async waitReady(): Promise<void> {
    await (getAppReady(this.page) ?? flutterReady)(this.page)
  }

  /** Scrolls `within` (default: the viewport) until `locator` is on screen. See `scrollUntilVisible`. */
  protected async scrollUntilVisible(locator: Locator, options: ScrollUntilVisibleOptions = {}): Promise<void> {
    await scrollUntilVisible(this.page, locator, options)
  }
}
