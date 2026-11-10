import { expect } from '@playwright/test'
import { FlutterScreen } from 'playwright-e2e-kit/flutter'
import type { Greeter } from './greeter.screen.js'

/**
 * The greeter screen of the Flutter fixture. `getByTestId` finds `Semantics(identifier:)` through
 * `flutterConfig()`'s `testIdAttribute`.
 */
export class FlutterGreeterScreen extends FlutterScreen implements Greeter {
  readonly path: string = '/'
  private readonly heading = this.page.getByRole('heading', { name: 'Kit fixture' })
  private readonly nameInput = this.page.getByRole('textbox', { name: 'Name' })
  /** The `Semantics(identifier: 'name-input')` node that wraps the text field. */
  private readonly nameField = this.page.getByTestId('name-input')
  private readonly greetButton = this.page.getByTestId('greet-button')
  private readonly greeting = this.page.getByTestId('greeting')
  private readonly list = this.page.getByTestId('item-list')
  private item(n: number) {
    return this.page.getByTestId(`item-${n}`)
  }

  async verifyShown(): Promise<void> {
    await expect(this.heading).toBeVisible()
  }

  async enterName(name: string): Promise<void> {
    // Focus, two frames, fill, and a check of the value: Flutter drops a fill made before it takes the field.
    await this.typeText(this.nameInput, name)
  }

  /** Same, through the identifier node that wraps the field (`getByTestId`). */
  async enterNameByTestId(name: string): Promise<void> {
    await this.typeText(this.nameField, name)
  }

  async verifyNameValue(name: string): Promise<void> {
    await expect(this.nameInput).toHaveValue(name)
  }

  async greet(): Promise<void> {
    await this.greetButton.click()
  }

  async verifyGreeting(text: string): Promise<void> {
    await expect(this.greeting).toContainText(text)
  }

  async scrollToItem(n: number): Promise<void> {
    await this.scrollUntilVisible(this.item(n), { within: this.list, maxSwipes: 40 })
  }

  async verifyItemShown(n: number): Promise<void> {
    await expect(this.item(n)).toBeInViewport()
    await expect(this.item(n)).toContainText(`Item ${n}`)
  }

  /** The semantics tree is on (the kit or the app turned it on). */
  async verifySemanticsOn(): Promise<void> {
    await expect(this.page.locator('flt-semantics').first()).toBeAttached()
  }
}

/** Same screen, opened with `?semantics=on`: the app calls `ensureSemantics()` itself. */
export class FlutterGreeterWithSemanticsScreen extends FlutterGreeterScreen {
  override readonly path = '/?semantics=on'
}
