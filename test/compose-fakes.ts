import { vi } from 'vitest'
import type { Locator } from '@playwright/test'

/** A fake locator on a fake page that records the input calls in order. */
export function inputTarget(opts: { focused?: boolean; multiline?: boolean; inputMode?: string; texts?: string[] } = {}) {
  const calls: string[] = []
  // What the node shows on each read; the last one stays.
  const texts = [...(opts.texts ?? [''])]
  const page = {
    evaluate: vi.fn(async () => {
      calls.push('field')
      return { multiline: opts.multiline ?? false, inputMode: opts.inputMode ?? 'text' }
    }),
    keyboard: {
      press: vi.fn(async (key: string) => void calls.push(`press ${key}`)),
      type: vi.fn(async (text: string) => void calls.push(`type ${text}`)),
    },
    waitForFunction: vi.fn(async (fn: (cls: string) => boolean, cls: string, options: { timeout?: number }) => {
      calls.push(`focus ${cls} ${options.timeout}`)
      if (opts.focused === false) throw new Error('Timeout')
      return fn
    }),
  }
  const locator = {
    page: () => page,
    // A read-back wait has a computed timeout: only its state is recorded.
    waitFor: vi.fn(async (o: { state: string; timeout?: number }) =>
      void calls.push(o.state === 'attached' ? 'wait attached' : `wait ${o.state} ${o.timeout}`),
    ),
    click: vi.fn(async (o: { force?: boolean; timeout?: number }) => void calls.push(`click force=${o.force} ${o.timeout}`)),
    evaluate: vi.fn(async () => {
      calls.push('read')
      return texts.length > 1 ? texts.shift()! : texts[0]!
    }),
    toString: () => 'field',
  }
  return { calls, page, locator: locator as unknown as Locator }
}
