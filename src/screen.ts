import { expect, type Page } from '@playwright/test'

/** Escapes every RegExp metacharacter in `text`, so it matches literally. */
export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Base class of a reusable UI piece (dialog, table, header). A component has no route: it is
 * composed privately by the screens that render it and re-exposed as verbs. Subclasses keep their
 * locators `private`.
 */
export abstract class BaseComponent {
  constructor(protected readonly page: Page) {}
}

/**
 * Base class of every routed screen. Subclasses keep their locators `private` and expose verbs,
 * `open()` and `verify…()` checks about that screen only.
 *
 * `open()` only navigates: a route guard may redirect, so callers check what actually opened with
 * `verifyShown()` / `verifyUrl()`.
 */
export abstract class BaseScreen extends BaseComponent {
  /** Path of the screen, relative to the configured `baseURL`. */
  abstract readonly path: string

  async open(): Promise<void> {
    await this.page.goto(this.path)
  }

  async reload(): Promise<void> {
    await this.page.reload()
  }

  /** The browser is at this screen's URL (a guard did not redirect elsewhere). */
  async verifyUrl(): Promise<void> {
    await expect(this.page).toHaveURL(this.expectedUrl)
  }

  /** Override for parametrised routes. The default matches `path` anywhere in the URL. */
  protected get expectedUrl(): string | RegExp {
    return new RegExp(escapeRegExp(this.path))
  }
}
