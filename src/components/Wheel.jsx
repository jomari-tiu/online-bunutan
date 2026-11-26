import { useState } from 'react'

const SIZE = 320
const R = SIZE / 2
const SPIN_MS = 5000

const point = (deg, r = R - 4) => {
  const rad = (deg * Math.PI) / 180
  return [R + r * Math.sin(rad), R - r * Math.cos(rad)] // 0° = top, clockwise
}

/**
 * The winner comes from `onSpin()` (the server), then the wheel is rotated so
 * that slice lands under the pointer at the top.
 */
export default function Wheel({ options, onSpin, onDone }) {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const seg = 360 / options.length

  async function spin() {
    if (spinning) return
    setSpinning(true)
    const resultId = await onSpin() // the server decides; null means it failed
    const index = options.findIndex((o) => o.id === resultId)
    if (index < 0) return setSpinning(false)
    const jitter = (Math.random() - 0.5) * seg * 0.7
    const target = index * seg + seg / 2 + jitter // slice center, measured clockwise from the top
    const extra = (((-target - rotation) % 360) + 360) % 360
    setRotation(rotation + 360 * 6 + extra)
    setTimeout(onDone, SPIN_MS + 600)
  }

  return (
    <div className="wheel-wrap">
      <div className="pointer" aria-hidden="true">▼</div>
      <svg
        className="wheel"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{ transform: `rotate(${rotation}deg)`, transitionDuration: `${SPIN_MS}ms` }}
      >
        {options.length === 1 ? (
          <circle cx={R} cy={R} r={R - 4} fill={options[0].color} />
        ) : (
          options.map((o, i) => {
            const [x1, y1] = point(i * seg)
            const [x2, y2] = point((i + 1) * seg)
            const large = seg > 180 ? 1 : 0
            return (
              <path
                key={o.id}
                d={`M${R},${R} L${x1},${y1} A${R - 4},${R - 4} 0 ${large} 1 ${x2},${y2} Z`}
                fill={o.color}
                stroke="#fff"
                strokeWidth="2"
              />
            )
          })
        )}
        {options.map((o, i) => {
          const mid = i * seg + seg / 2
          const [x, y] = point(mid, R * 0.6)
          return (
            <text
              key={o.id}
              x={x}
              y={y}
              transform={`rotate(${mid - 90} ${x} ${y})`}
              textAnchor="middle"
              dominantBaseline="middle"
              className="wheel-label"
            >
              {o.name.length > 12 ? o.name.slice(0, 11) + '…' : o.name}
            </text>
          )
        })}
        <circle cx={R} cy={R} r="22" fill="#fff" stroke="#c1121f" strokeWidth="4" />
      </svg>
      <button className="btn big" onClick={spin} disabled={spinning}>
        {spinning ? 'Spinning…' : '🎡 SPIN!'}
      </button>
    </div>
  )
}
