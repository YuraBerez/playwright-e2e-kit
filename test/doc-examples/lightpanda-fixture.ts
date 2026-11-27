// e2e/fixtures/app.ts
import { expect, test as base } from '@playwright/test'
import { errorGuardFixture, type ErrorGuard } from 'playwright-e2e-kit'
import { lightpandaFixture, type LightpandaWorkerOptions } from 'playwright-e2e-kit/lightpanda'

export const test = base.extend<{ errorGuard: ErrorGuard }, LightpandaWorkerOptions>({
  ...lightpandaFixture(),
  errorGuard: errorGuardFixture(),
})

// e2e/specs/sign-in.spec.ts: a negative path, no pixels. It runs in Lightpanda.
test('shows an error for a wrong password', { tag: '@lightpanda' }, async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Password').fill('wrong')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Wrong email or password')
})
