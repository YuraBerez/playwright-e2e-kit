// screens/form.screen.ts
import { ComposeScreen } from 'playwright-e2e-kit/compose'

export class FormScreen extends ComposeScreen {
  readonly path = '/'
  private readonly email = this.page.getByTestId('email-field')
  private readonly submit = this.page.getByRole('button', { name: 'Submit' })
  private readonly list = this.page.getByTestId('items-list')
  private item(n: number) {
    return this.page.getByTestId(`item-${n}`)
  }

  async sendEmail(value: string): Promise<void> {
    await this.typeText(this.email, value)
    await this.tap(this.submit)
  }

  async openItem(n: number): Promise<void> {
    await this.scrollUntilVisible(this.item(n), { within: this.list })
    await this.tap(this.item(n))
  }
}
