import { createApp } from './app.js'

const PORT = Number(process.env.PORT) || 8787
let adminKey = process.env.ADMIN_KEY

if (!adminKey) {
  if (process.env.NODE_ENV === 'production') {
    console.error('Set ADMIN_KEY before starting the server in production.')
    process.exit(1)
  }
  adminKey = 'admin'
  console.warn('⚠️  ADMIN_KEY is not set: the organizer key is "admin" (development only).')
}

createApp({ adminKey, corsOrigin: process.env.CORS_ORIGIN || '*' }).listen(PORT, () => {
  console.log(`🎁 Bunutan server running on http://localhost:${PORT}`)
})
