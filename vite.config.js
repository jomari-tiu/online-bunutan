import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // './' lets the built app run from any folder (GitHub Pages, Netlify...)
  base: './',
  // In development, /api calls go to the backend in server/ (npm run server).
  server: { proxy: { '/api': 'http://localhost:8787' } },
})
