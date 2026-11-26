import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api.js'
import { color } from '../lib/colors.js'
import Envelopes from './Envelopes.jsx'

/**
 * A participant's private page. The link only holds a random token; the server
 * keeps the pick, the PIN and whether they already drew. So on ANY device:
 *   first open  → set a PIN → (optional) add up to 3 wishes → pick a letter → reveal
 *   later opens → enter the PIN → straight to the reveal (no second pick)
 * The reveal shows your pick's wishlist, and lets you edit your own.
 */
export default function PersonalDraw({ token, event }) {
  const [me, setMe] = useState(null) // { id, name, hasPin, drawn }
  const [step, setStep] = useState('loading') // loading | bad | setpin | locked | wishlist | envelopes | reveal
  const [pin, setPin] = useState('') // kept in memory after unlocking, for the draw call
  const [recipient, setRecipient] = useState(null)
  const [myWishlist, setMyWishlist] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    api(`/p/${token}`)
      .then((d) => {
        setMe(d)
        setStep(d.hasPin ? 'locked' : 'setpin')
      })
      .catch((e) => {
        setError(e.message)
        setStep('bad')
      })
  }, [token])

  // One envelope per other participant.
  const others = useMemo(
    () => event.participants.map((p, i) => ({ ...p, color: color(i) })).filter((p) => p.id !== me?.id),
    [event, me],
  )

  async function savePin(newPin) {
    try {
      await api(`/p/${token}/pin`, { method: 'POST', body: { pin: newPin } })
      setPin(newPin)
      setStep('wishlist')
    } catch (e) {
      if (e.status === 409) setStep('locked') // someone already set it (e.g. on another device)
      throw e
    }
  }

  async function unlock(enteredPin) {
    const d = await api(`/p/${token}/unlock`, { method: 'POST', body: { pin: enteredPin } })
    setPin(enteredPin)
    setMyWishlist(d.me?.wishlist ?? [])
    if (d.drawn) {
      setRecipient(d.recipient)
      setStep('reveal')
    } else {
      setStep('envelopes')
    }
  }

  async function saveWishlist(items) {
    const d = await api(`/p/${token}/wishlist`, { method: 'POST', body: { pin, items } })
    setMyWishlist(d.wishlist)
  }

  // Called when an envelope is opened. Returns the recipient id, or null on error.
  async function draw() {
    try {
      const d = await api(`/p/${token}/draw`, { method: 'POST', body: { pin } })
      setRecipient(d.recipient)
      return d.recipient.id
    } catch (e) {
      setError(e.message)
      return null
    }
  }

  if (step === 'loading') return <div className="loading-inline">🎁</div>

  if (step === 'bad') {
    return (
      <section className="card center narrow">
        <div className="big-emoji">🤔</div>
        <h2>Can’t open this link</h2>
        <p className="muted">{error || 'Please ask the organizer to send your bunutan link again.'}</p>
      </section>
    )
  }

  if (step === 'setpin') return <SetPin name={me.name} onSave={savePin} />
  if (step === 'locked') return <Unlock name={me.name} onUnlock={unlock} />

  if (step === 'wishlist') {
    return (
      <section className="card center narrow">
        <div className="big-emoji">📝</div>
        <h2>Your wishlist</h2>
        <p className="muted">
          Add up to 3 gift ideas. Whoever picks you will see them. You can change them anytime.
        </p>
        <WishlistEditor
          initial={myWishlist}
          saveLabel="Save & pick a letter"
          onSave={async (items) => {
            await saveWishlist(items)
            setStep('envelopes')
          }}
        />
        <button className="link" onClick={() => setStep('envelopes')}>
          Skip for now →
        </button>
      </section>
    )
  }

  if (step === 'envelopes') {
    return (
      <section className="card center">
        <h2>Pick a letter, {me.name} 💌</h2>
        <p className="muted">Make sure nobody is looking 👀</p>
        <Envelopes
          count={others.length}
          onPick={draw}
          nameOf={(id) => (id === recipient?.id ? recipient.name : '')}
          onDone={() => setStep('reveal')}
        />
        {error && <p className="error">{error}</p>}
      </section>
    )
  }

  return (
    <section className="card center reveal">
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 24 }, (_, i) => (
          <i key={i} style={{ '--i': i }} />
        ))}
      </div>
      <p className="muted">{me.name}, your monito/monita is…</p>
      <h1 className="recipient">🎁 {recipient.name}</h1>
      {recipient.wishlist.length > 0 ? (
        <div className="wishlist-box">
          <strong>🎁 {recipient.name}’s wishlist</strong>
          <ol>
            {recipient.wishlist.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="muted">{recipient.name} hasn’t added a wishlist yet. Check back later, or surprise them!</p>
      )}
      {event.budget && <p className="muted">Budget: {event.budget}</p>}
      <p className="note">🤫 Keep it secret! Open this link again anytime and enter your PIN to check.</p>

      <div className="my-wishlist">
        <h3>📝 Your wishlist</h3>
        <p className="muted small">Up to 3 ideas for whoever picked you.</p>
        <WishlistEditor initial={myWishlist} saveLabel="Save my wishlist" onSave={saveWishlist} />
      </div>
    </section>
  )
}

const MAX_WISHES = 3
const MAX_WISH_LENGTH = 300

/** Three text boxes for gift ideas. Empty boxes are ignored. */
function WishlistEditor({ initial, saveLabel, onSave }) {
  const [items, setItems] = useState(() => [...initial, '', '', ''].slice(0, MAX_WISHES))
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  const change = (i, value) => {
    setItems((list) => list.map((x, j) => (j === i ? value : x)))
    setSaved(false)
  }

  return (
    <form
      className="wishlist-form"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError('')
        try {
          await onSave(items.map((x) => x.trim()).filter(Boolean))
          setSaved(true)
        } catch (err) {
          setError(err.message)
        } finally {
          setBusy(false)
        }
      }}
    >
      {items.map((value, i) => (
        <label key={i} className="wish-field">
          <span className="wish-label">
            Wish {i + 1}
            <small className={value.length > MAX_WISH_LENGTH - 30 ? 'count near' : 'count'}>
              {value.length}/{MAX_WISH_LENGTH}
            </small>
          </span>
          <textarea
            value={value}
            rows={2}
            maxLength={MAX_WISH_LENGTH}
            placeholder={
              [
                'e.g. Scented candle (vanilla or lavender)',
                'e.g. Coffee mug, any color but pink',
                'e.g. A mystery novel or a cozy book',
              ][i]
            }
            onChange={(e) => change(i, e.target.value)}
          />
        </label>
      ))}
      {error && <p className="error">{error}</p>}
      <button className="btn" type="submit" disabled={busy}>
        {saved ? '✓ Saved' : saveLabel}
      </button>
    </form>
  )
}

function SetPin({ name, onSave }) {
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <section className="card center narrow">
      <h2>Hi {name}! 👋</h2>
      <p className="muted">First, set a 4-digit PIN. You’ll need it every time you open this link, on any phone.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (!/^\d{4}$/.test(pin)) return setError('PIN must be 4 digits.')
          if (pin !== confirm) return setError('The PINs don’t match. Try again.')
          setBusy(true)
          try {
            await onSave(pin)
          } catch (err) {
            setError(err.message)
            setBusy(false)
          }
        }}
      >
        <label className="pin-label">
          New PIN
          <PinInput value={pin} onChange={setPin} autoFocus />
        </label>
        <label className="pin-label">
          Type it again
          <PinInput value={confirm} onChange={setConfirm} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn big" type="submit" disabled={busy}>
          🔒 Save PIN
        </button>
      </form>
      <p className="muted small">Remember it! Nobody can see your PIN.</p>
    </section>
  )
}

function Unlock({ name, onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <section className="card center narrow">
      <div className="big-emoji">🔒</div>
      <h2>Welcome back, {name}!</h2>
      <p className="muted">Enter your 4-digit PIN to continue.</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            await onUnlock(pin)
          } catch (err) {
            setError(err.message)
            setPin('')
            setBusy(false)
          }
        }}
      >
        <PinInput value={pin} onChange={setPin} autoFocus />
        {error && <p className="error">{error}</p>}
        <button className="btn big" type="submit" disabled={busy || pin.length !== 4}>
          Unlock
        </button>
      </form>
    </section>
  )
}

function PinInput({ value, onChange, autoFocus }) {
  return (
    <input
      className="pin"
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={4}
      placeholder="••••"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
      autoFocus={autoFocus}
    />
  )
}
