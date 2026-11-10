import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, posix, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(import.meta.dirname, '..')
const SRC = join(ROOT, 'src')
const ALLOWED = new Set(['@playwright/test', '@axe-core/playwright', 'eslint'])

/** Every `.ts` file under src/, as a posix path relative to src/ (for example `flutter/ready.ts`). */
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : name.endsWith('.ts') ? [relative(SRC, full).split('\\').join('/')] : []
  })
const files = walk(SRC)
const read = (file: string) => readFileSync(join(SRC, file), 'utf8')
/** Module specifiers of the static `from '…'` imports and re-exports of a file. */
const specs = (file: string) => [...read(file).matchAll(/(?:from|import) '([^']+)'/g)].map((m) => m[1] as string)
/** Resolves a relative `.js` specifier to the `.ts` file under src/ that it names. */
const resolve = (from: string, spec: string) => posix.join(posix.dirname(from), spec).replace(/\.js$/, '.ts')
const folder = (file: string) => (file.includes('/') ? file.split('/')[0]! : '')
const internal = (file: string) => specs(file).filter((spec) => spec.startsWith('.')).map((spec) => resolve(file, spec))

describe('kit boundaries', () => {
  it('src has the expected folders', () => {
    expect(new Set(files.map(folder).filter(Boolean))).toEqual(new Set(['core', 'canvas', 'flutter', 'compose']))
  })

  it('src imports only its own modules and the peer dependencies', () => {
    const offenders: string[] = []
    for (const file of files) {
      for (const spec of specs(file)) {
        if (!spec.startsWith('.') && !ALLOWED.has(spec)) offenders.push(`${file}: ${spec}`)
        if (spec.startsWith('.') && !files.includes(resolve(file, spec))) offenders.push(`${file}: ${spec} (not a src module)`)
      }
    }
    expect(offenders).toEqual([])
  })

  // Folder rules: a folder may import only the folders listed here (its own files are always allowed).
  const rules: Record<string, string[]> = {
    core: [],
    canvas: ['core'],
    flutter: ['core', 'canvas'],
    compose: ['core', 'canvas'],
  }
  it.each(Object.entries(rules))('%s/ imports only %j (and itself)', (dir, allowed) => {
    const offenders: string[] = []
    for (const file of files.filter((f) => folder(f) === dir)) {
      for (const target of internal(file)) {
        const dep = folder(target)
        if (dep !== dir && !allowed.includes(dep)) offenders.push(`${file} -> ${target}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('the entry files (src/*.ts) are thin: they import no sibling entry file', () => {
    const offenders = files.filter((f) => folder(f) === '').flatMap((f) => internal(f).filter((t) => folder(t) === '').map((t) => `${f} -> ${t}`))
    expect(offenders).toEqual([])
  })

  // Each canvas adapter is opt-in: only its own entry point reaches its folder.
  // The shared canvas/ folder is reached by both adapters, and by no other entry point.
  const reached = (entry: string, seen = new Set<string>()): Set<string> => {
    if (seen.has(entry)) return seen
    seen.add(entry)
    for (const target of internal(entry)) reached(target, seen)
    return seen
  }
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as { exports: Record<string, unknown> }
  const toFile = (key: string) => (key === '.' ? 'index.ts' : `${key.slice(2)}.ts`)
  const adapters = [
    { entry: './flutter', dir: 'flutter', core: 'flutter/ready.ts' },
    { entry: './compose', dir: 'compose', core: 'compose/ready.ts' },
  ]

  it.each(adapters)('entry points other than $entry never reach $dir/', ({ entry, dir, core }) => {
    const entries = Object.keys(pkg.exports)
      .filter((key) => key !== entry && key !== './package.json')
      .map(toFile)
    expect(entries).toContain('index.ts')
    expect(reached(toFile(entry))).toContain(core)
    for (const other of entries) {
      expect([...reached(other)].filter((file) => folder(file) === dir), other).toEqual([])
    }
  })

  it('entry points other than ./flutter and ./compose never reach canvas/', () => {
    const entries = Object.keys(pkg.exports)
      .filter((key) => !['./flutter', './compose', './package.json'].includes(key))
      .map(toFile)
    for (const other of entries) {
      expect([...reached(other)].filter((file) => folder(file) === 'canvas'), other).toEqual([])
    }
  })
})
