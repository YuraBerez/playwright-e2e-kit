import { beforeEach, describe, expect, it, vi } from 'vitest'

const { step } = vi.hoisted(() => ({
  step: vi.fn((_title: string, body: () => unknown, _options?: unknown) => body()),
}))
vi.mock('@playwright/test', () => ({ test: { step } }))

const { BaseSteps, boxSteps, humanize, stepTitle } = await import('../src/steps.js')

class CartSteps extends BaseSteps {
  readonly label = 'cart'
  constructor() {
    super('cart')
  }
  async addItemToCart(name: string, qty: number): Promise<string> {
    return `${this.label}:${name}x${qty}`
  }
  async failHard(): Promise<void> {
    throw new Error('boom')
  }
}

beforeEach(() => {
  step.mockClear()
})

describe('humanize', () => {
  it('splits camelCase into lower-case words', () => {
    expect(humanize('signInAndWaitForHome')).toBe('sign in and wait for home')
    expect(humanize('open2Fa')).toBe('open2 fa')
    expect(humanize('plain')).toBe('plain')
  })

  it('builds the step title from group and method', () => {
    expect(stepTitle('auth', 'signInToHome')).toBe('auth: sign in to home')
  })
})

describe('BaseSteps', () => {
  it('reports each method call as a boxed test.step and forwards args and this', async () => {
    const steps = new CartSteps()
    await expect(steps.addItemToCart('pen', 2)).resolves.toBe('cart:penx2')
    expect(step).toHaveBeenCalledTimes(1)
    expect(step.mock.calls[0]?.[0]).toBe('cart: add item to cart')
    expect(step.mock.calls[0]?.[2]).toEqual({ box: true })
  })

  it('propagates failures', async () => {
    await expect(new CartSteps().failHard()).rejects.toThrow('boom')
  })

  it('passes non-function members, symbols and the constructor through unwrapped', () => {
    const steps = new CartSteps()
    expect(steps.label).toBe('cart')
    expect(steps.constructor).toBe(CartSteps)
    expect((steps as unknown as Record<symbol, unknown>)[Symbol.toStringTag]).toBeUndefined()
    expect(step).not.toHaveBeenCalled()
    expect(steps).toBeInstanceOf(BaseSteps)
  })
})

describe('boxSteps', () => {
  it('wraps a plain object', async () => {
    const flows = boxSteps({ async goHome() { return 1 } }, 'nav')
    await expect(flows.goHome()).resolves.toBe(1)
    expect(step.mock.calls[0]?.[0]).toBe('nav: go home')
  })
})
