// Self-test (raw page, not a spec): the error guard really fires in a real browser on every
// fixture app. It watches its own context, so the auto guard of the test stays clean.
import { expect, test } from '@playwright/test'
import { ErrorGuard } from 'playwright-e2e-kit'
import { flutterErrorAllowList } from 'playwright-e2e-kit/flutter'

test('the error guard reports a page error and a console error', async ({ browser, baseURL }, testInfo) => {
  const guard = new ErrorGuard({ allow: testInfo.project.name === 'flutter' ? flutterErrorAllowList : [] })
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
