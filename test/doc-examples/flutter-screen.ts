// screens/list.screen.ts
import { FlutterScreen } from 'playwright-e2e-kit/flutter'

export class ListScreen extends FlutterScreen {
  readonly path = '/#/list'
  private readonly list = this.page.getByTestId('items-list')
  private readonly closeButton = this.page.getByRole('button', { name: 'Close' })
  private row(id: string) {
    return this.page.getByTestId(`item-${id}`)
  }

  async openItem(id: string): Promise<void> {
    await this.scrollUntilVisible(this.row(id), { within: this.list })
    await this.row(id).click()
  }

  async close(): Promise<void> {
    await this.closeButton.click()
  }
}
