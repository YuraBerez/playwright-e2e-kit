import { BaseSteps } from 'playwright-e2e-kit'
import type { Greeter } from '../screens/greeter.screen.js'

/** Greeter flow, framework-agnostic: it only uses the `Greeter` verbs. */
export class GreeterSteps extends BaseSteps {
  constructor(private readonly screen: Greeter) {
    super('greeter')
  }

  async openGreeter(): Promise<void> {
    await this.screen.open()
    await this.screen.verifyUrl()
    await this.screen.verifyShown()
  }

  async greet(name: string): Promise<void> {
    await this.screen.enterName(name)
    await this.screen.greet()
  }

  async verifyGreeted(name: string): Promise<void> {
    await this.screen.verifyGreeting(`Hello, ${name}!`)
  }
}
