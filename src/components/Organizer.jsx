import { useRef, useState } from 'react'
import { generateAssignment, isValidAssignment } from '../lib/draw.js'
import {
  BY_ID,
  EVENT,
  IDS,
  PARTICIPANTS,
  PRESET,
  downloadJson,
  linkFor,
  loadAssignment,
  saveAssignment,
} from '../lib/storage.js'
import { color } from '../lib/colors.js'

const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)

/**
 * Development only (`npm run dev`): shows every pair up front, before anyone
 * opens a link. Vite strips this out of `npm run build`, so the online
 * version never shows it.
 */
function DevPairsTable({ pairs }) {
  const opened = (giverId) => {
    try {
      return localStorage.getItem(`bunutan:seen:${linkFor(giverId, pairs[giverId]).split('#/p/')[1]}`) === '1'
    } catch {
      return false
    }
  }
  const received = new Set(Object.values(pairs))

  return (
    <div className="dev-box">
      <h3>🛠 Dev only: all picks</h3>
      <p className="muted small">Hidden in the online build. “Opened” only counts links opened in this browser.</p>
      <div className="table-scroll">
        <table className="dev-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Giver</th>
              <th>Will pick</th>
              <th>Type</th>
              <th>Opened here</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {PARTICIPANTS.map((p, i) => (
              <tr key={p.id}>
                <td>{i + 1}</td>
                <td>{p.name}</td>
                <td>
                  <strong>🎁 {BY_ID[pairs[p.id]].name}</strong>
                </td>
                <td>{PRESET[p.id] ? <span className="tag preset">preset</span> : <span className="tag">random</span>}</td>
                <td>{opened(p.id) ? '✅' : '—'}</td>
                <td>
                  <a href={linkFor(p.id, pairs[p.id])} target="_blank" rel="noreferrer">
                    open ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        Checks: {received.size === PARTICIPANTS.length ? '✅ every name picked once' : '❌ duplicate name!'} ·{' '}
        {PARTICIPANTS.every((p) => pairs[p.id] !== p.id) ? '✅ nobody picks themselves' : '❌ someone picks themselves!'}
      </p>
    </div>
  )
}

export default function Organizer() {
  const [assignment, setAssignment] = useState(loadAssignment) // { createdAt, pairs: { giver: recipient } }
  const [showAll, setShowAll] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [copied, setCopied] = useState(null)
  const [message, setMessage] = useState('')
  const fileRef = useRef()

  const valid = assignment && isValidAssignment(IDS, assignment.pairs)
  const presetOk = valid && Object.entries(PRESET).every(([g, r]) => assignment.pairs[g] === r)

  function store(a) {
    saveAssignment(a)
    setAssignment(a)
  }

  function generate() {
    try {
      store({ createdAt: new Date().toISOString(), pairs: generateAssignment(IDS, PRESET) })
      setConfirm(false)
      setShowAll(false)
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

  function importFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    file
      .text()
      .then((t) => {
        const a = JSON.parse(t)
        if (!isValidAssignment(IDS, a?.pairs)) throw new Error('pairs don’t match the current participant list')
        store(a)
        setMessage(`✅ Imported ${file.name}`)
      })
      .catch((err) => setMessage(`❌ Could not import: ${err.message}`))
    e.target.value = ''
  }

  const inviteText = (p) =>
    `Hi ${p.name}! 🎁 Here’s your ${EVENT.eventName} link. Open it to draw your monito/monita. Don’t share it with anyone! ${linkFor(p.id, assignment.pairs[p.id])}`

  return (
    <section className="card">
      <h2>📋 Organizer</h2>

      {isLocal && (
        <p className="note">
          ⚠️ You’re on <strong>{window.location.host}</strong>. Links made here only work on this computer. Put the app
          online first (Netlify, Vercel or GitHub Pages), then generate and send the links from the online address.
        </p>
      )}

      {!assignment && (
        <>
          <p>
            Press the button once to make all {PARTICIPANTS.length} pairs at the same time. Each person then gets a
            private link that reveals only their own pick, so it’s fine if everyone draws at once on different phones.
          </p>
          {Object.keys(PRESET).length > 0 && (
            <p className="muted">
              Already picked (kept as is):{' '}
              {Object.entries(PRESET)
                .map(([g, r]) => `${BY_ID[g]?.name ?? g} → ${BY_ID[r]?.name ?? r}`)
                .join(', ')}
            </p>
          )}
          <button className="btn big" onClick={generate}>
            🎲 Generate all pairs
          </button>
        </>
      )}

      {assignment && !valid && (
        <p className="error">
          The participant list changed since the pairs were made, so these links no longer match. Generate new pairs
          below and send the new links.
        </p>
      )}
      {valid && !presetOk && (
        <p className="error">These pairs don’t match the “alreadyPicked” entries in participants.json. Regenerate below.</p>
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
                <span className="pname">
                  {p.name}
                  {showAll && <span className="muted"> → 🎁 {BY_ID[assignment.pairs[p.id]].name}</span>}
                </span>
                <button className="btn small" onClick={() => copy(inviteText(p), p.id)}>
                  {copied === p.id ? '✓ Copied' : '📋 Copy message'}
                </button>
                <button className="btn small ghost" onClick={() => copy(linkFor(p.id, assignment.pairs[p.id]), p.id + ':link')}>
                  {copied === p.id + ':link' ? '✓' : '🔗 Link'}
                </button>
              </li>
            ))}
          </ul>
          {import.meta.env.DEV && <DevPairsTable pairs={assignment.pairs} />}

          <button className="btn ghost" onClick={() => setShowAll((v) => !v)}>
            {showAll ? '🙈 Hide pairs' : '👀 Reveal all pairs (organizer only!)'}
          </button>

          <h2>Backup (JSON)</h2>
          <p className="muted">
            The pairs are saved only in this browser. Export a backup so you can resend links from another device.
          </p>
          <div className="row wrap">
            <button className="btn" onClick={() => downloadJson(assignment, 'bunutan-pairs.json')}>
              ⬇️ Export JSON
            </button>
            <button className="btn" onClick={() => fileRef.current.click()}>
              ⬆️ Import JSON
            </button>
          </div>
        </>
      )}
      {!valid && (
        <div className="row wrap">
          <button className="btn ghost" onClick={() => fileRef.current.click()}>
            ⬆️ Import a backup JSON
          </button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importFile} />
      {message && <p className="note">{message}</p>}

      {assignment && (
        <>
          <h2>Danger zone</h2>
          {confirm ? (
            <div className="confirm">
              <p>
                <strong>Make new pairs?</strong> Every link you already sent will stop matching, and two people could
                end up with the same name. Only do this if nobody has their link yet, and then send everyone the new
                links.
              </p>
              <div className="row">
                <button className="btn ghost" onClick={() => setConfirm(false)}>
                  Cancel
                </button>
                <button className="btn danger" onClick={generate}>
                  Yes, make new pairs
                </button>
              </div>
            </div>
          ) : (
            <button className="btn danger ghost" onClick={() => setConfirm(true)}>
              🎲 Regenerate pairs
            </button>
          )}
        </>
      )}
    </section>
  )
}
