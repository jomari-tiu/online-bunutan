# 🎁 Bunutan: Online Gift Exchange Draw

A React + Vite app for an online *bunutan* (Secret Santa / Monito-Monita). Everyone draws on their own phone. There's no backend and no database: the participant list is a JSON file and each person's result travels inside their private link.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static files in dist/, host them anywhere (Netlify, Vercel, GitHub Pages)
npm test           # checks the pairing logic
```

## How it works

1. **Edit `src/participants.json`**: the names, the event name, budget and date, and any `alreadyPicked` pairs (e.g. Jekisa → Mama).
2. **Put the app online** (`npm run build`, then upload `dist/`). Links made on `localhost` only work on your computer.
3. **Organizer**: open `https://<your-site>/#/organizer` and press **Generate all pairs** once. Every pair is made at the same moment, on your device.
4. **Send each person their own link** with **Copy message**, in a private chat.
5. Each person opens their link, then chooses **🎡 Spin the wheel** or **💌 Pick a letter**. The animation lands on the name already sealed in their link.

### Why two people can never get the same name
All pairs are decided together, in one place, before anyone draws: every name is used exactly once and nobody gets themselves. A phone never checks a shared "available list". It only reveals the answer inside its own link. So it doesn't matter if everyone draws at the same second.

### Things to know
- **Don't regenerate after sending links.** New pairs won't match the old links. The app warns you before regenerating.
- **Back up the pairs** with **Export JSON**. They're saved only in the organizer's browser.
- The organizer *can* see all pairs (**Reveal all pairs**). The link is scrambled so the name isn't readable in the URL, but it isn't real encryption.
- If you change `participants.json` after generating, the organizer page tells you to regenerate and resend.
