import { useEffect, useState } from 'react'
import { EVENT, PARTICIPANTS, formatDate } from './lib/storage.js'
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

  return (
    <div className="app">
      <header className="hero">
        <h1>🎄 {EVENT.eventName}</h1>
        <p className="meta">
          {EVENT.budget && <span>💰 Budget: {EVENT.budget}</span>}
          {EVENT.exchangeDate && <span>📅 {formatDate(EVENT.exchangeDate)}</span>}
          <span>👥 {PARTICIPANTS.length} participants</span>
        </p>
      </header>

      <main>
        {token ? (
          <PersonalDraw key={token} token={token} />
        ) : hash === '#/organizer' ? (
          <Organizer />
        ) : (
          <Landing />
        )}
      </main>

      <footer>
        {token && '🤫 This link is only for you. Don’t share it!'}
      </footer>
    </div>
  )
}

function Landing() {
  return (
    <section className="card center narrow">
      <div className="big-emoji">💌</div>
      <h2>Welcome to the bunutan!</h2>
      <p className="muted">Open the <strong>personal link</strong> the organizer sent you to draw your monito/monita.</p>
      <ul className="chips">
        {PARTICIPANTS.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
    </section>
  )
}
