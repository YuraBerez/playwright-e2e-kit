import { expect } from '@playwright/test'
import { COMPOSE_A11Y_ROOT, ComposeScreen } from 'playwright-e2e-kit/compose'
import type { Greeter } from './greeter.screen.js'

/**
 * The greeter screen of the Compose Multiplatform web fixture. `getByTestId` finds
 * `Modifier.testTag` (the DOM `id`) through `composeConfig()`'s `testIdAttribute`. The canvas
 * takes the pointer and the keyboard, so the verbs use `tap()` / `typeText()`, not `click()` /
 * `fill()`.
 */
export class ComposeGreeterScreen extends ComposeScreen implements Greeter {
  readonly path = '/'
  private readonly heading = this.page.getByRole('heading', { name: 'Kit fixture' })
  private readonly nameInput = this.page.getByRole('textbox', { name: 'Name' })
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
    await this.typeText(this.nameInput, name)
    // The accessibility node mirrors the field's value.
    await expect(this.nameInput).toHaveText(name)
  }

  async greet(): Promise<void> {
    await this.tap(this.greetButton)
  }

  async verifyGreeting(text: string): Promise<void> {
    await expect(this.greeting).toHaveText(text)
  }

  async scrollToItem(n: number): Promise<void> {
    await this.scrollUntilVisible(this.item(n), { within: this.list, maxSwipes: 60 })
  }

  async verifyItemShown(n: number): Promise<void> {
    await expect(this.item(n)).toBeInViewport()
    await expect(this.item(n)).toHaveText(`Item ${n}`)
  }

  /** The accessibility tree is on without any activation by the kit. */
  async verifyTreeOn(): Promise<void> {
    await expect(this.page.locator(`${COMPOSE_A11Y_ROOT} > *`).first()).toBeAttached()
  }
}
