// screens/login.screen.ts
import { FlutterScreen } from 'playwright-e2e-kit/flutter'

export class LoginScreen extends FlutterScreen {
  readonly path = '/#/login'
  private readonly email = this.page.getByRole('textbox', { name: 'Email' })
  private readonly password = this.page.getByTestId('password-field') // Semantics(identifier:) around the field
  private readonly submit = this.page.getByRole('button', { name: 'Sign in' })

  async signIn(email: string, password: string): Promise<void> {
    await this.typeText(this.email, email)
    await this.typeText(this.password, password)
    await this.submit.click()
  }
}
