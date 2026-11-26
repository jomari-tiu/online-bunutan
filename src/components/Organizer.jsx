import { useState } from 'react'
import { generateAssignment, isValidAssignment } from '../lib/draw.js'
import { EVENT, IDS, PARTICIPANTS, PRESET, linkFor, loadAssignment, saveAssignment } from '../lib/storage.js'
import { color } from '../lib/colors.js'

const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)

export default function Organizer() {
  const [assignment, setAssignment] = useState(loadAssignment) // { createdAt, pairs: { giver: recipient } }
  const [copied, setCopied] = useState(null)
  const [message, setMessage] = useState('')

  const valid =
    assignment &&
    isValidAssignment(IDS, assignment.pairs) &&
    Object.entries(PRESET).every(([g, r]) => assignment.pairs[g] === r)

  function generate() {
    try {
      const a = { createdAt: new Date().toISOString(), pairs: generateAssignment(IDS, PRESET) }
      saveAssignment(a)
      setAssignment(a)
      setMessage('')
    } catch (err) {
      setMessage(`❌ ${err.message}`)
    }
  }

  async function copy(text, id) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      window.prompt('Copy this:', text) // clipboard blocked (e.g. plain http on a phone)
    }
    setCopied(id)
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1800)
  }

  const inviteText = (p) =>
    `Hi ${p.name}! 🎁 Here’s your ${EVENT.eventName} link. Open it to draw your monito/monita. Don’t share it with anyone! ${linkFor(p.id, assignment.pairs[p.id])}`

  return (
    <section className="card">
      <h2>📋 Organizer</h2>

      {isLocal && (
        <p className="note">
          ⚠️ You’re on <strong>{window.location.host}</strong>. Links made here only work on this computer. Put the app
          online first, then generate and send the links from the online address.
        </p>
      )}

      {!valid && (
        <>
          {assignment && (
            <p className="error">
              The participant list changed since the pairs were made. Generate new pairs and send
              the new links.
            </p>
          )}
          <p>
            Press the button once to make all {PARTICIPANTS.length} pairs at the same time. Each person then gets a
            private link that reveals only their own pick, so it’s fine if everyone draws at once on different phones.
          </p>
          <button className="btn big" onClick={generate}>
            🎲 Generate all pairs
          </button>
        </>
      )}

      {valid && (
        <>
          <p className="muted">
            Pairs made {new Date(assignment.createdAt).toLocaleString()}. Send each person <strong>only their own</strong>{' '}
            link (private message, not the group chat).
          </p>
          <ul className="links">
            {PARTICIPANTS.map((p, i) => (
              <li key={p.id}>
                <span className="avatar" style={{ background: color(i) }}>
                  {p.name[0].toUpperCase()}
                </span>
                <span className="pname">{p.name}</span>
                <button className="btn small" onClick={() => copy(inviteText(p), p.id)}>
                  {copied === p.id ? '✓ Copied' : '📋 Copy message'}
                </button>
                <button className="btn small ghost" onClick={() => copy(linkFor(p.id, assignment.pairs[p.id]), p.id + ':link')}>
                  {copied === p.id + ':link' ? '✓' : '🔗 Link'}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {message && <p className="note">{message}</p>}
    </section>
  )
}
