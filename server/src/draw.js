// Pure draw logic — no React, so it can be unit tested with `node --test`.

/**
 * Makes the whole bunutan in one go, on one device: every giver gets exactly
 * one recipient, every name is received exactly once, and nobody gets
 * themselves. `preset` holds picks that were already made ({ giver: recipient }).
 *
 * Because everything is decided here, at once, two phones drawing "at the same
 * time" later can never collide: each phone only reveals its own answer.
 */
export function generateAssignment(ids, preset = {}, rng = Math.random) {
  const all = new Set(ids)
  const usedRecipients = new Set()
  for (const [g, r] of Object.entries(preset)) {
    if (!all.has(g) || !all.has(r)) throw new Error('A preset pick uses a name that isn’t in the participant list.')
    if (g === r) throw new Error('A preset pick has someone picking themselves.')
    if (usedRecipients.has(r)) throw new Error('Two preset picks have the same recipient.')
    usedRecipients.add(r)
  }

  const givers = ids.filter((id) => !(id in preset))
  const recipients = ids.filter((id) => !usedRecipients.has(id))

  // Shuffle until nobody has themselves. Every valid result is equally likely.
  for (let attempt = 0; attempt < 10000; attempt++) {
    const shuffled = shuffle(recipients, rng)
    if (givers.every((g, i) => g !== shuffled[i])) {
      const pairs = { ...preset }
      givers.forEach((g, i) => (pairs[g] = shuffled[i]))
      return pairs
    }
  }
  throw new Error('Could not make valid pairs with these preset picks.')
}

/** True when `pairs` is a complete, valid bunutan for `ids`. */
export function isValidAssignment(ids, pairs) {
  if (!pairs) return false
  const recipients = ids.map((g) => pairs[g])
  return (
    Object.keys(pairs).length === ids.length &&
    recipients.every((r, i) => r && r !== ids[i] && ids.includes(r)) &&
    new Set(recipients).size === ids.length
  )
}

function shuffle(list, rng) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
