// Compose Multiplatform web (wasmJs): the shared suite plus the accessibility tree, a cleared
// text field, scroll and the diagnosis, then the lists (/lists) and the text fields (/fields) of
// the fixture.
import { expect } from '@playwright/test'
import { COMPOSE_DIAGNOSIS_ATTACHMENT, composeReady, diagnoseCompose } from 'playwright-e2e-kit/compose'
import { composeTest as test } from '../fixtures.js'
import { ComposeFieldsScreen } from '../screens/compose-fields.screen.js'
import { ComposeGreeterScreen } from '../screens/compose-greeter.screen.js'
import { ComposeListsScreen } from '../screens/compose-lists.screen.js'
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

// #19: lazy lists, horizontal lists and nested lists, with the wheel and with a touch drag.
test.describe('compose scrolling', () => {
  for (const mode of ['wheel', 'drag'] as const) {
    test(`scrolls a 200-item LazyColumn far down and back up (${mode})`, async ({ page }) => {
      // A drag step is slower than a wheel step, so the drag goes less far.
      const last = mode === 'wheel' ? 199 : 90
      const screen = new ComposeListsScreen(page)
      await screen.open()
      await screen.scrollToRow(last, { mode })
      await screen.verifyRowShown(last)
      // Back up: a negative step.
      await screen.scrollToRow(3, { mode, step: -400 })
      await screen.verifyRowShown(3)
    })

    test(`scrolls a LazyRow on the x axis (${mode})`, async ({ page }) => {
      const screen = new ComposeListsScreen(page)
      await screen.open()
      await screen.scrollToChip(55, { mode })
      await screen.verifyChipShown(55)
    })

    test(`scrolls nested lists: the outer column, then the inner row (${mode})`, async ({ page }) => {
      const screen = new ComposeListsScreen(page)
      await screen.open()
      await screen.scrollToCard(22, 17, { mode })
      await screen.verifyCardShown(22, 17)
    })
  }

  test('stops at the end of the list with a clear error', async ({ page }) => {
    const screen = new ComposeListsScreen(page)
    await screen.open()
    const error = await screen.scrollToRow(500).then(
      () => undefined,
      (e: Error) => e,
    )
    expect(error?.message).toMatch(/did not move on step \d+ \(down, wheel\): it is at its end/)
  })
})

// #20: masked, password, multiline and submit fields.
test.describe('compose text input', () => {
  test('types raw digits into a masked field and reads the formatted value', async ({ page }) => {
    const screen = new ComposeFieldsScreen(page)
    await screen.open()
    await screen.enterPhone('5551234567', '555 123 4567')
    await screen.verifyPhone('5551234567', '555 123 4567')
    await screen.clearPhone()
  })

  test('types a password without a read-back', async ({ page }) => {
    const screen = new ComposeFieldsScreen(page)
    await screen.open()
    await screen.enterPassword('s3cret!')
    await screen.verifyPasswordLength(7)
    const error = await screen.enterPasswordExpecting('s3cret!')
    expect(error.message).toMatch(/is a password field/)
    expect(error.message).not.toContain('s3cret!')
    await screen.clearPassword()
  })

  test('types newlines into a multiline field and clears it', async ({ page }) => {
    const screen = new ComposeFieldsScreen(page)
    await screen.open()
    await screen.enterNotes('line one\nline two\n\nline four')
    await screen.verifyNotes('line one\nline two\n\nline four')
    await screen.clearNotes()
  })

  test('submits a single-line field with Enter and refuses a newline in it', async ({ page }) => {
    const screen = new ComposeFieldsScreen(page)
    await screen.open()
    expect((await screen.typeNewlineInSearch()).message).toMatch(/single-line field/)
    await screen.submitSearch('kotlin')
    await screen.verifySubmitted('kotlin')
  })
})
