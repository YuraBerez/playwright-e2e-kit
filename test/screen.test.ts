import { describe, expect, it, vi } from 'vitest'

const toHaveURL = vi.fn(async () => undefined)
const pwExpect = vi.fn(() => ({ toHaveURL }))
vi.mock('@playwright/test', () => ({ expect: (...a: unknown[]) => (pwExpect as (...x: unknown[]) => unknown)(...a) }))

const { BaseComponent, BaseScreen, escapeRegExp } = await import('../src/screen.js')
type Page = ConstructorParameters<typeof BaseComponent>[0]

class SearchScreen extends BaseScreen {
  readonly path = '/search?q=a+b'
}
class ItemScreen extends BaseScreen {
  readonly path = '/items'
  protected override get expectedUrl(): RegExp {
    return /\/items\/\d+$/
  }
}
class Toast extends BaseComponent {
  get boundPage(): Page {
    return this.page
  }
}

function fakePage() {
  return { goto: vi.fn(async () => null), reload: vi.fn(async () => null) }
}

describe('escapeRegExp', () => {
  it('escapes every metacharacter', () => {
    const text = '/a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o'
    expect(new RegExp(`^${escapeRegExp(text)}$`).test(text)).toBe(true)
  })
})

describe('BaseScreen', () => {
  it('open() navigates to the path and reload() reloads', async () => {
    const page = fakePage()
    const screen = new SearchScreen(page as unknown as Page)
    await screen.open()
    await screen.reload()
    expect(page.goto).toHaveBeenCalledWith('/search?q=a+b')
    expect(page.reload).toHaveBeenCalledOnce()
  })

  it('verifyUrl() matches the literal path by default', async () => {
    const page = fakePage()
    await new SearchScreen(page as unknown as Page).verifyUrl()
    expect(pwExpect).toHaveBeenLastCalledWith(page)
    const re = (toHaveURL.mock.calls.at(-1) as unknown as [RegExp])[0]
    expect(re.test('https://host/search?q=a+b')).toBe(true)
    expect(re.test('https://host/searchXq=a+b')).toBe(false)
  })

  it('verifyUrl() uses an overridden expectedUrl', async () => {
    await new ItemScreen(fakePage() as unknown as Page).verifyUrl()
    expect(toHaveURL).toHaveBeenLastCalledWith(/\/items\/\d+$/)
  })

  it('components keep the page', () => {
    const page = fakePage() as unknown as Page
    expect(new Toast(page).boundPage).toBe(page)
  })
})
