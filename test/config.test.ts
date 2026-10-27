import { afterEach, describe, expect, it, vi } from 'vitest'
import { baseConfig, defineE2EConfig, quarantineGrepInvert } from '../src/config.js'
import { DEFAULT_LOCALE, DEFAULT_TIMEZONE, deterministicUse } from '../src/determinism.js'

afterEach(() => vi.unstubAllEnvs())

describe('deterministicUse', () => {
  it('pins UTC and en-US unless overridden', () => {
    expect(deterministicUse()).toEqual({ timezoneId: DEFAULT_TIMEZONE, locale: DEFAULT_LOCALE })
    expect(DEFAULT_TIMEZONE).toBe('UTC')
    expect(DEFAULT_LOCALE).toBe('en-US')
    expect(deterministicUse({ locale: 'de-DE' })).toEqual({ timezoneId: 'UTC', locale: 'de-DE' })
  })
})

describe('quarantineGrepInvert', () => {
  it('excludes @quarantine unless E2E_QUARANTINE=include', () => {
    vi.stubEnv('E2E_QUARANTINE', '')
    expect(quarantineGrepInvert()).toEqual([/@quarantine/])
    vi.stubEnv('E2E_QUARANTINE', 'include')
    expect(quarantineGrepInvert()).toEqual([])
  })

  it('takes explicit options', () => {
    expect(quarantineGrepInvert({ includeQuarantine: false, quarantineTag: /@flaky/ })).toEqual([/@flaky/])
    expect(quarantineGrepInvert({ includeQuarantine: true })).toEqual([])
  })
})

describe('baseConfig', () => {
  it('local: no retries, list reporter, default workers', () => {
    const config = baseConfig({ ci: false })
    expect(config).toMatchObject({
      testMatch: ['specs/**/*.spec.ts', 'self-tests/**/*.test.ts'],
      testIgnore: ['**/__tests__/**'],
      fullyParallel: true,
      forbidOnly: false,
      retries: 0,
      failOnFlakyTests: false,
      workers: undefined,
      reporter: [['list']],
      use: { trace: 'retain-on-failure', timezoneId: 'UTC', locale: 'en-US' },
    })
  })

  it('CI: one retry, flaky fails, two workers, html report', () => {
    expect(baseConfig({ ci: true })).toMatchObject({
      forbidOnly: true,
      retries: 1,
      failOnFlakyTests: true,
      workers: 2,
      reporter: [['list'], ['html', { open: 'never' }]],
    })
  })

  it('reads CI from the environment by default', () => {
    vi.stubEnv('CI', '1')
    expect(baseConfig().retries).toBe(1)
    vi.stubEnv('CI', '')
    expect(baseConfig().retries).toBe(0)
  })
})

describe('defineE2EConfig', () => {
  it('lets the app replace top-level keys and merges use', () => {
    const config = defineE2EConfig(
      { testDir: './e2e', timeout: 5_000, use: { baseURL: 'https://localhost:1', locale: 'fr-FR' } },
      { ci: false, determinism: { timezoneId: 'Europe/Paris' } },
    )
    expect(config.testDir).toBe('./e2e')
    expect(config.timeout).toBe(5_000)
    expect(config.retries).toBe(0)
    expect(config.use).toEqual({ trace: 'retain-on-failure', timezoneId: 'Europe/Paris', locale: 'fr-FR', baseURL: 'https://localhost:1' })
  })

  it('works without use', () => {
    expect(defineE2EConfig({}, { ci: true }).use).toEqual({ trace: 'retain-on-failure', timezoneId: 'UTC', locale: 'en-US' })
  })
})
