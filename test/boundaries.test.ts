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

  // Each canvas adapter is opt-in: only its own entry point reaches its modules (`<prefix>*.ts`).
  // Shared helpers (for example canvas-scroll.ts) carry no adapter prefix.
  const adapters = [
    { entry: './flutter', prefix: 'flutter', core: 'flutter-ready.ts' },
    { entry: './compose', prefix: 'compose', core: 'compose-ready.ts' },
  ]
  const reached = (entry: string, seen = new Set<string>()): Set<string> => {
    if (seen.has(entry)) return seen
    seen.add(entry)
    const text = readFileSync(join(SRC, entry), 'utf8')
    for (const [, spec] of text.matchAll(/from '\.\/([^']+)\.js'/g)) reached(`${spec}.ts`, seen)
    return seen
  }
  const pkg = JSON.parse(readFileSync(join(SRC, '..', 'package.json'), 'utf8')) as { exports: Record<string, unknown> }
  const toFile = (key: string) => (key === '.' ? 'index.ts' : `${key.slice(2)}.ts`)

  it.each(adapters)('entry points other than $entry never reach the $prefix modules', ({ entry, prefix, core }) => {
    const entries = Object.keys(pkg.exports)
      .filter((key) => key !== entry && key !== './package.json')
      .map(toFile)
    expect(entries).toContain('index.ts')
    expect(reached(toFile(entry))).toContain(core)
    for (const other of entries) {
      expect([...reached(other)].filter((file) => file.startsWith(prefix)), other).toEqual([])
    }
  })
})
