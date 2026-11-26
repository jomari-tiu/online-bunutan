import { useEffect, useState } from 'react'
import { api, formatDate } from './lib/api.js'
import PersonalDraw from './components/PersonalDraw.jsx'
import Organizer from './components/Organizer.jsx'

// Hash routes work on any static host:
//   #/p/<token>  → a participant's private draw page
//   #/organizer  → generate pairs and copy everyone's links
//   (anything else) → landing page
function useHash() {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const on = () => setHash(window.location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

export default function App() {
  const hash = useHash()
  const token = hash.startsWith('#/p/') ? hash.slice(4) : null
  const [event, setEvent] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/event')
      .then(setEvent)
      .catch((e) => setError(e.message))
  }, [])

  return (
    <div className="app">
      <header className="hero">
        <h1>🎄 {event?.eventName || 'Bunutan'}</h1>
        {event && (
          <p className="meta">
            {event.budget && <span>💰 Budget: {event.budget}</span>}
            {event.exchangeDate && <span>📅 {formatDate(event.exchangeDate)}</span>}
            <span>👥 {event.participants.length} participants</span>
          </p>
        )}
      </header>

      <main>
        {error ? (
          <section className="card center narrow">
            <div className="big-emoji">📡</div>
            <p className="error">{error}</p>
          </section>
        ) : !event ? (
          <div className="loading-inline">🎁</div>
        ) : token ? (
          <PersonalDraw key={token} token={token} event={event} />
        ) : hash === '#/organizer' ? (
          <Organizer />
        ) : (
          <Landing event={event} />
        )}
      </main>

      <footer>{token && '🤫 This link is only for you. Don’t share it!'}</footer>
    </div>
  )
}

function Landing({ event }) {
  return (
    <section className="card center narrow">
      <div className="big-emoji">💌</div>
      <h2>Welcome to the bunutan!</h2>
      <p className="muted">
        Open the <strong>personal link</strong> the organizer sent you to draw your monito/monita.
      </p>
      <ul className="chips">
        {event.participants.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
    </section>
  )
}
