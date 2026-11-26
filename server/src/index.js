import { createApp } from './app.js'

const PORT = Number(process.env.PORT) || 8787

createApp({ corsOrigin: process.env.CORS_ORIGIN || '*' }).listen(PORT, () => {
  console.log(`🎁 Bunutan server running on http://localhost:${PORT}`)
})
