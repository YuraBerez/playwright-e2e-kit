// screens/checkout.screen.ts
import { expect } from '@playwright/test'
import { ComposeScreen } from 'playwright-e2e-kit/compose'

export class CheckoutScreen extends ComposeScreen {
  readonly path = '/checkout'
  private readonly products = this.page.getByTestId('product-list') // LazyColumn
  private readonly sizes = this.page.getByTestId('size-row') // LazyRow
  private readonly phone = this.page.getByRole('textbox', { name: 'Phone' }) // VisualTransformation mask
  private readonly password = this.page.getByRole('textbox', { name: 'Password' })
  private readonly note = this.page.getByRole('textbox', { name: 'Note' }) // multiline
  private readonly search = this.page.getByRole('textbox', { name: 'Search' }) // ImeAction.Search

  async pickProduct(name: string, size: string): Promise<void> {
    await this.scrollUntilVisible(this.page.getByText(name), { within: this.products })
    await this.scrollUntilVisible(this.page.getByText(size), { within: this.sizes, axis: 'x' })
    await this.tap(this.page.getByText(size))
  }

  async enterContact(digits: string, formatted: string, secret: string): Promise<void> {
    await this.typeText(this.phone, digits, { expected: formatted }) // types raw digits, checks the mask
    await this.typeText(this.password, secret) // no read-back of a password
    await this.typeText(this.note, 'Ring twice\nLeave at the door') // \n = new line
  }

  async searchFor(text: string): Promise<void> {
    await this.typeText(this.search, text, { submit: true }) // Enter runs the IME action
  }

  async resetPhone(): Promise<void> {
    await this.clearText(this.phone)
    expect(await this.readText(this.phone)).toBe('')
  }
}
