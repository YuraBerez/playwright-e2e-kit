import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { lightpandaFixture } from '../src/lightpanda/fixture.js'
import { LIGHTPANDA_USER_AGENT, lightpandaProjects } from '../src/lightpanda/projects.js'
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

describe('lightpandaFixture', () => {
  it('declares worker options that are off by default', () => {
    const fixture = lightpandaFixture({ args: ['--log-level', 'error'] })
    expect(fixture.lightpanda).toEqual([false, { scope: 'worker', option: true }])
    expect(fixture.lightpandaOptions).toEqual([{ args: ['--log-level', 'error'] }, { scope: 'worker', option: true }])
    expect(fixture.browser[1]).toEqual({ scope: 'worker', timeout: 0 })
  })

  it('without Lightpanda, connects to a remote browser as Playwright does', async () => {
    const [browserFixture] = lightpandaFixture().browser
    const remote = { close: vi.fn(async () => undefined) }
    const connect = vi.fn(async () => remote)
    const launch = vi.fn()
    const playwright = { chromium: { connect, launch } } as never
    const connectOptions = { wsEndpoint: 'ws://grid.test/pw', exposeNetwork: '<loopback>', headers: { 'x-team': 'e2e' } }
    const use = vi.fn(async () => undefined)
    await browserFixture(
      { playwright, browserName: 'chromium', connectOptions, _browserOptions: { headless: true, args: ['--lang=üa'] }, lightpanda: false, lightpandaOptions: {} } as never,
      use,
      { parallelIndex: 0 } as never,
    )
    expect(launch).not.toHaveBeenCalled()
    expect(connect).toHaveBeenCalledWith('ws://grid.test/pw', {
      ...connectOptions,
      headers: { 'x-playwright-launch-options': '{"headless":true,"args":["--lang=\\u00fca"]}', 'x-team': 'e2e' },
    })
    expect(use).toHaveBeenCalledWith(remote)
    expect(remote.close).toHaveBeenCalledWith({ reason: 'Test ended.' })
  })

  it('without Lightpanda, rejects an unknown browserName as Playwright does', async () => {
    const [browserFixture] = lightpandaFixture().browser
    await expect(
      browserFixture({ playwright: {}, browserName: 'edge', lightpanda: false } as never, vi.fn(), { parallelIndex: 0 } as never),
    ).rejects.toThrow(/Unexpected browserName "edge"/)
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
