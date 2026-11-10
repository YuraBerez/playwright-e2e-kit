import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'

// Same DOM as the Vue fixture: the specs run unchanged on both.
function App() {
  const [name, setName] = useState('')
  const [greeting, setGreeting] = useState('')
  return (
    <main>
      <h1>Kit fixture</h1>
      <label htmlFor="name">Name</label>
      <input id="name" data-testid="name-input" value={name} onChange={(e) => setName(e.target.value)} />
      <button type="button" data-testid="greet-button" onClick={() => setGreeting(`Hello, ${name}!`)}>
        Greet
      </button>
      <p data-testid="greeting" aria-live="polite">
        {greeting}
      </p>
    </main>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
