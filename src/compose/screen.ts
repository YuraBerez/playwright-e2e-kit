import type { Locator } from '@playwright/test'
import { getAppReady } from '../core/app-ready.js'
import {
  composeClear,
  composeReadText,
  composeTap,
  composeType,
  type ComposeClearOptions,
  type ComposeTapOptions,
  type ComposeTypeOptions,
} from './input.js'
import { scrollComposeUntilVisible, type ComposeScrollOptions } from './scroll.js'
import { composeReady } from './ready.js'
import { BaseScreen } from '../core/screen.js'

/**
 * `BaseScreen` for a Compose Multiplatform web (wasmJs) app. `open()` / `reload()` wait with the
 * page's app-ready hook, or with `composeReady` when none is set. Subclasses keep their locators
 * `private`, as for `BaseScreen`, and use `tap()` / `typeText()` / `clearText()` / `readText()`
 * (a plain `click()` / `fill()` does not reach the canvas) and `scrollUntilVisible()` for items of
 * a lazy list.
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

  /** Clears a Compose text field. See `composeClear`. */
  protected async clearText(locator: Locator, options: ComposeClearOptions = {}): Promise<void> {
    await composeClear(locator, options)
  }

  /** The text that a Compose node shows (a masked field: the formatted value). See `composeReadText`. */
  protected async readText(locator: Locator, options: ComposeTapOptions = {}): Promise<string> {
    return composeReadText(locator, options)
  }

  /**
   * Scrolls `within` (default: the viewport) until `locator` is on screen, on `axis` `y` or `x`,
   * with the wheel or a touch drag. See `composeScrollUntilVisible`.
   */
  protected async scrollUntilVisible(locator: Locator, options: ComposeScrollOptions = {}): Promise<void> {
    await scrollComposeUntilVisible(this.page, locator, options)
  }
}
