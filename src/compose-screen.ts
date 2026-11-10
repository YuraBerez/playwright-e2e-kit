import type { Locator } from '@playwright/test'
import { getAppReady } from './app-ready.js'
import { scrollUntilVisible, type ScrollUntilVisibleOptions } from './canvas-scroll.js'
import { composeTap, composeType, type ComposeTapOptions, type ComposeTypeOptions } from './compose-input.js'
import { composeReady } from './compose-ready.js'
import { BaseScreen } from './screen.js'

/**
 * `BaseScreen` for a Compose Multiplatform web (wasmJs) app. `open()` / `reload()` wait with the
 * page's app-ready hook, or with `composeReady` when none is set. Subclasses keep their locators
 * `private`, as for `BaseScreen`, and use `tap()` / `typeText()` (a plain `click()` / `fill()`
 * does not reach the canvas) and `scrollUntilVisible()` for items of a lazy list.
 */
export abstract class ComposeScreen extends BaseScreen {
  protected override async waitReady(): Promise<void> {
    await (getAppReady(this.page) ?? composeReady)(this.page)
  }

  /** Clicks a Compose node through the canvas. See `composeTap`. */
  protected async tap(locator: Locator, options: ComposeTapOptions = {}): Promise<void> {
    await composeTap(locator, options)
  }

  /** Types into a Compose text field (clears it first by default). See `composeType`. */
  protected async typeText(locator: Locator, text: string, options: ComposeTypeOptions = {}): Promise<void> {
    await composeType(locator, text, options)
  }

  /** Scrolls `within` (default: the viewport) until `locator` is on screen. See `scrollUntilVisible`. */
  protected async scrollUntilVisible(locator: Locator, options: ScrollUntilVisibleOptions = {}): Promise<void> {
    await scrollUntilVisible(this.page, locator, options)
  }
}
