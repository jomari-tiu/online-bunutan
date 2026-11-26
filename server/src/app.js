import crypto from 'node:crypto'
import express from 'express'
import cors from 'cors'
import { generateAssignment } from './draw.js'
import { checkStorage, loadConfig, readDb, updateDb } from './store.js'

/*
 * data/db.json looks like:
 * {
 *   "createdAt": "...",
 *   "people": {
 *     "jomari": { "token": "random", "recipientId": "noli", "pinHash": "...", "pinSalt": "...", "drawnAt": "..." }
 *   }
 * }
 * A link only carries the random token; the pick never leaves the server until
 * the right PIN is given.
 */

const MAX_WISHES = 3
const MAX_WISH_LENGTH = 100

export function createApp({ corsOrigin = '*' } = {}) {
  const app = express()
  // CORS_ORIGIN: your frontend's address(es). A trailing "/" is ignored, since browsers never send one.
  const origins = corsOrigin.split(',').map((s) => s.trim().replace(/\/+$/, ''))
  app.use(cors({ origin: corsOrigin === '*' ? true : origins }))
  app.use(express.json({ limit: '10kb' }))

  const fail = (res, status, error) => res.status(status).json({ error })

  // ---------- public ----------

  // Also reports whether the JSON file can be saved (the usual cause of a 500 on a new deploy).
  app.get('/api/health', async (req, res) => {
    const storage = await checkStorage()
    res.status(storage.ok ? 200 : 500).json({ ok: storage.ok, storage })
  })

  // Event info + names for the welcome page. Each name carries its link token so
  // people can tap their own name (token is null until the organizer generates pairs).
  app.get('/api/event', async (req, res) => {
    const [{ eventName, budget, exchangeDate, participants }, db] = await Promise.all([loadConfig(), readDb()])
    res.json({
      eventName,
      budget,
      exchangeDate,
      started: Object.keys(db.people).length > 0,
      participants: participants.map(({ id, name }) => ({
        id,
        name,
        token: db.people[id]?.token ?? null,
        hasPin: Boolean(db.people[id]?.pinHash),
      })),
    })
  })

  // ---------- participant (by private link token) ----------

  async function findByToken(token) {
    const db = await readDb()
    const entry = Object.entries(db.people).find(([, p]) => p.token === token)
    return entry ? { id: entry[0], person: entry[1] } : null
  }

  // Wrong-PIN protection: 5 misses locks that link for 5 minutes.
  const misses = new Map()
  function lockedOut(token) {
    const m = misses.get(token)
    return m && m.count >= 5 && Date.now() < m.until
  }
  function miss(token) {
    const m = misses.get(token) || { count: 0, until: 0 }
    if (Date.now() >= m.until && m.count >= 5) m.count = 0
    m.count++
    m.until = Date.now() + 5 * 60 * 1000
    misses.set(token, m)
  }

  /** Loads the person for :token and checks the PIN. On failure it sends the error and returns null. */
  async function withPin(req, res) {
    const found = await findByToken(req.params.token)
    const stop = (status, error) => (fail(res, status, error), null)
    if (!found) return stop(404, 'This link doesn’t look right. Ask the organizer to send it again.')
    if (!found.person.pinHash) return stop(409, 'No PIN set yet.')
    if (lockedOut(req.params.token)) return stop(429, 'Too many wrong tries. Wait 5 minutes and try again.')
    if (!pinMatches(String(req.body?.pin ?? ''), found.person)) {
      miss(req.params.token)
      return stop(401, 'Wrong PIN. Try again.')
    }
    misses.delete(req.params.token)
    return found
  }

  // A person's wishlist: what they saved themselves, else the optional one in participants.json.
  async function wishlistOf(id) {
    const [db, { participants }] = await Promise.all([readDb(), loadConfig()])
    const saved = db.people[id]?.wishlist
    if (Array.isArray(saved)) return saved
    const fromConfig = participants.find((x) => x.id === id)?.wishlist
    return fromConfig ? [String(fromConfig)] : []
  }

  async function recipientInfo(id) {
    const { participants } = await loadConfig()
    const p = participants.find((x) => x.id === id)
    return { id, name: p?.name ?? id, wishlist: await wishlistOf(id) }
  }

  app.get('/api/p/:token', async (req, res) => {
    const found = await findByToken(req.params.token)
    if (!found) return fail(res, 404, 'This link doesn’t look right. Ask the organizer to send it again.')
    const { participants } = await loadConfig()
    const me = participants.find((p) => p.id === found.id)
    res.json({ id: found.id, name: me?.name ?? found.id, hasPin: Boolean(found.person.pinHash), drawn: Boolean(found.person.drawnAt) })
  })

  // First open: set the PIN. Only works once per link, from any device.
  app.post('/api/p/:token/pin', async (req, res) => {
    const pin = String(req.body?.pin ?? '')
    if (!/^\d{4}$/.test(pin)) return fail(res, 400, 'PIN must be 4 digits.')
    const result = await updateDb((db) => {
      const entry = Object.entries(db.people).find(([, p]) => p.token === req.params.token)
      if (!entry) return 'missing'
      if (entry[1].pinHash) return 'taken'
      Object.assign(entry[1], hashPin(pin), { openedAt: new Date().toISOString() })
      return 'ok'
    })
    if (result === 'missing') return fail(res, 404, 'This link doesn’t look right. Ask the organizer to send it again.')
    if (result === 'taken') return fail(res, 409, 'A PIN was already set for this link. Enter it to continue.')
    res.json({ ok: true })
  })

  // Later opens: check the PIN. If they already drew, return the pick (no second pick).
  app.post('/api/p/:token/unlock', async (req, res) => {
    const found = await withPin(req, res)
    if (!found) return
    const drawn = Boolean(found.person.drawnAt)
    res.json({
      drawn,
      recipient: drawn ? await recipientInfo(found.person.recipientId) : null,
      me: { wishlist: await wishlistOf(found.id) },
    })
  })

  // Save your own wishlist (up to 3 items). The person who picked you sees it.
  app.post('/api/p/:token/wishlist', async (req, res) => {
    const items = req.body?.items
    if (!Array.isArray(items) || items.some((x) => typeof x !== 'string')) {
      return fail(res, 400, 'Wishlist must be a list of text items.')
    }
    const clean = items.map((x) => x.trim().replace(/\s+/g, ' ')).filter(Boolean)
    if (clean.length > MAX_WISHES) return fail(res, 400, `You can add up to ${MAX_WISHES} wishes.`)
    if (clean.some((x) => x.length > MAX_WISH_LENGTH)) {
      return fail(res, 400, `Each wish can be up to ${MAX_WISH_LENGTH} characters.`)
    }
    const found = await withPin(req, res)
    if (!found) return
    await updateDb((db) => {
      if (db.people[found.id]) db.people[found.id].wishlist = clean
    })
    res.json({ wishlist: clean })
  })

  // Open an envelope: marks the draw as done and reveals the pick.
  app.post('/api/p/:token/draw', async (req, res) => {
    const found = await withPin(req, res)
    if (!found) return
    const alreadyDrawn = Boolean(found.person.drawnAt)
    if (!alreadyDrawn) {
      await updateDb((db) => {
        const p = db.people[found.id]
        if (p && !p.drawnAt) p.drawnAt = new Date().toISOString()
      })
    }
    res.json({ alreadyDrawn, recipient: await recipientInfo(found.person.recipientId) })
  })

  // ---------- organizer ----------

  function upToDate(db, config) {
    const ids = config.participants.map((p) => p.id)
    const stored = Object.keys(db.people)
    return (
      stored.length === ids.length &&
      ids.every((id) => db.people[id]) &&
      Object.entries(config.preset).every(([g, r]) => db.people[g]?.recipientId === r)
    )
  }

  // Lists links and status (PIN set / drawn). Never includes who picked whom.
  app.get('/api/admin/status', async (req, res) => {
    const [db, config] = await Promise.all([readDb(), loadConfig()])
    const generated = Object.keys(db.people).length > 0
    res.json({
      generated,
      upToDate: generated && upToDate(db, config),
      createdAt: db.createdAt,
      people: config.participants.map((p) => {
        const d = db.people[p.id]
        return { id: p.id, name: p.name, token: d?.token ?? null, hasPin: Boolean(d?.pinHash), drawn: Boolean(d?.drawnAt) }
      }),
    })
  })

  // Makes every pair at once. Refuses to overwrite pairs once anyone has drawn.
  app.post('/api/admin/generate', async (req, res) => {
    const config = await loadConfig()
    const result = await updateDb((db) => {
      const generated = Object.keys(db.people).length > 0
      if (generated && upToDate(db, config)) return 'exists'
      if (Object.values(db.people).some((p) => p.drawnAt)) return 'started'
      const ids = config.participants.map((p) => p.id)
      const pairs = generateAssignment(ids, config.preset)
      db.createdAt = new Date().toISOString()
      db.people = Object.fromEntries(
        ids.map((id) => [id, { token: crypto.randomBytes(12).toString('base64url'), recipientId: pairs[id] }]),
      )
      return 'ok'
    })
    if (result === 'exists') return fail(res, 409, 'Pairs already exist. Links you sent still work.')
    if (result === 'started') return fail(res, 409, 'Someone has already drawn, so the pairs can’t be changed.')
    res.json({ ok: true })
  })

  app.use((err, req, res, next) => {
    console.error(err)
    fail(res, 500, err.expose ? err.message : 'Something went wrong on the server.')
  })

  return app
}

function hashPin(pin) {
  const pinSalt = crypto.randomBytes(16).toString('hex')
  return { pinSalt, pinHash: crypto.scryptSync(pin, pinSalt, 32).toString('hex') }
}

function pinMatches(pin, person) {
  if (!/^\d{4}$/.test(pin)) return false
  const a = crypto.scryptSync(pin, person.pinSalt, 32)
  const b = Buffer.from(person.pinHash, 'hex')
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
