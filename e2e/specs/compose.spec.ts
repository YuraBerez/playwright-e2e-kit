// Compose Multiplatform web (wasmJs): the shared suite plus the accessibility tree, a cleared
// text field and scroll, then the lists (/lists) and the text fields (/fields) of the fixture.
import { expect } from '@playwright/test'
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
