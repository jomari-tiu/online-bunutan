import { useCallback, useEffect, useState } from 'react'
import { api, linkFor } from '../lib/api.js'
import { color } from '../lib/colors.js'

const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
const KEY_STORE = 'bunutan:admin-key'

export default function Organizer() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem(KEY_STORE) || '')
  const [status, setStatus] = useState(null) // { generated, upToDate, createdAt, people: [...] }
  const [copied, setCopied] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(
    async (key = adminKey) => {
      if (!key) return
      try {
        setStatus(await api('/admin/status', { adminKey: key }))
        setError('')
      } catch (e) {
        if (e.status === 401) {
          sessionStorage.removeItem(KEY_STORE)
          setAdminKey('')
        }
        setError(e.message)
      }
    },
    [adminKey],
  )

  useEffect(() => {
    load()
  }, [load])

  async function generate() {
    setBusy(true)
    try {
      await api('/admin/generate', { method: 'POST', adminKey })
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

  if (!adminKey) {
    return (
      <section className="card center narrow">
        <h2>📋 Organizer</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const key = new FormData(e.currentTarget).get('key').trim()
            if (!key) return
            sessionStorage.setItem(KEY_STORE, key)
            setAdminKey(key)
          }}
        >
          <input name="key" type="password" placeholder="Organizer key" autoFocus />
          {error && <p className="error">{error}</p>}
          <button className="btn big" type="submit">
            Enter
          </button>
        </form>
      </section>
    )
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
  const inviteText = (p) =>
    `Hi ${p.name}! 🎁 Here’s your bunutan link. Open it to draw your monito/monita. Don’t share it with anyone! ${linkFor(p.token)}`

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
            🎁 {drawn}/{status.people.length} drawn. Send each person <strong>only their own</strong> link (private
            message, not the group chat).{' '}
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
                <span className="pname">
                  {p.name}{' '}
                  <span className={'badge' + (p.drawn ? ' done' : p.hasPin ? ' opened' : '')}>
                    {p.drawn ? '✅ drawn' : p.hasPin ? '🔒 opened' : 'not opened'}
                  </span>
                </span>
                <button className="btn small" onClick={() => copy(inviteText(p), p.id)}>
                  {copied === p.id ? '✓ Copied' : '📋 Copy message'}
                </button>
                <button className="btn small ghost" onClick={() => copy(linkFor(p.token), p.id + ':link')}>
                  {copied === p.id + ':link' ? '✓' : '🔗 Link'}
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
