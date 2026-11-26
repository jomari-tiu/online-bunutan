# 🎁 Bunutan: Online Gift Exchange Draw

An online *bunutan* (Secret Santa / Monito-Monita) where everyone draws on their own phone.

Two separate apps:

| Folder | What it is |
|---|---|
| `/` (root) | **Frontend**: React + Vite. The pages people see. |
| `server/` | **Backend**: Node + Express. Saves everything as one JSON document: in **Postgres (Neon)** when `DATABASE_URL` is set, otherwise in a local file `server/data/db.json`. |

## Run it locally

```bash
npm install && npm --prefix server install

npm run server     # backend on http://localhost:8787
npm run dev        # frontend on http://localhost:5173 (proxies /api to the backend)
npm test           # backend tests
```

## How it works

1. **Edit `server/participants.json`**: the names; the event name, budget and date; and any `alreadyPicked` pairs.
2. **Organizer**: open `/#/organizer` and press **Generate all pairs** once. The server makes every pair at the same moment.
3. **Send each person their own link** with **Copy message**, in a private chat. The link only holds a random code, not the pick.
4. Each person opens their link:
   - **First open (any phone):** set a 4-digit PIN, then **💌 pick a letter**.
   - **Later opens (any phone):** enter the PIN, then go straight to their pick. **No second pick.**
5. The organizer page shows who has opened (🔒) and who has drawn (✅), but never who picked whom.

### Why it's safe
- All pairs are made together, once, so two people can never get the same name, even when drawing at the same second.
- The pick stays on the server until the right PIN is given. PINs are stored hashed, never as typed.
- Only the first device can set the PIN; a forwarded link asks for it.
- 5 wrong PINs lock that link for 5 minutes.
- Pairs can't be regenerated once anyone has drawn.

## Deploy: backend on Render, frontend on Vercel

Deploy the **backend first**, because the frontend needs its address.

### 1. Backend → Render (data in Neon)
1. In **Neon**, copy the **connection string** (Dashboard → Connect). It looks like
   `postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`.
2. Render → **New → Web Service** → this repo, then set:
   - Root Directory `server`, Build `npm ci`, Start `npm start`. The **Free** plan is fine.
   - Environment: `NODE_ENV=production`, `DATABASE_URL=<Neon connection string>`, `CORS_ORIGIN=*` for now.
   - Or use **New → Blueprint**, which reads `render.yaml`.
3. Open `https://<render-name>.onrender.com/api/health`. It should show `"ok":true` and `"type":"postgres"`.
   The table `bunutan_state` is created automatically on first use.

> Free Render instances sleep after 15 minutes idle. The first request after that takes about a minute,
> but no data is lost, because it lives in Neon.

### 2. Frontend → Vercel
1. Vercel → **Add New → Project** → choose this repo. Root directory: the repo root. Framework: **Vite** (auto-detected).
2. **Environment Variables**: `VITE_API_URL` = your Render address, e.g. `https://bunutan-server.onrender.com`.
3. Deploy. You'll get an address like `https://online-bunutan.vercel.app`.

### 3. Connect them
On Render, set `CORS_ORIGIN` to your Vercel address (e.g. `https://online-bunutan.vercel.app`) and save. Render redeploys.

### 4. Run the bunutan
Open `https://<your-vercel-site>/#/organizer`, press **Generate all pairs**, and send each link.

**Changing `VITE_API_URL`?** Redeploy on Vercel. It's baked in at build time.
**Changing `server/participants.json`?** Push it. Render redeploys; the data in Neon stays.

## Things to know
- **The organizer page has no password.** Don't share the `/#/organizer` address: anyone who opens it can see every link.
- **The data** is one row in Neon's `bunutan_state` table (column `data`). Neon keeps backups/history; you can also copy it out with `SELECT data FROM bunutan_state`.
- A forgotten PIN can't be recovered from the app. In Neon's SQL editor, clear it with:
  `UPDATE bunutan_state SET data = data #- '{people,jomari,pinHash}' #- '{people,jomari,pinSalt}' WHERE id = 1;` (replace `jomari`).
