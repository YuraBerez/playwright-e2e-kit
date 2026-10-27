import { describe, expect, it } from 'vitest'
import { CleanupRegistry, formatCleanupFailures } from '../src/data.js'

describe('CleanupRegistry', () => {
  it('runs tasks last-in first-out and empties itself', async () => {
    const order: string[] = []
    const registry = new CleanupRegistry()
    registry.add('parent', () => void order.push('parent'))
    registry.add('child', async () => void order.push('child'))
    expect(registry.size).toBe(2)
    await expect(registry.runAll()).resolves.toEqual([])
    expect(order).toEqual(['child', 'parent'])
    expect(registry.size).toBe(0)
  })

  it('keeps going after a failure and returns every failure', async () => {
    const ran: string[] = []
    const registry = new CleanupRegistry()
    registry.add('a', () => void ran.push('a'))
    registry.add('b', () => {
      throw new Error('gone')
    })
    registry.add('c', () => Promise.reject('plain'))
    const failures = await registry.runAll()
    expect(ran).toEqual(['a'])
    expect(failures.map((f) => f.label)).toEqual(['c', 'b'])
    expect(formatCleanupFailures(failures)).toBe('Cleanup: 2 task(s) failed:\n  1. c: plain\n  2. b: gone')
  })
})
