import { describe, expect, it, type vi } from 'vitest'
import type { Locator } from '@playwright/test'
import { composeClear, composeReadText, composeType } from '../src/compose.js'
import { inputTarget } from './compose-fakes.js'

describe('composeType: masked, password, multiline and submit fields (#20)', () => {
  it('waits until a masked field shows the expected value', async () => {
    const t = inputTarget({ texts: ['', '555', '555 123 4567'] })
    await composeType(t.locator, '5551234567', { expected: '555 123 4567' })
    expect(t.calls.filter((c) => c === 'read').length).toBeGreaterThanOrEqual(2)
    expect(t.calls.at(-1)).toBe('read')
  })

  it('accepts a RegExp as expected', async () => {
    const t = inputTarget({ texts: ['', '555 123 4567'] })
    await composeType(t.locator, '5551234567', { expected: /^555 \d{3} \d{4}$/ })
  })

  it('tells what the field shows when the expected value never comes', async () => {
    const t = inputTarget({ texts: ['', '555 123'] })
    await expect(composeType(t.locator, '555123', { expected: '555 123 4567', timeout: 200 })).rejects.toThrow(
      'composeType: field shows "555 123", expected "555 123 4567".',
    )
  })

  it('reads no value back from a password field and never prints it', async () => {
    const t = inputTarget({ inputMode: 'password', texts: [''] })
    await composeType(t.locator, 's3cret')
    expect(t.calls).toContain('type s3cret')

    const p = inputTarget({ inputMode: 'password' })
    const error = await composeType(p.locator, 's3cret', { expected: 's3cret' }).catch((e: Error) => e)
    expect(String(error)).toMatch(/is a password field/)
    expect(String(error)).not.toContain('s3cret')
    expect(p.page.keyboard.type).not.toHaveBeenCalled()
  })

  it('treats any field as a password field with password: true', async () => {
    const t = inputTarget({ inputMode: 'numeric' })
    await expect(composeType(t.locator, '1234', { password: true, expected: '1234' })).rejects.toThrow(/password field/)
  })

  it('types newlines into a multiline field', async () => {
    const t = inputTarget({ multiline: true })
    await composeType(t.locator, 'a\nb')
    expect(t.calls).toContain('type a\nb')
  })

  it('refuses a newline in a single-line field and submit on a multiline field', async () => {
    const single = inputTarget()
    await expect(composeType(single.locator, 'a\nb')).rejects.toThrow(/single-line field.*submit: true/)
    expect(single.page.keyboard.type).not.toHaveBeenCalled()
    const multi = inputTarget({ multiline: true })
    await expect(composeType(multi.locator, 'a', { submit: true })).rejects.toThrow(/multiline field/)
  })

  it('presses Enter after the text and after the check with submit: true', async () => {
    const t = inputTarget({ texts: ['', 'kotlin'] })
    await composeType(t.locator, 'kotlin', { expected: 'kotlin', submit: true })
    expect(t.calls.at(-1)).toBe('press Enter')
    expect(t.calls.indexOf('type kotlin')).toBeLessThan(t.calls.lastIndexOf('read'))
  })

  it('clears once more when the first select all left text', async () => {
    const t = inputTarget({ texts: ['•••'] })
    await composeType(t.locator, 'x')
    expect(t.calls.filter((c) => c === 'press Backspace')).toHaveLength(2)
  })
})

describe('composeClear', () => {
  it('selects all, deletes and waits for an empty field', async () => {
    const t = inputTarget({ texts: ['abc', ''] })
    await composeClear(t.locator)
    expect(t.calls.slice(0, 6)).toEqual(['wait visible undefined', 'click force=true undefined', expect.stringMatching(/^focus /), 'field', 'press ControlOrMeta+A', 'press Backspace'])
    expect(t.calls.at(-1)).toBe('read')
  })

  it('accepts the template of a mask as the empty value', async () => {
    const t = inputTarget({ texts: ['___ ___ ____'] })
    await composeClear(t.locator, { expected: '___ ___ ____' })
  })

  it('tries more rounds, then tells how many characters are left, not which', async () => {
    const t = inputTarget({ texts: ['secret'] })
    const error = await composeClear(t.locator, { timeout: 300 }).catch((e: Error) => e)
    expect(String(error)).toMatch(/still shows 6 characters after select all \+ Backspace \(expected 0 characters\)/)
    expect(String(error)).not.toContain('secret')
    expect(t.calls.filter((c) => c === 'press Backspace')).toHaveLength(3)
  })
})

describe('composeReadText', () => {
  it('waits for the node and joins the lines of a multiline field with \\n', async () => {
    const t = inputTarget()
    const evaluate = (t.locator as unknown as { evaluate: ReturnType<typeof vi.fn> }).evaluate
    evaluate.mockImplementationOnce(async (fn: (node: unknown) => string) => {
      const text = (v: string) => ({ nodeType: 3, nodeValue: v, nodeName: '#text', childNodes: [] })
      const br = { nodeType: 1, nodeName: 'BR', childNodes: [] }
      const span = { nodeType: 1, nodeName: 'SPAN', childNodes: [text('c')] }
      return fn({ nodeType: 1, nodeName: 'DIV', childNodes: [text('a'), br, text('b'), br, br, span] })
    })
    expect(await composeReadText(t.locator, { timeout: 100 })).toBe('a\nb\n\nc')
    expect(t.calls[0]).toBe('wait attached')
  })

  it('rethrows when the node never comes', async () => {
    const locator = { waitFor: async () => Promise.reject(new Error('Timeout 10ms exceeded.')) } as unknown as Locator
    await expect(composeReadText(locator, { timeout: 10 })).rejects.toThrow('Timeout')
  })
})
