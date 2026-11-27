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

  it('reports the exit code and stderr when the process stops at start', async () => {
    // `node` exits at once on the unknown `serve` script: a binary that cannot start.
    await expect(launchLightpanda({ executablePath: process.execPath, startTimeout: 5000 })).rejects.toThrow(/exited with code 1/)
  })
})
