import { expect } from '@playwright/test'
import { ComposeScreen, type ComposeScrollOptions } from 'playwright-e2e-kit/compose'

/**
 * The `/lists` page of the Compose fixture: a `LazyRow` of chips, a 200-item `LazyColumn` and a
 * `LazyColumn` of sections, each with its own `LazyRow` of cards (nested lists).
 */
export class ComposeListsScreen extends ComposeScreen {
  readonly path = '/lists'
  private readonly heading = this.page.getByRole('heading', { name: 'Lists' })
  private readonly chips = this.page.getByTestId('chip-list')
  private readonly rows = this.page.getByTestId('long-list')
  private readonly sections = this.page.getByTestId('outer-list')
  private chip(n: number) {
    return this.page.getByTestId(`chip-${n}`)
  }
  private row(n: number) {
    return this.page.getByTestId(`row-${n}`)
  }
  private section(s: number) {
    return this.page.getByTestId(`section-${s}`)
  }
  private cards(s: number) {
    return this.page.getByTestId(`section-${s}-cards`)
  }
  private card(s: number, c: number) {
    return this.page.getByTestId(`card-${s}-${c}`)
  }

  async verifyShown(): Promise<void> {
    await expect(this.heading).toBeVisible()
  }

  async scrollToRow(n: number, options: ComposeScrollOptions = {}): Promise<void> {
    await this.scrollUntilVisible(this.row(n), { within: this.rows, ...options })
  }

  async scrollToChip(n: number, options: ComposeScrollOptions = {}): Promise<void> {
    await this.scrollUntilVisible(this.chip(n), { within: this.chips, axis: 'x', ...options })
  }

  /** Scrolls the outer list to the section, then the section's own row to the card. */
  async scrollToCard(s: number, c: number, options: ComposeScrollOptions = {}): Promise<void> {
    await this.scrollUntilVisible(this.section(s), { within: this.sections, ...options })
    await this.scrollUntilVisible(this.card(s, c), { within: this.cards(s), axis: 'x', ...options })
  }

  async verifyRowShown(n: number): Promise<void> {
    await expect(this.row(n)).toBeInViewport()
    await expect(this.row(n)).toHaveText(`Row ${n}`)
  }

  async verifyChipShown(n: number): Promise<void> {
    await expect(this.chip(n)).toBeInViewport()
    await expect(this.chip(n)).toHaveText(`Chip ${n}`)
  }

  async verifyCardShown(s: number, c: number): Promise<void> {
    await expect(this.card(s, c)).toBeInViewport()
    await expect(this.card(s, c)).toHaveText(`Card ${s}.${c}`)
  }
}
