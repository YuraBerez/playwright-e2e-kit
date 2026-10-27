import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { CleanupRegistry } from '../src/data.js'
import { ErrorGuard } from '../src/error-guard.js'
import { cleanupFixture, errorGuardFixture, resourceFixture } from '../src/fixtures.js'

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
