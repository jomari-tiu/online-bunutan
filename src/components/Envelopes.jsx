import { useState } from 'react'

/**
 * Sealed envelopes, one per name still in the pool. The name inside is drawn
 * fairly at the moment you open one, so every envelope gives the same odds.
 */
export default function Envelopes({ count, onPick, nameOf, onDone }) {
  const [opened, setOpened] = useState(null) // { index, recipientId }

  function open(index) {
    if (opened) return
    const recipientId = onPick()
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
              <span className="letter">{isOpen ? nameOf(opened.recipientId) : ''}</span>
              <span className="seal">{isOpen ? '' : i + 1}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}
