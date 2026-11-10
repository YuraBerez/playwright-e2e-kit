import { expect } from '@playwright/test'
import { BaseScreen } from 'playwright-e2e-kit'

/** What the shared suite needs from the greeter screen of every fixture app. */
export interface Greeter {
  open(): Promise<void>
  verifyShown(): Promise<void>
  verifyUrl(): Promise<void>
  enterName(name: string): Promise<void>
  greet(): Promise<void>
  verifyGreeting(text: string): Promise<void>
}

/** The greeter screen of the React and Vue fixtures (same DOM, default `data-testid`). */
export class WebGreeterScreen extends BaseScreen implements Greeter {
  readonly path = '/'
  private readonly heading = this.page.getByRole('heading', { name: 'Kit fixture' })
  private readonly nameInput = this.page.getByTestId('name-input')
  private readonly greetButton = this.page.getByTestId('greet-button')
  private readonly greeting = this.page.getByTestId('greeting')

  async verifyShown(): Promise<void> {
    await expect(this.heading).toBeVisible()
  }

  async enterName(name: string): Promise<void> {
    await this.nameInput.fill(name)
  }

  async greet(): Promise<void> {
    await this.greetButton.click()
  }

  async verifyGreeting(text: string): Promise<void> {
    await expect(this.greeting).toHaveText(text)
  }
}
