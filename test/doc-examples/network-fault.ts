// steps/session.steps.ts
import type { Page } from '@playwright/test'
import { BaseSteps, networkFault } from 'playwright-e2e-kit'

export class SessionSteps extends BaseSteps {
  constructor(private readonly page: Page) {
    super('session')
  }

  /** The next token refresh fails as for a revoked refresh token; the app must sign the user out. */
  async failNextTokenRefresh(): Promise<void> {
    await networkFault(this.page, {
      url: '**/auth/refresh',
      status: 401,
      body: { error: 'invalid_grant' },
      reason: 'revoked refresh token',
    })
  }
}
