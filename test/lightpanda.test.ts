import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { lightpandaFixture, withLightpanda } from '../src/lightpanda/fixture.js'
import { LIGHTPANDA_USER_AGENT, lightpandaProjects, selectEngine } from '../src/lightpanda/projects.js'
import { launchLightpanda, lightpandaExecutablePath } from '../src/lightpanda/server.js'

afterEach(() => vi.unstubAllEnvs())

const chrome = {
  name: 'web',
  testMatch: /specs/,
  grepInvert: /@quarantine/,
  use: { baseURL: 'http://localhost:4173', userAgent: 'Mozilla/5.0 Chrome', viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, locale: 'de-DE' },
}

describe('lightpandaProjects', () => {
  it('sends tagged tests to Lightpanda and all others to the rendering project', () => {
    const [render, light] = lightpandaProjects(chrome)
    expect(render).toEqual({ ...chrome, grepInvert: [/@quarantine/, /@lightpanda/] })
    expect(light.name).toBe('web-lightpanda')
    expect(light.grep).toEqual(/@lightpanda/)
    expect(light.grepInvert).toEqual(/@quarantine/)
    expect(light.testMatch).toEqual(/specs/)
  })

  it('keeps context options, drops rendering device keys and sets the Lightpanda user agent', () => {
    const [, light] = lightpandaProjects(chrome)
    expect(light.use).toEqual({
      baseURL: 'http://localhost:4173',
      locale: 'de-DE',
      browserName: 'chromium',
      userAgent: LIGHTPANDA_USER_AGENT,
      lightpanda: true,
    })
  })

  it('keeps the project grep in the Lightpanda project: a test needs the grep and the tag', () => {
    const title = (tags: string) => `specs/a.spec.ts shows an error ${tags}`
    const [, single] = lightpandaProjects({ name: 'web', grep: /@smoke/ })
    const grep = single.grep as RegExp
    expect(grep.test(title('@smoke @lightpanda'))).toBe(true)
    expect(grep.test(title('@lightpanda'))).toBe(false)
    expect(grep.test(title('@smoke'))).toBe(false)
    // A list is ORed by Playwright: any entry and the tag.
    const [, list] = lightpandaProjects({ name: 'web', grep: [/@smoke/, /^specs\/b/] })
    const either = list.grep as RegExp
    expect(either.test(title('@smoke @lightpanda'))).toBe(true)
    expect(either.test('specs/b.spec.ts x @lightpanda')).toBe(true)
    expect(either.test('specs/c.spec.ts x @lightpanda')).toBe(false)
    expect((lightpandaProjects({ name: 'web', grep: /@SMOKE/i })[1].grep as RegExp).test(title('@smoke @lightpanda'))).toBe(true)
  })

  it('takes a tag, a name and extra use', () => {
    const [render, light] = lightpandaProjects({ name: 'web' }, { tag: /@no-render/, name: 'lite', use: { userAgent: 'Lightpanda/1.0 kit' } })
    expect(render.grepInvert).toEqual([/@no-render/])
    expect(light).toMatchObject({ name: 'lite', grep: /@no-render/, use: { userAgent: 'Lightpanda/1.0 kit', lightpanda: true } })
  })
})

describe('selectEngine', () => {
  const projects = [...lightpandaProjects({ name: 'web' }), { name: 'flutter', use: {} }, { name: 'raw' }]
  const names = (engine?: string) => selectEngine(projects, engine).map((p) => p.name)

  it('keeps the projects of one engine, by use.lightpanda, not by name', () => {
    expect(names('lightpanda')).toEqual(['web-lightpanda'])
    expect(names('playwright')).toEqual(['web', 'flutter', 'raw'])
    expect(names(undefined)).toEqual(['web', 'web-lightpanda', 'flutter', 'raw'])
    expect(selectEngine([{ name: 'x-lightpanda' }], 'lightpanda')).toEqual([])
  })

  it('reads E2E_ENGINE and rejects an unknown engine', () => {
    vi.stubEnv('E2E_ENGINE', 'lightpanda')
    expect(selectEngine(projects).map((p) => p.name)).toEqual(['web-lightpanda'])
    expect(() => names('chrome')).toThrow(/E2E_ENGINE must be playwright or lightpanda, not "chrome"/)
  })
})

describe('lightpandaFixture', () => {
  it('declares worker options that are off by default', () => {
    const fixture = lightpandaFixture({ args: ['--log-level', 'error'] })
    expect(fixture.lightpanda).toEqual([false, { scope: 'worker', option: true }])
    expect(fixture.lightpandaOptions).toEqual([{ args: ['--log-level', 'error'] }, { scope: 'worker', option: true }])
    expect(fixture.playwright[1]).toEqual({ scope: 'worker' })
    // It does not copy Playwright's own `browser` fixture: that one stays and calls `chromium.launch()`.
    expect(fixture).not.toHaveProperty('browser')
  })

  it('without Lightpanda, gives the real playwright object', async () => {
    const [playwrightFixture] = lightpandaFixture().playwright
    const real = { chromium: {} }
    const use = vi.fn(async () => undefined)
    await playwrightFixture({ playwright: real, lightpanda: false, lightpandaOptions: {} } as never, use, {} as never)
    expect(use).toHaveBeenCalledWith(real)
  })

  it('with Lightpanda, replaces only chromium.launch and keeps writes on the real objects', () => {
    const connectOverCDP = vi.fn()
    const real = { chromium: { connectOverCDP, name: () => 'chromium' }, request: { kind: 'request' }, firefox: { kind: 'firefox' } }
    const proxied = withLightpanda(real as never, {}) as unknown as typeof real & { chromium: { launch: unknown; _defaultLaunchOptions?: unknown } }
    expect(proxied.request).toBe(real.request)
    expect(proxied.firefox).toBe(real.firefox)
    expect(proxied.chromium.name()).toBe('chromium')
    expect(typeof proxied.chromium.launch).toBe('function')
    expect('launch' in real.chromium).toBe(false)
    // Playwright's `_browserOptions` fixture sets the launch defaults on the browser type.
    proxied.chromium._defaultLaunchOptions = { headless: true }
    expect((real.chromium as Record<string, unknown>)._defaultLaunchOptions).toEqual({ headless: true })
  })

  it('with Lightpanda, launch() reports a missing binary before it connects', async () => {
    const connectOverCDP = vi.fn()
    const proxied = withLightpanda({ chromium: { connectOverCDP } } as never, { executablePath: '/nonexistent/lightpanda' })
    await expect(proxied.chromium.launch()).rejects.toThrow(/not found at \/nonexistent\/lightpanda/)
    expect(connectOverCDP).not.toHaveBeenCalled()
  })

  it('fails a @critical test in Lightpanda and lets it run elsewhere', async () => {
    const [guard] = lightpandaFixture().lightpandaGuard
    const use = vi.fn(async () => {})
    const info = { title: 'pays an invoice', tags: ['@critical', '@lightpanda'] } as never
    await expect(guard({ lightpanda: true }, use, info)).rejects.toThrow(/"pays an invoice" is tagged @critical/)
    expect(use).not.toHaveBeenCalled()
    await guard({ lightpanda: false }, use, info)
    await guard({ lightpanda: true }, use, { title: 'shows an error', tags: ['@lightpanda'] } as never)
    expect(use).toHaveBeenCalledTimes(2)
  })
})

describe('launchLightpanda', () => {
  it('resolves the binary from the option, then LIGHTPANDA_EXECUTABLE_PATH, then the install folder', () => {
    vi.stubEnv('LIGHTPANDA_EXECUTABLE_PATH', '/opt/lightpanda')
    expect(lightpandaExecutablePath({ executablePath: '/bin/lp' })).toBe('/bin/lp')
    expect(lightpandaExecutablePath()).toBe('/opt/lightpanda')
    vi.stubEnv('LIGHTPANDA_EXECUTABLE_PATH', undefined as never)
    expect(lightpandaExecutablePath()).toMatch(/\.cache\/lightpanda-node\/lightpanda$/)
  })

  it('names the install command when the binary is missing', async () => {
    await expect(launchLightpanda({ executablePath: '/nonexistent/lightpanda' })).rejects.toThrow(
      /not found at \/nonexistent\/lightpanda.*LIGHTPANDA_EXECUTABLE_PATH/,
    )
  })

  it('reports a binary that cannot start, without an unhandled error event', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lightpanda-'))
    const file = join(dir, 'lightpanda')
    writeFileSync(file, 'not a program')
    chmodSync(file, 0o644)
    await expect(launchLightpanda({ executablePath: file })).rejects.toThrow(/could not start .*EACCES/)
  })

  it('kills a process that ignores SIGTERM', { timeout: 15_000 }, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'lightpanda-'))
    const file = join(dir, 'lightpanda')
    // A fake binary: answers /json/version as Lightpanda does and ignores SIGTERM.
    writeFileSync(
      file,
      `#!${process.execPath}
const port = Number(process.argv[process.argv.indexOf('--port') + 1])
process.on('SIGTERM', () => {})
require('node:http').createServer((req, res) => res.end(JSON.stringify({ 'Lightpanda-Version': 'fake' }))).listen(port, '127.0.0.1')
`,
    )
    chmodSync(file, 0o755)
    const server = await launchLightpanda({ executablePath: file })
    expect(server.wsEndpoint).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/)
    const started = Date.now()
    await server.close()
    expect(Date.now() - started).toBeGreaterThanOrEqual(4_900)
  })

  it('reports the exit code and stderr when the process stops at start', async () => {
    // `node` exits at once on the unknown `serve` script: a binary that cannot start.
    await expect(launchLightpanda({ executablePath: process.execPath, startTimeout: 5000 })).rejects.toThrow(/exited with code 1/)
  })
})
