import config from '../participants.json'
import { encodeToken } from './token.js'

export const slug = (name) => name.trim().toLowerCase().replace(/\s+/g, '-')

/** Participants come from src/participants.json. Entries can be "Name" or { "name": "...", "wishlist": "..." }. */
export const PARTICIPANTS = config.participants
  .map((p) => (typeof p === 'string' ? { name: p } : p))
  .filter((p) => p && String(p.name || '').trim())
  .map((p) => ({ id: slug(p.name), name: p.name.trim(), wishlist: p.wishlist || '' }))

export const IDS = PARTICIPANTS.map((p) => p.id)
export const BY_ID = Object.fromEntries(PARTICIPANTS.map((p) => [p.id, p]))

export const EVENT = {
  eventName: config.eventName || 'Bunutan',
  budget: config.budget || '',
  exchangeDate: config.exchangeDate || '',
}

/** Picks made before using the app ("alreadyPicked" in participants.json), as { giverId: recipientId }. */
export const PRESET = Object.fromEntries((config.alreadyPicked || []).map((d) => [slug(d.giver), slug(d.recipient)]))

// The organizer's generated pairs live only on the organizer's device.
const KEY = 'bunutan:v3:assignment'

export function loadAssignment() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null
  } catch {
    return null
  }
}

export function saveAssignment(assignment) {
  try {
    if (assignment) localStorage.setItem(KEY, JSON.stringify(assignment))
    else localStorage.removeItem(KEY)
  } catch {
    /* blocked storage: use Export JSON as a backup */
  }
}

export function linkFor(giverId, recipientId) {
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}#/p/${encodeToken(giverId, recipientId)}`
}

export function formatDate(d) {
  const date = new Date(d + 'T00:00:00')
  return isNaN(date) ? d : date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
}
