// JSON-file storage. No database: everything lives in one file (data/db.json).
// Writes go through a queue and are written to a temp file first, then renamed,
// so two requests at the same time can't corrupt the file.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, 'data', 'db.json')
const PARTICIPANTS_FILE = process.env.PARTICIPANTS_FILE || path.join(ROOT, 'participants.json')

export const slug = (name) => name.trim().toLowerCase().replace(/\s+/g, '-')

/** Reads participants.json on every call, so edits apply without a restart. */
export async function loadConfig() {
  const config = JSON.parse(await fs.readFile(PARTICIPANTS_FILE, 'utf8'))
  const participants = config.participants
    .map((p) => (typeof p === 'string' ? { name: p } : p))
    .filter((p) => p && String(p.name || '').trim())
    .map((p) => ({ id: slug(p.name), name: p.name.trim(), wishlist: p.wishlist || '' }))
  return {
    eventName: config.eventName || 'Bunutan',
    budget: config.budget || '',
    exchangeDate: config.exchangeDate || '',
    participants,
    preset: Object.fromEntries((config.alreadyPicked || []).map((d) => [slug(d.giver), slug(d.recipient)])),
  }
}

let cache = null
let queue = Promise.resolve()

export async function readDb() {
  if (cache) return cache
  try {
    cache = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'))
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
    cache = { createdAt: null, people: {} }
  }
  return cache
}

/** Runs `fn(db)` on a copy, one at a time, then saves. Returns what `fn` returns. */
export function updateDb(fn) {
  const run = queue.then(async () => {
    const db = structuredClone(await readDb())
    const result = await fn(db)
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true })
    const tmp = `${DATA_FILE}.${process.pid}.tmp`
    await fs.writeFile(tmp, JSON.stringify(db, null, 2))
    await fs.rename(tmp, DATA_FILE)
    cache = db
    return result
  })
  queue = run.catch(() => {})
  return run
}
