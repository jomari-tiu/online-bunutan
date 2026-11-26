// A personal link carries only its owner's pair: { g: giverId, r: recipientId }.
// It is scrambled so the answer isn't readable in the URL before you draw.
// This is not real encryption; it only keeps the surprise.

const KEY = 'bunutan-🎁'

function xor(bytes) {
  const k = new TextEncoder().encode(KEY)
  return bytes.map((b, i) => b ^ k[i % k.length])
}

export function encodeToken(giverId, recipientId) {
  const bytes = xor(new TextEncoder().encode(JSON.stringify({ v: 1, g: giverId, r: recipientId })))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeToken(token) {
  try {
    const bin = atob(token.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = xor(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
    const data = JSON.parse(new TextDecoder().decode(bytes))
    return data && typeof data.g === 'string' && typeof data.r === 'string' ? data : null
  } catch {
    return null
  }
}
