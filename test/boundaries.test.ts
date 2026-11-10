import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..', 'src')
const ALLOWED = new Set(['@playwright/test', '@axe-core/playwright', 'eslint'])

describe('kit boundaries', () => {
  it('src imports only its own modules and the peer dependencies', () => {
    const offenders: string[] = []
    for (const file of readdirSync(SRC)) {
      const text = readFileSync(join(SRC, file), 'utf8')
      for (const [, spec] of text.matchAll(/from '([^']+)'/g)) {
        if (spec && !spec.startsWith('./') && !ALLOWED.has(spec)) offenders.push(`${file}: ${spec}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('the main entry never reaches the opt-in flutter entry', () => {
    const seen = new Set<string>()
    const queue = ['index.ts']
    while (queue.length > 0) {
      const file = queue.pop() as string
      if (seen.has(file)) continue
      seen.add(file)
      const text = readFileSync(join(SRC, file), 'utf8')
      for (const [, spec] of text.matchAll(/(?:from|import\()\s*'(\.\/[^']+)'/g)) {
        queue.push((spec as string).slice(2).replace(/\.js$/, '.ts'))
      }
    }
    expect([...seen].filter((f) => f.startsWith('flutter'))).toEqual([])
    expect(seen.has('error-guard.ts')).toBe(true)
  })
})
