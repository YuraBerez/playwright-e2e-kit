import { Component, signal } from '@angular/core';

// Same DOM as the React and Vue fixtures: the specs run unchanged on all three.
@Component({
  selector: 'app-root',
  template: `
    <main>
      <h1>Kit fixture</h1>
      <label for="name">Name</label>
      <input id="name" data-testid="name-input" [value]="name()" (input)="name.set($any($event.target).value)" />
      <button type="button" data-testid="greet-button" (click)="greet()">Greet</button>
      <p data-testid="greeting" aria-live="polite">{{ greeting() }}</p>
    </main>
  `,
})
export class App {
  protected readonly name = signal('');
  protected readonly greeting = signal('');

  protected greet(): void {
    this.greeting.set(`Hello, ${this.name()}!`);
  }
}
