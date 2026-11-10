// Self-test (raw page, not a spec): the error guard really fires in a real browser on every
// fixture app. It watches its own context, so the auto guard of the test stays clean.
import { expect, test } from '@playwright/test'
import { ErrorGuard } from 'playwright-e2e-kit'
import { composeErrorAllowList } from 'playwright-e2e-kit/compose'
import { flutterErrorAllowList } from 'playwright-e2e-kit/flutter'

test('the error guard reports a page error and a console error', async ({ browser, baseURL }, testInfo) => {
  const allow = { flutter: flutterErrorAllowList, compose: composeErrorAllowList }[testInfo.project.name] ?? []
  const guard = new ErrorGuard({ allow })
  const context = await browser.newContext({ baseURL })
  try {
    await guard.watch(context)
    const page = await context.newPage()
    await page.goto('/')
    await page.evaluate(() => {
      console.error('self-test: deliberate console error')
      setTimeout(() => {
        throw new Error('self-test: deliberate page error')
      })
    })
    // Both are caught. The kind of the thrown error depends on the framework: Angular's global error
    // listener catches it and logs it with console.error, the others leave it uncaught (pageerror).
    await expect
      .poll(() => guard.collected.map((e) => e.text).join('\n'))
      .toMatch(/deliberate console error[\s\S]*deliberate page error/)
    expect(guard.collected[0]?.kind).toBe('console')
    expect(guard.collected.at(-1)?.kind).toBe(testInfo.project.name === 'angular' ? 'console' : 'pageerror')
    expect(() => guard.assertClean()).toThrow(/deliberate console error[\s\S]*deliberate page error/)
  } finally {
    await context.close()
  }
})

test('one allow-list entry with a kind list covers a console and a page error', async ({ browser, baseURL }) => {
  const guard = new ErrorGuard({
    allow: [{ kind: ['console', 'pageerror'], message: 'self-test: listed', reason: 'self-test of a kind list' }],
  })
  const context = await browser.newContext({ baseURL })
  try {
    await guard.watch(context)
    const page = await context.newPage()
    await page.goto('/')
    await page.evaluate(() => {
      console.error('self-test: listed console error')
      console.error('self-test: unlisted console error')
      setTimeout(() => {
        throw new Error('self-test: listed page error')
      })
    })
    await expect.poll(() => guard.collected.map((e) => e.text).join('\n')).toContain('unlisted console error')
    // Give the thrown error time to reach the guard; it is allowed, so it must not appear.
    await page.waitForTimeout(300)
    expect(guard.collected.map((e) => e.text).join('\n')).not.toContain('self-test: listed')
  } finally {
    await context.close()
  }
})
