// React, Vue and Angular: the kit's defaults only (no Flutter import in this file's fixtures).
import { webTest as test } from '../fixtures.js'
import { WebGreeterScreen } from '../screens/greeter.screen.js'
import { greeterSuite } from '../suite.js'

test.describe('greeter', () => {
  greeterSuite(test, { screen: (page) => new WebGreeterScreen(page) })
})
