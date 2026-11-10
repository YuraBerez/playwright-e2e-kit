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

  it('entry points other than ./flutter never reach the Flutter modules', () => {
    const reached = (entry: string, seen = new Set<string>()): Set<string> => {
      if (seen.has(entry)) return seen
      seen.add(entry)
      const text = readFileSync(join(SRC, entry), 'utf8')
      for (const [, spec] of text.matchAll(/from '\.\/([^']+)\.js'/g)) reached(`${spec}.ts`, seen)
      return seen
    }
    const pkg = JSON.parse(readFileSync(join(SRC, '..', 'package.json'), 'utf8')) as { exports: Record<string, unknown> }
    const entries = Object.keys(pkg.exports)
      .filter((key) => key !== './flutter' && key !== './package.json')
      .map((key) => (key === '.' ? 'index.ts' : `${key.slice(2)}.ts`))
    expect(entries).toContain('index.ts')
    expect(reached('flutter.ts')).toContain('flutter-ready.ts')
    for (const entry of entries) {
      expect([...reached(entry)].filter((file) => file.startsWith('flutter')), entry).toEqual([])
    }
  })
})
