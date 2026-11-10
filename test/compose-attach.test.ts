import { describe, expect, it, vi } from 'vitest'
import type { Page } from '@playwright/test'

// `test.info()` inside a running test: the attachment either works or fails. Either way the
// error of `composeReady` stays the timeout error.
const attach = vi.fn()
vi.mock('@playwright/test', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@playwright/test')>()),
  test: { info: () => ({ attach }) },
}))
const { composeReady, COMPOSE_DIAGNOSIS_ATTACHMENT } = await import('../src/compose.js')

const facts = {
  url: 'http://localhost/',
  canvas: true,
  a11yRoot: false,
  nodeCount: 0,
  nodesWithId: [],
  nodesWithIdCount: 0,
  nodesWithoutName: [],
  nodesWithoutNameCount: 0,
  pointerEvents: { root: null, canvas: 'auto', nodes: [] },
}
const page = () =>
  ({
    locator: () => ({ first: () => ({ waitFor: async () => Promise.reject(new Error('Timeout 10ms exceeded.')) }) }),
    evaluate: async () => facts,
  }) as unknown as Page

describe('composeReady attachment', () => {
  it('attaches the diagnosis as JSON to the running test', async () => {
    attach.mockReset().mockResolvedValue(undefined)
    await expect(composeReady(page(), { timeout: 10 })).rejects.toThrow(/still loading.*isA11YEnabled = false/)
    expect(attach).toHaveBeenCalledWith(COMPOSE_DIAGNOSIS_ATTACHMENT, expect.objectContaining({ contentType: 'application/json' }))
    expect(JSON.parse(attach.mock.calls[0]![1].body as string)).toMatchObject({ canvas: true, a11yRoot: false })
  })

  it('keeps the timeout error when the attachment fails', async () => {
    attach.mockReset().mockRejectedValue(new Error('attach failed: test has ended'))
    const error = (await composeReady(page(), { timeout: 10 }).catch((e: Error) => e)) as Error
    expect(error.message).toMatch(/^composeReady: the Compose accessibility tree did not get a node within 10 ms\. Diagnosis/)
    expect((error.cause as Error).message).toBe('Timeout 10ms exceeded.')
  })
})
