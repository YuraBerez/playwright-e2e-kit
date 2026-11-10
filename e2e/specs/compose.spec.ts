// Compose Multiplatform web (wasmJs): the shared suite plus the accessibility tree, a cleared
// text field and scroll.
import { expect } from '@playwright/test'
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
