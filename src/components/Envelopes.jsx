import { useState } from 'react'

/**
 * Sealed envelopes, one per other participant. Your pick was already made by
 * the organizer, so whichever envelope you open reveals it.
 */
export default function Envelopes({ count, onPick, nameOf, onDone }) {
  const [opened, setOpened] = useState(null) // { index, recipientId }

  async function open(index) {
    if (opened) return
    setOpened({ index, recipientId: null })
    const recipientId = await onPick() // the server decides; null means it failed
    if (!recipientId) return setOpened(null)
    setOpened({ index, recipientId })
    setTimeout(onDone, 2200)
  }

  return (
    <>
      <p className="muted">{opened ? 'Opening…' : `${count} sealed letters left. Trust your gut!`}</p>
      <div className="envelopes">
        {Array.from({ length: count }, (_, i) => {
          const isOpen = opened?.index === i
          return (
            <button
              key={i}
              className={'envelope' + (isOpen ? ' open' : '') + (opened && !isOpen ? ' faded' : '')}
              onClick={() => open(i)}
              disabled={Boolean(opened)}
              style={{ '--d': `${(i % 8) * 0.08}s` }}
            >
              <span className="flap" />
              <span className="letter">{isOpen && opened.recipientId ? nameOf(opened.recipientId) : ''}</span>
              <span className="seal">{isOpen ? '' : i + 1}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}
