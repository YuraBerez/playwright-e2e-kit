import { Linter } from 'eslint'
import tseslint from 'typescript-eslint'
import { describe, expect, it } from 'vitest'
import { e2eLayerRules } from '../src/eslint.js'

const cwd = '/project'

function lint(file: string, code: string, root?: string): string[] {
  const linter = new Linter({ cwd })
  const config: Linter.Config[] = [
    { files: ['**/*.ts'], languageOptions: { parser: tseslint.parser as Linter.Parser } },
    ...e2eLayerRules(root ? { root } : {}),
  ]
  return linter.verify(code, config, { filename: `${cwd}/${file}` }).map((m) => m.message)
}

describe('e2eLayerRules', () => {
  it('names each config with the prefix', () => {
    expect(e2eLayerRules({ name: 'kit' }).every((c) => c.name?.startsWith('kit/'))).toBe(true)
  })

  it('bans fixed waits everywhere under the root', () => {
    expect(lint('e2e/data/api.ts', 'page.waitForTimeout(100)')).toEqual([expect.stringMatching(/No fixed sleeps/)])
  })

  it('bans importing expect outside the allowed layers, also via fixtures', () => {
    expect(lint('e2e/data/api.ts', "import { expect } from '@playwright/test'")).toEqual([expect.stringMatching(/Import `expect` only/)])
    expect(lint('e2e/helpers/x.ts', "import { expect } from '../fixtures'")).toEqual([expect.stringMatching(/Import `expect` only/)])
    expect(lint('e2e/specs/a.spec.ts', "import { expect } from '../fixtures'")).toEqual([])
    expect(lint('e2e/self-tests/a.test.ts', "import { expect } from '@playwright/test'")).toEqual([])
  })

  describe('specs', () => {
    const spec = 'e2e/specs/cart.spec.ts'
    it('ban goto, locators, raw page, input devices and screen/data imports', () => {
      expect(lint(spec, "import { CartScreen } from '../screens'")).toEqual([expect.stringMatching(/do not import screens/)])
      expect(lint(spec, "import { createItem } from '../data/api'")).toEqual([expect.stringMatching(/not the data layer/)])
      expect(lint(spec, "x.goto('/a')")).toEqual([expect.stringMatching(/No page.goto/)])
      expect(lint(spec, "x.getByRole('button')")).toEqual([expect.stringMatching(/No locators in specs/)])
      expect(lint(spec, 'page')).toEqual([expect.stringMatching(/No raw `page`/)])
      expect(lint(spec, 'this.page.keyboard')).toEqual(
        expect.arrayContaining([expect.stringMatching(/No page.mouse\/keyboard/)]),
      )
    })
    it('allow a scenario over fixtures', () => {
      expect(lint(spec, "import { test, expect } from '../fixtures'\ntest('a', async ({ app }) => { await app.pages.cart.open(); expect(1).toBe(1) })")).toEqual([])
    })
  })

  describe('page objects', () => {
    it('allow accessible locators and navigation in routed screens', () => {
      expect(lint('e2e/screens/cart.screen.ts', "import { expect } from '@playwright/test'\nthis.page.getByRole('button'); this.page.goto('/cart')")).toEqual([])
    })
    it('ban CSS locators, raw page calls, filter({ has }) and upper-layer imports', () => {
      const file = 'e2e/screens/cart.screen.ts'
      expect(lint(file, "this.page.locator('.x')")).toEqual([expect.stringMatching(/only use getByRole/)])
      expect(lint(file, "this.page.click('#x')")).toEqual([expect.stringMatching(/No raw Page selector/)])
      expect(lint(file, "row.filter({ has: x })")).toEqual([expect.stringMatching(/selector-simple/)])
      expect(lint(file, "import { CartSteps } from '../steps'")).toEqual([expect.stringMatching(/do not depend on steps/)])
    })
    it('ban navigation in components', () => {
      expect(lint('e2e/screens/components/dialog.component.ts', "this.page.goto('/x')")).toEqual([expect.stringMatching(/Components are not routed/)])
    })
  })

  describe('steps', () => {
    const file = 'e2e/steps/cart.steps.ts'
    it('ban locators, goto, raw page calls and data/spec imports', () => {
      expect(lint(file, "this.page.getByText('x')")).toEqual([expect.stringMatching(/No locators in steps/)])
      expect(lint(file, "this.page.goto('/x')")).toEqual([expect.stringMatching(/No page.goto/)])
      expect(lint(file, "page.evaluate(() => 1)")).toEqual([expect.stringMatching(/No raw Page selector/)])
      expect(lint(file, "import { x } from '../data/api'")).toEqual([expect.stringMatching(/test data comes through fixtures/)])
    })
    it('allow page-object verbs', () => {
      expect(lint(file, 'await this.pages.cart.addItem("pen")')).toEqual([])
    })
  })

  it('honours a custom root', () => {
    expect(lint('tests/e2e/specs/a.spec.ts', "x.goto('/a')", 'tests/e2e/')).toEqual([expect.stringMatching(/No page.goto/)])
    expect(lint('e2e/specs/a.spec.ts', "x.goto('/a')", 'tests/e2e')).toEqual([])
  })
})
