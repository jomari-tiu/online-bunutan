import { createApp } from './app.js'
import { checkStorage } from './store.js'

const PORT = Number(process.env.PORT) || 8787

const storage = await checkStorage()
if (!storage.ok) console.error(`❌ ${storage.error}`)
else if (storage.type === 'postgres') console.log('💾 Saving data to Postgres (DATABASE_URL)')
else console.log(`💾 Saving data to ${storage.file}`)

createApp({ corsOrigin: process.env.CORS_ORIGIN || '*' }).listen(PORT, () => {
  console.log(`🎁 Bunutan server running on http://localhost:${PORT}`)
})
