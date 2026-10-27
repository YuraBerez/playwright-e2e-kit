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
})
