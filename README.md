# 🌱 PlantWatch

A moisture-monitoring dashboard + iOS app for Dad's garden.
Reads both Ecowitt gateways, factors in a free Open-Meteo forecast, and
gives plain-language watering advice per plant.

```
┌────────────────────┐
│  Ecowitt Cloud API │  (2 gateways)
└─────────┬──────────┘
          │
┌─────────▼──────────┐
│ Supabase (free)    │  Edge Function: fetch + rules + history
│  • plant-report fn │
│  • soil_readings DB│
└─────────┬──────────┘
          │  one JSON endpoint
   ┌──────┴──────┐
   ▼             ▼
┌─────────┐  ┌─────────┐
│ Web /   │  │ iOS app │
│ PWA     │  │ (Swift) │
└─────────┘  └─────────┘
```

All API keys live ONLY in Supabase env vars — never in the web bundle or
the iOS app.

---

## What's in the repo

| Path | What it is |
| ---- | ---------- |
| `backend/supabase/functions/plant-report/` | The Deno/TS edge function. `plants.ts` is the per-plant care profile (edit names here as you confirm them). |
| `backend/supabase/migrations/`             | SQL for the `soil_readings` history table. |
| `backend/.env.example`                     | Local-dev env vars (your real values are pre-filled). |
| `web/`                                     | Static dashboard — vanilla HTML/CSS/JS, installable as a Home Screen PWA. |
| `ios/PlantWatch/`                          | SwiftUI app — drop into a new Xcode project. |

---

## What YOU need to do

### 1 · Supabase (≈ 10 min, one time)

1. Sign up at <https://supabase.com> (free tier, no card required).
2. Create a new project. Pick a region close to you (e.g. *West US*).
3. Install the CLI:
   ```bash
   brew install supabase/tap/supabase
   ```
4. From this folder:
   ```bash
   cd "/Users/brett/Desktop/CRAIG MOIST/PlantWatch/backend"
   supabase login                       # opens browser
   supabase link --project-ref <REF>    # find <REF> in your project's URL
   ```
5. Push the history table:
   ```bash
   supabase db push
   ```
6. Set the secrets (these are your real keys — already filled in below):
   ```bash
   supabase secrets set \
     ECOWITT_APP_KEY=YOUR_ECOWITT_APP_KEY \
     ECOWITT_API_KEY=YOUR_ECOWITT_API_KEY \
     ECOWITT_MAC_BACKYARD=YOUR_BACKYARD_GATEWAY_MAC \
     ECOWITT_MAC_SIDEYARDS=YOUR_SIDEYARDS_GATEWAY_MAC \
     WEATHER_LAT=34.0714 \
     WEATHER_LON=-118.228 \
     LOG_HISTORY=true
   ```
   > Your real keys are in your `.env` file (gitignored). Never paste them here.
   ```
7. Deploy the function:
   ```bash
   supabase functions deploy plant-report --no-verify-jwt
   ```
   The `--no-verify-jwt` matches `config.toml` and makes the endpoint open
   (single trusted audience, per the spec).
8. Test:
   ```bash
   curl https://<PROJECT-REF>.supabase.co/functions/v1/plant-report | jq .
   ```
   You should see a JSON document with `readings`, `weather`, `counts`.

### 2 · Web dashboard (≈ 5 min)

1. Edit `web/config.js` — set `endpoint` to the URL you tested above.
2. Drag the **`web/` folder** onto <https://app.netlify.com/drop> (or
   Vercel, Cloudflare Pages — any static host). You get a URL like
   `https://plantwatch-xxxx.netlify.app`.
3. On Dad's iPad:
   - Open the URL in **Safari**
   - Tap the share icon → **Add to Home Screen**
   - It now launches full-screen like a real app.

### 3 · iOS app (≈ 15 min)

1. Open Xcode → **File ▸ New ▸ Project ▸ App** (SwiftUI, iOS).
   Name it `PlantWatch`, bundle id `com.yourname.plantwatch`.
2. Delete the auto-generated `ContentView.swift` and `PlantWatchApp.swift`.
3. Drag every file from `ios/PlantWatch/` into the Xcode project navigator.
4. Open `Config.swift`, paste your Supabase function URL into `endpoint`.
5. Build to Simulator — confirm it renders the same report.
6. **Push to TestFlight:**
   - Signing & Capabilities → pick your Apple Developer team.
   - Product → Archive → Distribute → App Store Connect → TestFlight.
   - Add Dad as an internal tester. He installs TestFlight, then PlantWatch.

### 4 · Confirm plant names (the only loose end)

Ecowitt's API doesn't expose the labels you set in the app, so the
channel-to-plant mapping has to live in the code. The file:

```
backend/supabase/functions/plant-report/plants.ts
```

…ships with my best guess. **Three channels are value-pinned and
trustworthy** (Lemon Tree CH5 / Ruby Red CH7 / Large Tangerine CH16 of
Back Yard); everything else needs a second look. Two ways to fix it:

- **Fast:** open the dashboard, tap *"Show channel-mapping helper"* at
  the bottom. It lists every channel with the current moisture so you
  can compare to the Ecowitt app side-by-side.
- **Best:** send me screenshots of both gateways from the Ecowitt app
  with the channel numbers visible — I'll patch `plants.ts` directly.

After editing, re-deploy: `supabase functions deploy plant-report --no-verify-jwt`.

---

## Local development (optional)

```bash
cd backend
cp .env.example .env
supabase functions serve plant-report --env-file .env --no-verify-jwt
# In another tab:
curl http://localhost:54321/functions/v1/plant-report | jq .
```

For the web dashboard, point `web/config.js`'s `endpoint` at the local
URL and serve `web/` with any static server (`python3 -m http.server`).

---

## Cost

Everything in this stack is free at our volume:

- **Supabase free tier:** 500 MB DB, 2 GB egress, 500 K edge-function
  invocations / month. One report per day = ~30 invocations / month.
- **Open-Meteo:** free, no key, no signup. Within their fair-use bounds.
- **Netlify / Vercel / Cloudflare Pages:** all free for a tiny static site.
- **Apple Developer Program:** $99/year — already paid per your note.
  TestFlight builds expire every 90 days; rebuild and push to refresh.
