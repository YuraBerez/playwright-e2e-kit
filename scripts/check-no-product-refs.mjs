#!/usr/bin/env node
// Fails when the repository names a product, company or private host. This kit is public and
// project-agnostic, so it must not carry names of the projects that use it.
//
// Two checks:
// 1. Deny-list: terms from the NO_PRODUCT_REFS environment variable (comma or newline separated)
//    and from the git-ignored file `.no-product-refs` (one term per line, `#` comments, `/regex/`
//    for a pattern). The list itself is never committed, so it cannot name the products either.
//    Matching is case-insensitive.
// 2. URL hosts: every http(s) URL must point to a host on ALLOWED_HOSTS, a single-label host
//    (`localhost`, `app`) or a reserved example domain (`example.com`, `*.test`, `*.invalid`,
//    `*.example`, `*.localhost`). A github.com URL must point to this package's own repository
//    (package.json `repository`). The generated `package-lock.json` is not scanned for URLs.
//
// Usage: node scripts/check-no-product-refs.mjs [--history]
//   --history  also scans commit and tag messages.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const ALLOWED_HOSTS = [
  'github.com',
  'playwright.dev',
  'dequeuniversity.com',
  'www.w3.org',
  'eslint.org',
  'typescript-eslint.io',
  'opensource.org',
  'registry.npmjs.org',
  'www.npmjs.com',
  'nodejs.org',
  'vitest.dev',
]

/** Single-label hosts and reserved example domains (RFC 2606) never name a real product. */
export function isNeutralHost(host) {
  return !host.includes('.') || /(^|\.)example\.(com|org|net)$/.test(host) || /\.(test|invalid|example|localhost)$/.test(host)
}

/** `foo` -> case-insensitive literal; `/a.b/` -> case-insensitive pattern. Blank and `#` lines are skipped. */
export function parseTerms(text) {
  return text
    .split(/[\n,]/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((term) => {
      const re = /^\/(.+)\/$/.exec(term)
      return re ? new RegExp(re[1], 'i') : new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    })
}

/** Normalises a package.json `repository` to `owner/name`, or undefined. */
export function ownRepo(repository) {
  const url = typeof repository === 'string' ? repository : repository?.url
  const m = /github\.com[/:]([^/]+\/[^/.]+)/i.exec(url ?? '')
  return m?.[1]?.toLowerCase()
}

/** Every finding in `text`: `{ line, match, why }`. */
export function scanText(text, { terms = [], allowedHosts = ALLOWED_HOSTS, repo, urls = true } = {}) {
  const findings = []
  text.split('\n').forEach((content, i) => {
    for (const term of terms) {
      const m = term.exec(content)
      if (m) findings.push({ line: i + 1, match: m[0], why: 'deny-listed term' })
    }
    if (!urls) return
    for (const m of content.matchAll(/https?:\/\/([a-z0-9.-]+)(\/[^\s'"`)>\]]*)?/gi)) {
      const host = m[1].toLowerCase()
      if (isNeutralHost(host)) continue
      if (!allowedHosts.includes(host)) {
        findings.push({ line: i + 1, match: m[0], why: 'URL host not on the allow-list' })
      } else if (host === 'github.com' && repo) {
        const path = (m[2] ?? '').toLowerCase()
        if (!path.startsWith(`/${repo}`) && !path.startsWith('/microsoft/playwright')) {
          findings.push({ line: i + 1, match: m[0], why: 'GitHub URL outside this repository' })
        }
      }
    }
  })
  return findings
}

/** Terms from the environment and the ignored local file. */
export function loadTerms(env = process.env, file = '.no-product-refs') {
  const parts = [env.NO_PRODUCT_REFS ?? '']
  if (existsSync(file)) parts.push(readFileSync(file, 'utf8'))
  return parseTerms(parts.join('\n'))
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

function main(argv) {
  const terms = loadTerms()
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  const repo = ownRepo(pkg.repository)
  const opts = { terms, repo }
  const report = []
  const files = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)
  for (const file of files) {
    if (!existsSync(file)) continue
    const buf = readFileSync(file)
    if (buf.includes(0)) continue // binary
    const urls = !file.endsWith('package-lock.json')
    for (const f of scanText(buf.toString('utf8'), { ...opts, urls })) report.push(`${file}:${f.line}: ${f.why}: ${f.match}`)
    for (const f of scanText(file, opts)) report.push(`${file}: file name: ${f.why}: ${f.match}`)
  }
  if (argv.includes('--history')) {
    const hasCommits = (() => {
      try {
        git(['rev-parse', '--verify', 'HEAD'])
        return true
      } catch {
        return false
      }
    })()
    if (hasCommits) {
      const log = git(['log', '--all', '--format=commit %H%n%B'])
      for (const f of scanText(log, opts)) report.push(`git log:${f.line}: ${f.why}: ${f.match}`)
      const tags = git(['tag', '-l', '--format=tag %(refname:short)%n%(contents)'])
      for (const f of scanText(tags, opts)) report.push(`git tags:${f.line}: ${f.why}: ${f.match}`)
    }
  }
  if (terms.length === 0) {
    console.warn('check:no-product-refs: deny-list is empty (set NO_PRODUCT_REFS or create .no-product-refs); only URL hosts were checked.')
  }
  if (report.length > 0) {
    console.error(`check:no-product-refs: ${report.length} finding(s):\n${report.join('\n')}`)
    return 1
  }
  console.log(`check:no-product-refs: clean (${files.length} files, ${terms.length} deny-list terms).`)
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2))
}
