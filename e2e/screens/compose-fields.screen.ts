import { expect } from '@playwright/test'
import { ComposeScreen } from 'playwright-e2e-kit/compose'

/**
 * The `/fields` page of the Compose fixture: a phone field with a `VisualTransformation` mask, a
 * password field, a multiline field and a single-line search field with `ImeAction.Search`. A
 * status line under each field shows what the app received.
 */
export class ComposeFieldsScreen extends ComposeScreen {
  readonly path = '/fields'
  private readonly heading = this.page.getByRole('heading', { name: 'Fields' })
  private readonly phone = this.page.getByRole('textbox', { name: 'Phone' })
  private readonly phoneDigits = this.page.getByTestId('phone-digits')
  private readonly password = this.page.getByRole('textbox', { name: 'Password' })
  private readonly passwordLength = this.page.getByTestId('password-length')
  private readonly notes = this.page.getByRole('textbox', { name: 'Notes' })
  private readonly notesLines = this.page.getByTestId('notes-lines')
  private readonly search = this.page.getByRole('textbox', { name: 'Search' })
  private readonly submitted = this.page.getByTestId('submitted')

  async verifyShown(): Promise<void> {
    await expect(this.heading).toBeVisible()
  }

  /** Types the raw digits; the kit waits until the field shows the masked value. */
  async enterPhone(digits: string, formatted: string): Promise<void> {
    await this.typeText(this.phone, digits, { expected: formatted })
  }

  async verifyPhone(digits: string, formatted: string): Promise<void> {
    await expect(this.phoneDigits).toHaveText(`Digits: ${digits}`)
    expect(await this.readText(this.phone)).toBe(formatted)
  }

  async enterPassword(secret: string): Promise<void> {
    await this.typeText(this.password, secret)
  }

  /** Checks the password through the app's status line; the field shows bullets only. */
  async verifyPasswordLength(length: number): Promise<void> {
    await expect(this.passwordLength).toHaveText(`Length: ${length}`)
    expect(await this.readText(this.password)).toBe('•'.repeat(length))
  }

  /** The password field with `expected` must throw: the kit never reads a password back. */
  async enterPasswordExpecting(secret: string): Promise<Error> {
    return this.typeText(this.password, secret, { expected: secret }).then(
      () => new Error('no error'),
      (e: Error) => e,
    )
  }

  async enterNotes(text: string): Promise<void> {
    await this.typeText(this.notes, text, { expected: text })
  }

  async verifyNotes(text: string): Promise<void> {
    await expect(this.notesLines).toHaveText(`Lines: ${text.split('\n').length}`)
    expect(await this.readText(this.notes)).toBe(text)
  }

  async submitSearch(text: string): Promise<void> {
    await this.typeText(this.search, text, { expected: text, submit: true })
  }

  async verifySubmitted(text: string): Promise<void> {
    await expect(this.submitted).toHaveText(`Submitted: ${text}`)
  }

  async typeNewlineInSearch(): Promise<Error> {
    return this.typeText(this.search, 'a\nb').then(
      () => new Error('no error'),
      (e: Error) => e,
    )
  }

  async clearPhone(): Promise<void> {
    await this.clearText(this.phone)
    await expect(this.phoneDigits).toHaveText('Digits: ')
  }

  async clearNotes(): Promise<void> {
    await this.clearText(this.notes)
    await expect(this.notesLines).toHaveText('Lines: 0')
  }

  async clearPassword(): Promise<void> {
    await this.clearText(this.password)
    await expect(this.passwordLength).toHaveText('Length: 0')
  }
}
