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

      <footer>
        {token && (
          <>
            <a href="#/">← Back to names</a>
            <br />
            🤫 Keep your pick secret!
          </>
        )}
      </footer>
    </div>
  )
}

/**
 * Welcome page: tap your name → confirm → go to your private page
 * (set a PIN the first time, enter it every time after).
 */
function Landing({ event: initial }) {
  const [event, setEvent] = useState(initial)
  const [chosen, setChosen] = useState(null)

  // Refresh so names that already have a PIN show the lock.
  useEffect(() => {
    api('/event')
      .then(setEvent)
      .catch(() => {})
  }, [])

  if (!event.started) {
    return (
      <section className="card center narrow">
        <div className="big-emoji">⏳</div>
        <h2>Welcome to the bunutan!</h2>
        <p className="muted">The draw hasn’t started yet. Come back once the organizer opens it.</p>
      </section>
    )
  }

  if (chosen) {
    return (
      <section className="card center narrow">
        <div className="big-emoji">🙋</div>
        <h2>Are you {chosen.name}?</h2>
        <p className="muted">
          {chosen.hasPin
            ? 'You’ll need your PIN to open your page.'
            : 'Only continue if this is really you. You’ll set a PIN that protects your pick.'}
        </p>
        <div className="row">
          <button className="btn ghost" onClick={() => setChosen(null)}>
            No, go back
          </button>
          <button className="btn" onClick={() => (window.location.hash = `#/p/${chosen.token}`)}>
            Yes, I’m {chosen.name}
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="card center narrow">
      <div className="big-emoji">💌</div>
      <h2>Welcome to the bunutan!</h2>
      <p className="muted">Tap your name to draw your monito/monita.</p>
      <div className="chips">
        {event.participants.map((p) => (
          <button key={p.id} className="chip" onClick={() => setChosen(p)}>
            {p.hasPin && <span aria-label="PIN set">🔒 </span>}
            {p.name}
          </button>
        ))}
      </div>
      <p className="muted small">🔒 = already opened. Enter your PIN to see your pick again.</p>
    </section>
  )
}
