import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { CleanupRegistry } from '../src/core/data.js'
import { ErrorGuard } from '../src/core/error-guard.js'
import {
  cleanupFixture,
  errorGuardFixture,
  resourceFixture,
  sessionPerWorker,
  workerResourceFixture,
  type SessionState,
  type WorkerSession,
} from '../src/core/fixtures.js'
import type { Browser, BrowserContext, WorkerInfo } from '@playwright/test'

const noDeps = { browserName: 'chromium' }

describe('resourceFixture', () => {
  it('creates, hands over and destroys the resource', async () => {
    const destroy = vi.fn()
    const fixture = resourceFixture({ create: async () => ({ id: 7 }), destroy })
    const seen: unknown[] = []
    await fixture(noDeps, async (r) => void seen.push(r))
    expect(seen).toEqual([{ id: 7 }])
    expect(destroy).toHaveBeenCalledWith({ id: 7 })
  })

  it('destroys the resource also when the test fails', async () => {
    const destroy = vi.fn()
    const fixture = resourceFixture({ create: () => 'x', destroy })
    await expect(fixture(noDeps, async () => Promise.reject(new Error('test failed')))).rejects.toThrow('test failed')
    expect(destroy).toHaveBeenCalledWith('x')
  })

  it('keeps the destructured first argument Playwright requires', () => {
    expect(resourceFixture({ create: () => 1, destroy: () => undefined }).toString()).toMatch(/^async \(\{/)
  })
})

describe('cleanupFixture', () => {
  it('runs the registered tasks at teardown', async () => {
    const task = vi.fn()
    await cleanupFixture()(noDeps, async (registry: CleanupRegistry) => registry.add('t', task))
    expect(task).toHaveBeenCalledOnce()
  })

  it('warns on a failed task by default', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await cleanupFixture()(noDeps, async (registry) =>
      registry.add('t', () => {
        throw new Error('nope')
      }),
    )
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('1. t: nope'))
    warn.mockRestore()
  })

  it('throws on a failed task with onFailure: throw', async () => {
    const fixture = cleanupFixture({ onFailure: 'throw' })
    await expect(
      fixture(noDeps, async (registry) =>
        registry.add('t', () => {
          throw new Error('nope')
        }),
      ),
    ).rejects.toThrow(/Cleanup: 1 task\(s\) failed/)
  })
})

describe('errorGuardFixture', () => {
  function context() {
    const ctx = Object.assign(new EventEmitter(), { browser: () => null, addInitScript: async () => undefined })
    return ctx as unknown as Parameters<ErrorGuard['watch']>[0]
  }

  it('is an auto fixture that watches the context and passes when clean', async () => {
    const [fixture, options] = errorGuardFixture()
    expect(options).toEqual({ auto: true })
    let guard: ErrorGuard | undefined
    await fixture({ context: context() }, async (g) => {
      guard = g
    })
    expect(guard).toBeInstanceOf(ErrorGuard)
  })

  it('fails at teardown on a collected error, honouring the allow-list', async () => {
    const ctx = context()
    const [fixture] = errorGuardFixture({ allow: [{ kind: 'console', message: 'ok', reason: 'r' }] })
    const msg = (text: string) => ({ type: () => 'error', text: () => text, location: () => ({ url: 'u' }), page: () => null })
    await expect(
      fixture({ context: ctx }, async () => {
        ;(ctx as unknown as EventEmitter).emit('console', msg('ok'))
        ;(ctx as unknown as EventEmitter).emit('console', msg('bad'))
      }),
    ).rejects.toThrow(/\[console\] bad/)
  })
})

describe('workerResourceFixture', () => {
  it('is a worker fixture that creates, shares and destroys the resource', async () => {
    const destroy = vi.fn()
    const [fixture, options] = workerResourceFixture({ create: async () => ({ id: 1 }), destroy })
    expect(options).toEqual({ scope: 'worker' })
    const seen: unknown[] = []
    await fixture(noDeps, async (r) => void seen.push(r))
    expect(seen).toEqual([{ id: 1 }])
    expect(destroy).toHaveBeenCalledWith({ id: 1 })
  })

  it('destroys the resource also when the worker fails', async () => {
    const destroy = vi.fn()
    const [fixture] = workerResourceFixture({ create: () => 'x', destroy })
    await expect(fixture(noDeps, async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom')
    expect(destroy).toHaveBeenCalledWith('x')
    expect(fixture.toString()).toMatch(/^async \(\{/)
  })
})

describe('sessionPerWorker', () => {
  const state = (token: string): SessionState => ({
    cookies: [],
    origins: [{ origin: 'http://app', localStorage: [{ name: 'token', value: token }] }],
  })
  const workerInfo = { parallelIndex: 2, project: { use: { baseURL: 'http://app' } } } as unknown as WorkerInfo

  function fakeBrowser(token = 't1') {
    const context = {
      newPage: vi.fn(async () => ({ page: true })),
      storageState: vi.fn(async (_opts?: { indexedDB?: boolean }) => state(token)),
      close: vi.fn(async () => undefined),
    }
    const browser = { newContext: vi.fn(async (_opts: unknown) => context) }
    return { browser: browser as unknown as Browser, context, newContext: browser.newContext }
  }

  it('signs in once on a fresh context and gives the state to the worker', async () => {
    const { browser, context, newContext } = fakeBrowser()
    const signIn = vi.fn(async () => undefined)
    const fixtures = sessionPerWorker({ signIn })
    const [worker, options] = fixtures.workerSession
    expect(options).toEqual({ scope: 'worker' })
    let session: WorkerSession | undefined
    await worker({ browser }, async (s) => void (session = s), workerInfo)
    expect(newContext).toHaveBeenCalledWith({ baseURL: 'http://app', storageState: undefined })
    expect(signIn).toHaveBeenCalledWith({ page: { page: true }, workerInfo })
    expect(context.storageState).toHaveBeenCalledWith()
    expect(context.close).toHaveBeenCalledOnce()
    expect(session).toEqual({ state: state('t1'), parallelIndex: 2 })

    let given: unknown
    await fixtures.storageState({ workerSession: session! }, async (s) => void (given = s))
    expect(given).toBe(session!.state)
  })

  it('saves IndexedDB when asked', async () => {
    const { browser, context } = fakeBrowser()
    const [worker] = sessionPerWorker({ signIn: async () => undefined, indexedDB: true }).workerSession
    await worker({ browser }, async () => undefined, workerInfo)
    expect(context.storageState).toHaveBeenCalledWith({ indexedDB: true })
  })

  it('names the worker and closes the context when signIn fails', async () => {
    const { browser, context } = fakeBrowser()
    const [worker] = sessionPerWorker({
      signIn: async () => {
        throw new Error('bad password')
      },
    }).workerSession
    await expect(worker({ browser }, async () => undefined, workerInfo)).rejects.toThrow(/signIn failed in worker 2/)
    expect(context.close).toHaveBeenCalledOnce()
  })

  it('saves the state back after each test only when asked and only from the worker state', async () => {
    const testContext = { storageState: vi.fn(async () => state('t2')) } as unknown as BrowserContext
    const run = async (saveAfterEachTest: boolean | undefined, own: boolean) => {
      const session: WorkerSession = { state: state('t1'), parallelIndex: 0 }
      const [save, options] = sessionPerWorker({ signIn: async () => undefined, saveAfterEachTest }).workerSessionSave
      expect(options).toEqual({ auto: true })
      await save({ context: testContext, storageState: own ? state('mine') : session.state, workerSession: session }, async () => undefined)
      return session.state
    }
    expect(await run(true, false)).toEqual(state('t2'))
    expect(await run(undefined, false)).toEqual(state('t1'))
    expect(await run(true, true)).toEqual(state('t1'))
  })
})
