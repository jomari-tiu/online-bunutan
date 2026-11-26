// End-to-end tests of the API against a throwaway JSON file.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bunutan-'))
process.env.DATA_FILE = path.join(dir, 'db.json')
const { createApp } = await import('./app.js')

let server, base

before(async () => {
  server = createApp().listen(0)
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${server.address().port}/api`
})
after(() => {
  server.closeAllConnections()
  server.close()
  fs.rmSync(dir, { recursive: true, force: true })
})

async function call(method, url, body) {
  const res = await fetch(base + url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, data: await res.json() }
}

let links // name -> token

test('organizer generates all pairs once; status never shows who picked whom', async () => {
  assert.equal((await call('POST', '/admin/generate', {})).status, 200)
  assert.equal((await call('POST', '/admin/generate', {})).status, 409, 'second generate must be refused')
  const { data } = await call('GET', '/admin/status')
  assert.equal(data.people.length, 16)
  assert.ok(!JSON.stringify(data).includes('recipient'))
  links = Object.fromEntries(data.people.map((p) => [p.name, p.token]))
})

test('welcome page: every name has its link, and no picks are included', async () => {
  const { data } = await call('GET', '/event')
  assert.equal(data.started, true)
  for (const p of data.participants) assert.equal(p.token, links[p.name])
  assert.ok(!JSON.stringify(data).includes('recipient'))
})

test('opening a link does not reveal the pick before a PIN', async () => {
  const { data } = await call('GET', `/p/${links.Jomari}`)
  assert.deepEqual({ name: data.name, hasPin: data.hasPin, drawn: data.drawn }, { name: 'Jomari', hasPin: false, drawn: false })
  assert.ok(!JSON.stringify(data).includes('Noli'))
})

test('your scenario: spin on phone A, open on phone B → PIN asked, no second spin', async () => {
  // Phone A: first open, set PIN, spin.
  assert.equal((await call('POST', `/p/${links.Jomari}/pin`, { pin: '1234' })).status, 200)
  const spin = await call('POST', `/p/${links.Jomari}/draw`, { pin: '1234' })
  assert.equal(spin.data.recipient.name, 'Noli')
  assert.equal(spin.data.alreadyDrawn, false)

  // Phone B: same link. Server says a PIN exists and the draw is done.
  const open = await call('GET', `/p/${links.Jomari}`)
  assert.equal(open.data.hasPin, true)
  assert.equal(open.data.drawn, true)

  // Phone B can't set a new PIN to sneak in.
  assert.equal((await call('POST', `/p/${links.Jomari}/pin`, { pin: '0000' })).status, 409)

  // Wrong PIN → nothing revealed. Right PIN → same pick, marked as already drawn.
  const wrong = await call('POST', `/p/${links.Jomari}/unlock`, { pin: '9999' })
  assert.equal(wrong.status, 401)
  assert.ok(!JSON.stringify(wrong.data).includes('Noli'))
  const unlock = await call('POST', `/p/${links.Jomari}/unlock`, { pin: '1234' })
  assert.equal(unlock.data.drawn, true)
  assert.equal(unlock.data.recipient.name, 'Noli')
})

test('5 wrong PINs lock the link for a while', async () => {
  await call('POST', `/p/${links.Cindy}/pin`, { pin: '4321' })
  for (let i = 0; i < 5; i++) await call('POST', `/p/${links.Cindy}/unlock`, { pin: '0000' })
  assert.equal((await call('POST', `/p/${links.Cindy}/unlock`, { pin: '4321' })).status, 429)
})

test('two phones setting a PIN at the same moment: only one wins', async () => {
  const [a, b] = await Promise.all([
    call('POST', `/p/${links.Dustin}/pin`, { pin: '1111' }),
    call('POST', `/p/${links.Dustin}/pin`, { pin: '2222' }),
  ])
  assert.deepEqual([a.status, b.status].sort(), [200, 409])
})

test('everyone draws at the same time: all 16 picks are different, presets kept', async () => {
  const names = Object.keys(links).filter((n) => !['Jomari', 'Cindy', 'Dustin'].includes(n))
  await Promise.all(names.map((n) => call('POST', `/p/${links[n]}/pin`, { pin: '5555' })))
  const results = await Promise.all(names.map((n) => call('POST', `/p/${links[n]}/draw`, { pin: '5555' })))
  const picks = Object.fromEntries(names.map((n, i) => [n, results[i].data.recipient.name]))
  picks.Jomari = 'Noli'
  picks.Cindy = (await call('POST', `/p/${links.Cindy}/draw`, { pin: '4321' })).data.recipient?.name
  picks.Dustin = (await call('POST', `/p/${links.Dustin}/draw`, { pin: '1111' })).data.recipient?.name ??
    (await call('POST', `/p/${links.Dustin}/draw`, { pin: '2222' })).data.recipient.name
  assert.equal(picks.Jekisa, 'Mama')
  for (const [g, r] of Object.entries(picks)) assert.notEqual(g, r)
  // Cindy is locked out from the previous test, so only check the rest are unique.
  const known = Object.values(picks).filter(Boolean)
  assert.equal(new Set(known).size, known.length)
})

test('pairs can’t be regenerated once people have drawn', async () => {
  const { status } = await call('POST', '/admin/generate', {})
  assert.equal(status, 409)
})

test('the JSON file on disk holds the data', () => {
  const db = JSON.parse(fs.readFileSync(process.env.DATA_FILE, 'utf8'))
  assert.equal(Object.keys(db.people).length, 16)
  assert.ok(db.people.jomari.drawnAt)
  assert.ok(!JSON.stringify(db).includes('"1234"'), 'PINs must not be stored as typed')
})
