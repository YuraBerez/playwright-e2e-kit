// Flutter: the shared suite plus first frame, semantics and scroll.
import { expect } from '@playwright/test'
import { FLUTTER_FIRST_FRAME_FLAG } from 'playwright-e2e-kit/flutter'
import { flutterTest as test } from '../fixtures.js'
import { FlutterGreeterScreen, FlutterGreeterWithSemanticsScreen } from '../screens/flutter-greeter.screen.js'
import { greeterSuite } from '../suite.js'

test.describe('greeter', () => {
  greeterSuite(test, {
    screen: (page) => new FlutterGreeterScreen(page),
    a11yExclusions: [
      {
        rule: 'scrollable-region-focusable',
        // The scroll container is a child of the `item-list` node with no identifier of its own.
        selectorPattern: /^#flt-semantic-node-\d+$/,
        reason:
          'Flutter web renders a ListView scroll container as a non-focusable flt-semantics group; keyboard users scroll through the focusable items. Not fixable in app code.',
        issue: 'Flutter engine (upstream); check again on each Flutter upgrade of the fixture app.',
      },
    ],
  })
})

test.describe('flutter', () => {
  test('waits for the first frame and turns semantics on through the placeholder', async ({ page }) => {
    const screen = new FlutterGreeterScreen(page)
    await screen.open()
    expect(await page.evaluate((flag) => (window as unknown as Record<string, unknown>)[flag], FLUTTER_FIRST_FRAME_FLAG)).toBe(true)
    await screen.verifySemanticsOn()
    await expect(page.locator('flt-semantics-placeholder')).toHaveCount(0)
  })

  test('works when the app already called ensureSemantics()', async ({ page }) => {
    const screen = new FlutterGreeterWithSemanticsScreen(page)
    await screen.open()
    await screen.verifySemanticsOn()
    await screen.enterName('Grace')
    await screen.greet()
    await screen.verifyGreeting('Hello, Grace!')
  })

  test('scrolls a virtualised list until an item is on screen', async ({ page }) => {
    const screen = new FlutterGreeterScreen(page)
    await screen.open()
    await screen.scrollToItem(120)
    await screen.verifyItemShown(120)
  })
})
