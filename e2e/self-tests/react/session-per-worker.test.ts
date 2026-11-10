// Self-test (raw page, not a spec): `sessionPerWorker` signs in once per worker and starts every
// test of the worker signed in; with `saveAfterEachTest`, a rotated token reaches the next test.
// `workerResourceFixture` gives every test of the worker the same resource.
// The "session" is a refresh token in localStorage; signing in or rotating it changes its suffix.
import { expect, test as base, type Page } from '@playwright/test'
import {
  sessionPerWorker,
  workerResourceFixture,
  type SessionPerWorkerFixtures,
  type SessionPerWorkerWorkerFixtures,
} from 'playwright-e2e-kit'

let signIns = 0
let accountsCreated = 0
const tokenKey = 'self-test-refresh-token'

const test = base.extend<SessionPerWorkerFixtures, SessionPerWorkerWorkerFixtures & { account: { id: number } }>({
  ...sessionPerWorker({
    signIn: async ({ page, workerInfo }) => {
      signIns++
      await page.goto('/')
      await page.evaluate(([key, value]) => localStorage.setItem(key, value), [tokenKey, `worker-${workerInfo.parallelIndex}-gen-1`] as const)
    },
    saveAfterEachTest: true,
  }),
  account: workerResourceFixture({ create: () => ({ id: ++accountsCreated }), destroy: () => undefined }),
})

const token = (page: Page) => page.evaluate((key) => localStorage.getItem(key), tokenKey)

// One worker runs the tests in order, so the second test sees what the first one saved.
test.describe.configure({ mode: 'serial' })

test('the first test of the worker starts signed in and rotates the token', async ({ page, account }, testInfo) => {
  await page.goto('/')
  expect(await token(page)).toBe(`worker-${testInfo.parallelIndex}-gen-1`)
  // The app refreshes: the server rotates the refresh token, the old one is used up.
  await page.evaluate((key) => localStorage.setItem(key, localStorage.getItem(key)!.replace(/gen-1$/, 'gen-2')), tokenKey)
  expect(signIns).toBe(1)
  expect(account.id).toBe(1)
})

test('the next test of the worker gets the rotated token, with no new sign-in', async ({ page, account }, testInfo) => {
  await page.goto('/')
  expect(await token(page)).toBe(`worker-${testInfo.parallelIndex}-gen-2`)
  expect(signIns).toBe(1)
  expect(account.id).toBe(1)
  expect(accountsCreated).toBe(1)
})

test.describe('a test with its own storage state', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('starts signed out and is not saved back', async ({ page }) => {
    await page.goto('/')
    expect(await token(page)).toBeNull()
    await page.evaluate((key) => localStorage.setItem(key, 'signed-out-test'), tokenKey)
  })
})

test('the worker state is unchanged by the test with its own state', async ({ page }, testInfo) => {
  await page.goto('/')
  expect(await token(page)).toBe(`worker-${testInfo.parallelIndex}-gen-2`)
  expect(signIns).toBe(1)
})
