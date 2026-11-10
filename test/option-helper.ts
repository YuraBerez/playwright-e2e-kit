import type { AppReady } from '../src/app-ready.js'

/** The hook that an `appReady` option value gives the test, as Playwright resolves it. */
export async function resolveOption(value: unknown): Promise<AppReady | undefined> {
  if (typeof value !== 'function') return value as AppReady | undefined
  let hook: AppReady | undefined
  await (value as (deps: { browserName: string }, use: (h: AppReady | undefined) => Promise<void>) => Promise<void>)(
    { browserName: 'chromium' },
    async (h) => {
      hook = h
    },
  )
  return hook
}
