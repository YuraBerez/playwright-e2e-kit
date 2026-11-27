// Self-test (raw page, not a spec): `lightpandaFixture()` and `lightpandaProjects()`. The tagged
// tests run only in `react-lightpanda`, in a real Lightpanda process; the untagged one only in
// `react`, in Chromium. A `@critical` test fails in Lightpanda.
import { expect, test as base } from '@playwright/test'
import { lightpandaFixture, type LightpandaWorkerOptions } from 'playwright-e2e-kit/lightpanda'

const test = base.extend<object, LightpandaWorkerOptions>({ ...lightpandaFixture() })

const engine = () => navigator.userAgent

test('a tagged test runs in Lightpanda, with the pinned timezone and locale', { tag: '@lightpanda' }, async ({ page }, testInfo) => {
  expect(testInfo.project.name).toBe('react-lightpanda')
  await page.goto('/')
  expect(await page.evaluate(engine)).toMatch(/Lightpanda/)
  expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe('UTC')
  expect(await page.evaluate(() => navigator.language)).toBe('en-US')
})

test('an untagged test runs in the rendering browser', async ({ page }, testInfo) => {
  expect(testInfo.project.name).toBe('react')
  await page.goto('/')
  expect(await page.evaluate(engine)).not.toMatch(/Lightpanda/)
})

test.describe('a @critical test', () => {
  // The guard fixture fails it before the body runs: an expected failure.
  test.fail()

  test('fails in Lightpanda', { tag: ['@lightpanda', '@critical'] }, async () => {})
})
