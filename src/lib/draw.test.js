import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { generateAssignment, isValidAssignment } from './draw.js'
import { decodeToken, encodeToken } from './token.js'

const config = JSON.parse(readFileSync(new URL('../participants.json', import.meta.url), 'utf8'))
const slug = (n) => n.trim().toLowerCase().replace(/\s+/g, '-')
const IDS = config.participants.map(slug)
const PRESET = Object.fromEntries((config.alreadyPicked || []).map((d) => [slug(d.giver), slug(d.recipient)]))

test('real list: 1,000 generations are all complete, unique and never self', () => {
  for (let i = 0; i < 1000; i++) {
    const pairs = generateAssignment(IDS, PRESET)
    assert.ok(isValidAssignment(IDS, pairs))
    const recipients = Object.values(pairs)
    assert.equal(new Set(recipients).size, IDS.length, 'a name was picked twice')
    for (const g of IDS) assert.notEqual(pairs[g], g, `${g} got themselves`)
  }
})

test('Jekisa always keeps Mama, and nobody else ever gets Mama', () => {
  for (let i = 0; i < 1000; i++) {
    const pairs = generateAssignment(IDS, PRESET)
    assert.equal(pairs.jekisa, 'mama')
    for (const g of IDS) if (g !== 'jekisa') assert.notEqual(pairs[g], 'mama')
  }
})

test('Jomari always keeps Noli, and nobody else ever gets Noli', () => {
  for (let i = 0; i < 1000; i++) {
    const pairs = generateAssignment(IDS, PRESET)
    assert.equal(pairs.jomari, 'noli')
    for (const g of IDS) if (g !== 'jomari') assert.notEqual(pairs[g], 'noli')
  }
})

test('drawing "at the same time": every link reveals a different name', () => {
  // Every phone just decodes its own link, so opening them all at once is the
  // same as opening them one by one: no two links can show the same name.
  const pairs = generateAssignment(IDS, PRESET)
  const links = IDS.map((g) => encodeToken(g, pairs[g]))
  const revealed = links.map((t) => decodeToken(t)) // all "at once"
  assert.equal(new Set(revealed.map((d) => d.r)).size, IDS.length)
  revealed.forEach((d, i) => assert.equal(d.g, IDS[i]))
})

test('the link does not show the recipient name in plain text', () => {
  const t = encodeToken('jomari', 'trixie')
  assert.ok(!t.toLowerCase().includes('trixie'))
  assert.deepEqual(decodeToken(t), { v: 1, g: 'jomari', r: 'trixie' })
  assert.equal(decodeToken('garbage!!'), null)
})

test('every group size from 2 to 20 works', () => {
  for (let n = 2; n <= 20; n++) {
    const ids = Array.from({ length: n }, (_, i) => 'p' + i)
    for (let i = 0; i < 100; i++) assert.ok(isValidAssignment(ids, generateAssignment(ids)))
  }
})

test('bad preset picks are rejected', () => {
  assert.throws(() => generateAssignment(['a', 'b', 'c'], { a: 'a' }))
  assert.throws(() => generateAssignment(['a', 'b', 'c'], { a: 'b', c: 'b' }))
  assert.throws(() => generateAssignment(['a', 'b', 'c'], { a: 'zed' }))
})
