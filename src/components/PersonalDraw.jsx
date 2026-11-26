import { useMemo, useState } from 'react'
import { BY_ID, EVENT, PARTICIPANTS } from '../lib/storage.js'
import { decodeToken } from '../lib/token.js'
import { color } from '../lib/colors.js'
import Wheel from './Wheel.jsx'
import Envelopes from './Envelopes.jsx'

/**
 * A participant's private page. The answer is already inside the link, chosen
 * by the organizer when all pairs were generated together. The wheel and the
 * envelopes only reveal it, so phones never have to check each other.
 */
export default function PersonalDraw({ token }) {
  const data = useMemo(() => decodeToken(token), [token])
  const giver = data && BY_ID[data.g]
  const recipient = data && BY_ID[data.r]
  const seenKey = `bunutan:seen:${token}`
  const [step, setStep] = useState(() => (wasSeen(seenKey) ? 'reveal' : 'intro'))

  // Everyone except yourself, for the wheel and the envelopes.
  const others = useMemo(
    () => PARTICIPANTS.map((p, i) => ({ ...p, color: color(i) })).filter((p) => p.id !== data?.g),
    [data],
  )

  if (!giver || !recipient || giver.id === recipient.id) {
    return (
      <section className="card center narrow">
        <div className="big-emoji">🤔</div>
        <h2>This link doesn’t look right</h2>
        <p className="muted">Please ask the organizer to send your bunutan link again.</p>
      </section>
    )
  }

  const reveal = () => {
    try {
      localStorage.setItem(seenKey, '1')
    } catch {
      /* fine: the link always shows the same answer anyway */
    }
    setStep('reveal')
  }

  if (step === 'intro') {
    return (
      <section className="card center">
        <h2>Hi {giver.name}! 👋</h2>
        <p className="muted">Make sure nobody is looking 👀 How do you want to pick?</p>
        <div className="methods">
          <button className="method" onClick={() => setStep('wheel')}>
            <span className="big-emoji">🎡</span>
            <strong>Spin the wheel</strong>
            <small>Let fate decide</small>
          </button>
          <button className="method" onClick={() => setStep('envelopes')}>
            <span className="big-emoji">💌</span>
            <strong>Pick a letter</strong>
            <small>Choose one sealed envelope</small>
          </button>
        </div>
      </section>
    )
  }

  if (step === 'wheel') {
    return (
      <section className="card center">
        <h2>Spin it, {giver.name}! 🎡</h2>
        <Wheel options={others} onSpin={() => recipient.id} onDone={reveal} />
      </section>
    )
  }

  if (step === 'envelopes') {
    return (
      <section className="card center">
        <h2>Pick a letter, {giver.name} 💌</h2>
        <Envelopes count={others.length} onPick={() => recipient.id} nameOf={(id) => BY_ID[id].name} onDone={reveal} />
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
      <p className="muted">{giver.name}, your monito/monita is…</p>
      <h1 className="recipient">🎁 {recipient.name}</h1>
      {recipient.wishlist ? (
        <p className="wishlist">
          <strong>Wishlist:</strong> {recipient.wishlist}
        </p>
      ) : (
        <p className="muted">No wishlist given. Surprise them!</p>
      )}
      {EVENT.budget && <p className="muted">Budget: {EVENT.budget}</p>}
      <p className="note">🤫 Keep it secret! You can open this link again anytime to check.</p>
    </section>
  )
}

function wasSeen(key) {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}
