# 🎁 Bunutan: Online Gift Exchange Draw

An online *bunutan* (Secret Santa / Monito-Monita) where everyone draws on their own phone.

Two separate apps, **no database**:

| Folder | What it is |
|---|---|
| `/` (root) | **Frontend**: React + Vite. The pages people see. |
| `server/` | **Backend**: Node + Express. Saves everything to one JSON file, `server/data/db.json`. |

## Run it locally

```bash
npm install && npm --prefix server install

npm run server     # backend on http://localhost:8787 (organizer key "admin" in dev)
npm run dev        # frontend on http://localhost:5173 (proxies /api to the backend)
npm test           # backend tests
```

## How it works

1. **Edit `server/participants.json`**: the names; the event name, budget and date; and any `alreadyPicked` pairs.
2. **Organizer**: open `/#/organizer`, enter the organizer key and press **Generate all pairs** once. The server makes every pair at the same moment.
3. **Send each person their own link** with **Copy message**, in a private chat. The link only holds a random code, not the pick.
4. Each person opens their link:
   - **First open (any phone):** set a 4-digit PIN, then **🎡 Spin the wheel** or **💌 Pick a letter**.
   - **Later opens (any phone):** enter the PIN, then go straight to their pick. **No second spin.**
5. The organizer page shows who has opened (🔒) and who has drawn (✅), but never who picked whom.

### Why it's safe
- All pairs are made together, once, so two people can never get the same name, even when drawing at the same second.
- The pick stays on the server until the right PIN is given. PINs are stored hashed, never as typed.
- Only the first device can set the PIN; a forwarded link asks for it.
- 5 wrong PINs lock that link for 5 minutes.
- Pairs can't be regenerated once anyone has drawn.

## Deploy: backend on Render, frontend on Vercel

Deploy the **backend first**, because the frontend needs its address.

### 1. Backend → Render
1. Render → **New → Blueprint** → choose this GitHub repo. It reads `render.yaml`.
2. When asked, fill in:
   - `ADMIN_KEY`: a long password for the organizer page.
   - `CORS_ORIGIN`: leave as `*` for now. You'll set it in step 3.
3. Create it. You'll get an address like `https://bunutan-server.onrender.com`.
4. Check `https://bunutan-server.onrender.com/api/health`. It should show `{"ok":true}`.

> ⚠️ `render.yaml` uses the **Starter** plan with a **1 GB disk** mounted at `/var/data`, where `db.json` lives.
> On the **free** plan there's no disk, so `db.json` is erased on every restart or redeploy, and free instances
> restart after 15 minutes idle. All pairs, PINs and draws would be lost.

### 2. Frontend → Vercel
1. Vercel → **Add New → Project** → choose this repo. Root directory: the repo root. Framework: **Vite** (auto-detected).
2. **Environment Variables**: `VITE_API_URL` = your Render address, e.g. `https://bunutan-server.onrender.com`.
3. Deploy. You'll get an address like `https://online-bunutan.vercel.app`.

### 3. Connect them
On Render, set `CORS_ORIGIN` to your Vercel address (e.g. `https://online-bunutan.vercel.app`) and save. Render redeploys.

### 4. Run the bunutan
Open `https://<your-vercel-site>/#/organizer`, enter your `ADMIN_KEY`, press **Generate all pairs**, and send each link.

**Changing `VITE_API_URL`?** Redeploy on Vercel. It's baked in at build time.
**Changing `server/participants.json`?** Push it. Render redeploys, and the disk keeps `db.json`.

## Things to know
- **Back up `db.json`** (on Render: `/var/data/db.json`, via the Shell tab). It *is* the bunutan.
- A forgotten PIN can't be recovered from the app. The organizer can clear that person's `pinHash`/`pinSalt` in `db.json`, then restart the server.
