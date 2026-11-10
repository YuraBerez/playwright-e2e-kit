// Compose Multiplatform web (wasmJs): the shared suite plus the accessibility tree, a cleared
// text field, scroll and the diagnosis.
import { expect } from '@playwright/test'
import { COMPOSE_DIAGNOSIS_ATTACHMENT, composeReady, diagnoseCompose } from 'playwright-e2e-kit/compose'
import { composeTest as test } from '../fixtures.js'
import { ComposeGreeterScreen } from '../screens/compose-greeter.screen.js'
import { greeterSuite } from '../suite.js'

const upstream = 'Compose Multiplatform web (upstream, epic CMP-9678); check again on each Compose upgrade of the fixture app.'

test.describe('greeter', () => {
  greeterSuite(test, {
    screen: (page) => new ComposeGreeterScreen(page),
    a11yExclusions: [
      {
        rule: 'aria-roles',
        selectorPattern: /^canvas$/,
        reason: 'Compose web gives its <canvas> role="generic", an abstract ARIA role. Not fixable in app code.',
        issue: upstream,
      },
      {
        rule: 'aria-required-attr',
        selectorPattern: /^#heading$/,
        reason: 'Compose web maps semantics { heading() } to role="heading" without aria-level. Not fixable in app code.',
        issue: upstream,
      },
      {
        rule: 'aria-required-children',
        selectorPattern: /^#item-list$/,
        reason: 'Compose web gives a LazyColumn role="list" but its items no listitem role. Not fixable in app code.',
        issue: upstream,
      },
    ],
  })
})

test.describe('compose', () => {
  test('builds the accessibility tree without an activation and maps testTag to the id', async ({ page }) => {
    const screen = new ComposeGreeterScreen(page)
    await screen.open()
    await screen.verifyTreeOn()
    await expect(page.getByTestId('greet-button')).toHaveRole('button')
  })

  test('typeText replaces the text that the field had', async ({ page }) => {
    const screen = new ComposeGreeterScreen(page)
    await screen.open()
    await screen.enterName('Grace')
    await screen.enterName('Ada')
    await screen.greet()
    await screen.verifyGreeting('Hello, Ada!')
  })

  test('scrolls a lazy list until an item is on screen', async ({ page }) => {
    const screen = new ComposeGreeterScreen(page)
    await screen.open()
    await screen.scrollToItem(120)
    await screen.verifyItemShown(120)
  })
})

// A page shaped like a Compose viewport (canvas and #cmp_a11y_root in an open shadow root), for the
// failures that the fixture app does not have.
const viewport = (tree: string | null) => `
  <div id="host"></div>
  <script>
    const shadow = document.getElementById('host').attachShadow({ mode: 'open' })
    shadow.innerHTML = '<canvas></canvas>' + ${JSON.stringify(tree === null ? '' : `<div id="cmp_a11y_root" style="pointer-events: none">${tree}</div>`)}
  </script>`

test.describe('diagnoseCompose', () => {
  test('reads the tree of the fixture app through the shadow root', async ({ page }) => {
    await new ComposeGreeterScreen(page).open()
    const d = await diagnoseCompose(page)
    expect(d).toMatchObject({ canvas: true, a11yRoot: true, nodesWithoutNameCount: 0 })
    expect(d.nodeCount).toBeGreaterThan(5)
    expect(d.nodesWithId).toEqual(expect.arrayContaining(['heading', 'name-input', 'greet-button', 'item-list']))
    expect(d.pointerEvents.canvas).toBe('auto')
    expect(d.pointerEvents.nodes).toEqual(['none'])
  })

  test('finds nodes without test tags and without accessible names', async ({ page }) => {
    await page.setContent(viewport('<div role="button"></div><div role="textbox" aria-label="Email"></div><div>Hi</div>'))
    const d = await diagnoseCompose(page)
    expect(d).toMatchObject({ nodeCount: 3, nodesWithIdCount: 0, nodesWithoutName: ['button'], nodesWithoutNameCount: 1 })
    expect(d.hints.join('\n')).toMatch(/No node has an id[\s\S]*1 node\(s\) with a role have no accessible name/)
  })

  test('composeReady attaches the diagnosis when the tree is missing', async ({ page }, testInfo) => {
    await page.setContent(viewport(null))
    const error = await composeReady(page, { timeout: 500 }).catch((e: Error) => e)
    expect(String(error)).toMatch(/Diagnosis \(attached as compose-diagnosis\.json\): canvas, no #cmp_a11y_root\b.*isA11YEnabled = false/)
    const attachment = testInfo.attachments.find((a) => a.name === COMPOSE_DIAGNOSIS_ATTACHMENT)
    expect(JSON.parse(String(attachment?.body))).toMatchObject({ canvas: true, a11yRoot: false, nodeCount: 0 })
  })

  test('composeReady tells an empty root', async ({ page }) => {
    await page.setContent(viewport(''))
    await expect(composeReady(page, { timeout: 500 })).rejects.toThrow(/#cmp_a11y_root with 0 node\(s\).*#cmp_a11y_root is empty/)
  })
})
