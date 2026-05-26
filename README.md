# 🌱 PlantWatch

Live moisture & watering advice for a multi-zone garden, powered by
Ecowitt soil sensors and Open-Meteo's free forecast.

```
┌────────────────────┐
│  Ecowitt Cloud API │  2 gateways (Back Yard, Side Yards)
└─────────┬──────────┘
          │
┌─────────▼──────────┐
│ Supabase (free)    │  Edge function: fetch + rules + history
│  • plant-report fn │
│  • plantwatch_     │
│    soil_readings   │
└─────────┬──────────┘
          │   one JSON endpoint
   ┌──────┴──────┐
   ▼             ▼
┌─────────┐  ┌─────────┐
│ Web /   │  │  iOS    │
│ PWA     │  │ (Swift) │
└─────────┘  └─────────┘
```

All API keys live ONLY in Supabase environment variables — never in the
web bundle or the iOS app.

---

## Current deployment

| Layer | URL / location |
| ----- | -------------- |
| Edge function | `https://naaqvzbezcqamhqqnotx.supabase.co/functions/v1/plant-report` |
| History table | `public.plantwatch_soil_readings` (Supabase) |
| Web dashboard | Static `web/` folder — hostable on Cloudflare Pages, Netlify, Vercel, or any static host |
| iOS app | `ios/PlantWatch/` — open in Xcode, Archive → TestFlight |

---

## Repo layout

```
PlantWatch/
├── README.md
├── .gitignore
├── backend/
│   ├── .env.example                 sanitized placeholders only
│   └── supabase/
│       ├── config.toml              project + function config
│       ├── functions/plant-report/
│       │   ├── index.ts             entry point
│       │   ├── logic.ts             rule engine (pure)
│       │   └── plants.ts            ← EDIT plant names + care profile here
│       └── migrations/
│           └── 20260525000001_history.sql
├── web/                             static PWA
│   ├── index.html
│   ├── styles.css                   design tokens, cards, gauge
│   ├── app.js                       fetch + render + auto-refresh
│   ├── config.js                    endpoint URL (safe to ship)
│   ├── icon.svg / icon-*.png        app icon
│   └── manifest.webmanifest
└── ios/PlantWatch/
    ├── PlantWatchApp.swift          @main entry
    ├── ContentView.swift            navigation + scroll layout
    ├── Config.swift                 endpoint URL
    ├── DesignSystem.swift           colors, emoji map, helpers
    ├── PlantReport.swift            Codable models
    ├── PlantReportService.swift     fetch + auto-refresh
    ├── Info.plist
    ├── Assets/AppIcon-1024.png      drop into Xcode Assets.xcassets
    └── Views/
        ├── HeroCardView.swift       at-a-glance summary
        └── PlantCardView.swift      card + moisture gauge
```

---

## Deploying the dashboard to Cloudflare Pages

Cloudflare Pages is the recommended host — free, fast, custom domains.

**One-time setup:**

1. Push this repo to GitHub (already done at <https://github.com/RentaProfessor/Craigmosit>).
2. Go to <https://dash.cloudflare.com> → **Workers & Pages → Create → Pages**.
3. **Connect to Git** → select the `Craigmosit` repo.
4. Configure the build:
   - **Framework preset:** None (it's a static site)
   - **Build command:** *(leave blank)*
   - **Build output directory:** `PlantWatch/web`
   - **Root directory:** *(leave blank)*
5. **Save and Deploy.** Cloudflare gives you a URL like
   `https://craigmosit.pages.dev`.

That's it — every git push redeploys automatically.

**To install on Dad's iPad:**

1. Open the Pages URL in **Safari** on the iPad.
2. Tap the share icon → **Add to Home Screen**.
3. The icon launches the dashboard full-screen, like a native app.

---

## iOS app — open & ship

1. Open Xcode → **File ▸ New ▸ Project ▸ App** (SwiftUI, iOS).
   - Product name: `PlantWatch`
   - Interface: SwiftUI · Language: Swift
   - Bundle id: your usual reverse-domain (e.g. `com.yourname.plantwatch`)
2. Delete the auto-generated `ContentView.swift` and `PlantWatchApp.swift`.
3. **Drag every file from `ios/PlantWatch/`** into the project navigator
   (keep folder references for `Views/`).
4. **Add the app icon:** open `Assets.xcassets` → select **AppIcon** →
   drag `Assets/AppIcon-1024.png` into the 1024×1024 slot.
5. Build to Simulator (⌘B then ⌘R) — you'll see the live report.
6. **Push to TestFlight:**
   - Signing & Capabilities → pick your Apple Developer team
   - Product → Archive → Distribute → App Store Connect → TestFlight
   - Add Dad as an internal tester. He installs TestFlight, then PlantWatch.

---

## Confirming plant names

The Ecowitt API does **not** return the labels you set in their app, so
the channel-to-plant map lives in
[`backend/supabase/functions/plant-report/plants.ts`](backend/supabase/functions/plant-report/plants.ts).

Three Back Yard channels are value-pinned and trustworthy:
- **CH5** = Lemon Tree (29%)
- **CH7** = Ruby Red Grapefruit (60%)
- **CH16** = Large Tangerine (51%)

Everything else is a best guess and is marked `verified: false` in the
file. Two ways to fix:

- **Fast:** in the dashboard, tap *"Show channel-mapping helper"* at the
  bottom. It lists every channel with live moisture so you can compare
  to the Ecowitt app side-by-side.
- **Best:** send screenshots of both gateways from the Ecowitt app —
  I'll patch `plants.ts` and re-deploy.

After editing `plants.ts`, re-deploy the function (CLI):
```bash
cd backend
supabase functions deploy plant-report --no-verify-jwt
```

Or — since `index.ts` already inlines the plant list for our current
single-file deploy — edit the relevant entries in
`backend/supabase/functions/plant-report/index.ts` and use the Supabase
dashboard's Functions editor to paste in the updated source.

---

## Re-deploying the edge function

The deployed function is a single-file bundle (no Docker required).
Two ways to update:

**A) Via Supabase dashboard (easiest):**
- Supabase → **Edge Functions → plant-report → Edit Source** → paste
  updated code → Deploy.

**B) Via Supabase CLI** (requires `brew install supabase/tap/supabase`):
```bash
cd backend
supabase link --project-ref naaqvzbezcqamhqqnotx
supabase functions deploy plant-report --no-verify-jwt
```

---

## Local development

```bash
cd backend
cp .env.example .env             # fill in your real values
supabase functions serve plant-report --env-file .env --no-verify-jwt

# In another tab, serve the web folder:
cd ../web
python3 -m http.server 8080      # then open http://localhost:8080
```

---

## Costs

Everything in this stack is free at the volume one garden produces:

- **Supabase free tier:** 500 MB DB, 2 GB egress, 500 K function calls/month.
- **Cloudflare Pages:** free, unlimited static deploys.
- **Open-Meteo:** free, no key required.
- **Apple Developer Program:** $99/year (already paid).
  TestFlight builds expire every 90 days; rebuild + push to refresh.
