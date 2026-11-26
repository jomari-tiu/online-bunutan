import { useCallback, useEffect, useState } from 'react'
import { api, linkFor } from '../lib/api.js'
import { color } from '../lib/colors.js'

const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)

export default function Organizer() {
  const [status, setStatus] = useState(null) // { generated, upToDate, createdAt, people: [...] }
  const [copied, setCopied] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setStatus(await api('/admin/status'))
      setError('')
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function generate() {
    setBusy(true)
    try {
      await api('/admin/generate', { method: 'POST' })
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
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

  if (!status) {
    return error ? (
      <section className="card center narrow">
        <p className="error">{error}</p>
      </section>
    ) : (
      <div className="loading-inline">🎁</div>
    )
  }

  const ready = status.generated && status.upToDate
  const drawn = status.people.filter((p) => p.drawn).length
  return (
    <section className="card">
      <h2>📋 Organizer</h2>

      {isLocal && (
        <p className="note">
          ⚠️ You’re on <strong>{window.location.host}</strong>. Links made here only work on this computer. Put the app
          online first, then copy and send the links from the online address.
        </p>
      )}

      {!ready && (
        <>
          {status.generated && (
            <p className="error">The participant list changed since the pairs were made. Generate new pairs.</p>
          )}
          <p>
            Press the button once to make all {status.people.length} pairs at the same time. Each person then gets a
            private link. The server remembers their PIN and whether they already drew, on any phone.
          </p>
          <button className="btn big" onClick={generate} disabled={busy}>
            🎲 Generate all pairs
          </button>
        </>
      )}

      {ready && (
        <>
          <div className="progress">
            <div style={{ width: `${(drawn / status.people.length) * 100}%` }} />
          </div>
          <p className="muted">
            🎁 {drawn}/{status.people.length} drawn. Everyone taps their name on the home page.{' '}
            <button className="link inline" onClick={() => load()}>
              ↻ Refresh
            </button>
          </p>
          <ul className="links">
            {status.people.map((p, i) => (
              <li key={p.id}>
                <span className="avatar" style={{ background: color(i) }}>
                  {p.name[0].toUpperCase()}
                </span>
                <span className="person">
                  <span className="pname">{p.name}</span>
                  <span className={'badge' + (p.drawn ? ' done' : p.hasPin ? ' opened' : '')}>
                    {p.drawn ? '✅ drawn' : p.hasPin ? '🔒 opened' : 'not opened'}
                  </span>
                </span>
                <button className="btn small ghost" onClick={() => copy(linkFor(p.token), p.id)}>
                  {copied === p.id ? '✓ Copied' : '🔗 Link'}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {error && <p className="error">{error}</p>}
    </section>
  )
}
