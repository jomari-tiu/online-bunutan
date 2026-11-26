// Storage for the bunutan state: one JSON document { createdAt, people: { ... } }.
//
// Two places it can live, picked automatically:
//   • DATABASE_URL set (e.g. Neon on Render) → a single JSONB row in Postgres.
//     Each change runs in a transaction with a row lock, so simultaneous
//     requests (even from several server instances) can't overwrite each other.
//   • otherwise → a JSON file (data/db.json), handy for local development.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, 'data', 'db.json')
const PARTICIPANTS_FILE = process.env.PARTICIPANTS_FILE || path.join(ROOT, 'participants.json')
const DATABASE_URL = process.env.DATABASE_URL || ''
const TABLE = /^[a-z_][a-z0-9_]*$/.test(process.env.BUNUTAN_TABLE || '') ? process.env.BUNUTAN_TABLE : 'bunutan_state'

const EMPTY = () => ({ createdAt: null, people: {} })

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

const store = DATABASE_URL ? postgresStore(DATABASE_URL) : fileStore(DATA_FILE)

export const readDb = () => store.read()
/** Runs `fn(db)` on a copy, one change at a time, then saves. Returns what `fn` returns. */
export const updateDb = (fn) => store.update(fn)
/** Checks the storage can be written, so a bad setup shows in the logs and /api/health. */
export const checkStorage = () => store.check()

// ---------------------------------------------------------------- Postgres (Neon)

function postgresStore(url) {
  // Neon URLs say sslmode=require; pg treats that as full certificate checks but
  // warns about a future change. Ask for verify-full explicitly: same security, no warning.
  url = url.replace(/sslmode=(require|prefer|verify-ca)/, 'sslmode=verify-full')
  const pool = new pg.Pool({
    connectionString: url,
    max: 5,
    // Neon requires SSL. Keep any sslmode in the URL, otherwise turn SSL on.
    ssl: /sslmode=disable/.test(url) || /@(localhost|127\.0\.0\.1)[:/]/.test(url) ? false : { rejectUnauthorized: true },
  })
  pool.on('error', (err) => console.error('Postgres pool error:', err.message))

  let ready = null
  const init = () =>
    (ready ??= pool
      .query(
        `CREATE TABLE IF NOT EXISTS ${TABLE} (
           id         int PRIMARY KEY,
           data       jsonb NOT NULL,
           updated_at timestamptz NOT NULL DEFAULT now()
         );
         INSERT INTO ${TABLE} (id, data) VALUES (1, '${JSON.stringify(EMPTY())}') ON CONFLICT (id) DO NOTHING;`,
      )
      .catch((err) => {
        ready = null // retry on the next request
        throw storageError(err, 'the database')
      }))

  return {
    async read() {
      await init()
      const { rows } = await pool.query(`SELECT data FROM ${TABLE} WHERE id = 1`)
      return rows[0]?.data ?? EMPTY()
    },

    async update(fn) {
      await init()
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const { rows } = await client.query(`SELECT data FROM ${TABLE} WHERE id = 1 FOR UPDATE`)
        const db = rows[0]?.data ?? EMPTY()
        const result = await fn(db)
        await client.query(`UPDATE ${TABLE} SET data = $1, updated_at = now() WHERE id = 1`, [db])
        await client.query('COMMIT')
        return result
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw err.expose ? err : err.code ? storageError(err, 'the database') : err
      } finally {
        client.release()
      }
    },

    async check() {
      try {
        await init()
        await pool.query('SELECT 1')
        return { ok: true, type: 'postgres' }
      } catch (err) {
        return { ok: false, type: 'postgres', error: err.expose ? err.message : storageError(err, 'the database').message }
      }
    },
  }
}

// ---------------------------------------------------------------- JSON file (local dev)

function fileStore(file) {
  let cache = null
  let queue = Promise.resolve()

  async function read() {
    if (cache) return cache
    try {
      cache = JSON.parse(await fs.readFile(file, 'utf8'))
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
      cache = EMPTY()
    }
    return cache
  }

  return {
    read,

    update(fn) {
      const run = queue.then(async () => {
        const db = structuredClone(await read())
        const result = await fn(db)
        try {
          // Write a temp file, then rename, so a crash can't leave a half-written file.
          await fs.mkdir(path.dirname(file), { recursive: true })
          const tmp = `${file}.${process.pid}.tmp`
          await fs.writeFile(tmp, JSON.stringify(db, null, 2))
          await fs.rename(tmp, file)
        } catch (err) {
          throw storageError(err, file)
        }
        cache = db
        return result
      })
      queue = run.catch(() => {})
      return run
    },

    async check() {
      const probe = path.join(path.dirname(file), `.write-test-${process.pid}`)
      try {
        await fs.mkdir(path.dirname(file), { recursive: true })
        await fs.writeFile(probe, 'ok')
        await fs.rm(probe)
        return { ok: true, type: 'file', file }
      } catch (err) {
        return { ok: false, type: 'file', file, error: storageError(err, file).message }
      }
    },
  }
}

function storageError(err, where) {
  const hint =
    where === 'the database'
      ? 'Check DATABASE_URL (copy the connection string from Neon).'
      : 'Set DATABASE_URL to use Postgres, or point DATA_FILE at a writable folder.'
  const e = new Error(`Can’t save data to ${where} (${err.code || err.message}). ${hint}`)
  e.expose = true // safe to show: it's a setup problem, not user data
  return e
}
