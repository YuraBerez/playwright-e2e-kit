// fixtures/session.ts
import { test as base } from '@playwright/test'
import {
  sessionPerWorker,
  workerResourceFixture,
  type SessionPerWorkerFixtures,
  type SessionPerWorkerWorkerFixtures,
} from 'playwright-e2e-kit'

interface Account {
  email: string
  password: string
}
interface Catalog {
  id: string
}

// One account per worker: an app that allows one session per account needs it.
const accounts = JSON.parse(process.env.E2E_ACCOUNTS ?? '[]') as Account[]
const api = process.env.E2E_API_URL ?? 'http://localhost:8080/test-data'

export const test = base.extend<SessionPerWorkerFixtures, SessionPerWorkerWorkerFixtures & { catalog: Catalog }>({
  ...sessionPerWorker({
    signIn: async ({ page, workerInfo }) => {
      const account = accounts[workerInfo.parallelIndex % accounts.length]!
      await page.goto('/login')
      await page.getByLabel('Email').fill(account.email)
      await page.getByLabel('Password').fill(account.password)
      await page.getByRole('button', { name: 'Sign in' }).click()
      await page.waitForURL('**/home')
    },
    saveAfterEachTest: true, // the app rotates its refresh token
  }),
  // Read-only data that every test of the worker shares; removed at worker teardown.
  catalog: workerResourceFixture({
    create: async () => (await (await fetch(`${api}/catalogs`, { method: 'POST' })).json()) as Catalog,
    destroy: async (catalog) => {
      await fetch(`${api}/catalogs/${catalog.id}`, { method: 'DELETE' })
    },
  }),
})
