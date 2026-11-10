// e2e/self-tests/compose-diagnosis.test.ts
import { expect, test } from '@playwright/test'
import { diagnoseCompose } from 'playwright-e2e-kit/compose'

test('the Compose tree has the test tags', async ({ page }) => {
  await page.goto('/')
  const diagnosis = await diagnoseCompose(page)
  expect(diagnosis.hints.filter((hint) => !hint.includes('pointer-events'))).toEqual([])
  expect(diagnosis.nodesWithId).toContain('submit')
})
