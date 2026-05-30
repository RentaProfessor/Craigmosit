# 🏢 PlantWatch — Multi-tenant / SaaS architecture

Turning the single-garden app into a product you can sell as an install service.
**Phase 1 (backend foundation) is built and verified.** Dad's existing app is
untouched and keeps working on the old public endpoint until the clients move
over.

## What exists now

### Database (Supabase Postgres, row-level security)
Every user only ever sees their own rows (RLS policy `user_id = auth.uid()`).

| Table | Holds |
| --- | --- |
| `profiles` | 1:1 with `auth.users`; `onboarded`, `is_admin` |
| `ecowitt_accounts` | the user's Ecowitt `app_key` + `api_key` |
| `gateways` | their hubs (mac, name, station type) |
| `zones` | physical groupings (Back Yard / Side Yards / Front Yard / custom) |
| `plants` | a soil channel → name, species, zone, optional ideal range, order, notify, hidden |
| `user_prefs` | notify mode, offline alerts, weather lat/lon, layout |

A trigger auto-creates `profiles` + `user_prefs` rows on signup.

### Authenticated edge functions (verify_jwt = true)
- **`report-v2`** — builds the signed-in user's report entirely from their DB
  config (their Ecowitt creds, gateways, plants, zones, prefs). Same JSON shape
  as the old `plant-report` so the clients change minimally.
- **`ecowitt-devices`** — onboarding discovery: validate a user's Ecowitt key
  (passed in body or saved) and return their gateways + each gateway's active
  soil channels, so the setup UI can show "here are your devices."

Both use raw Supabase REST/Auth over `fetch` (no external imports — the
esm.sh/supabase-js import fails at boot under the Management-API deploy path,
which is also why the old history-logging silently never wrote).

### Dad
Seeded as the first account: 3 gateways, 3 zones, all 26 plants, `onboarded = true`,
`is_admin = true`. He is **never** prompted for Ecowitt setup.

> ⚠️ Temp login created for Dad: `dad@craigplantwatch.app` / `PlantWatch-Dad-2026`.
> Change the email to a real one he controls (needed for password reset) and set
> a password he'll use. Do this in Supabase → Authentication → Users, or tell me
> his email and I'll update it.

## Auth model (per your decisions)
- **Supabase Auth**, standard login. Sessions persist via refresh tokens →
  "remember me" is automatic; users stay logged in until they sign out or delete
  the app.
- **Service model:** you set up the Ecowitt sensors + generate the API key. A new
  user signs up → is prompted to enter that Ecowitt key → the app shows their
  devices → they organize them into zones and label plants.
- **First run:** anyone without an account lands on a sign-up / sign-in screen.

## Still to build (next phases)
1. **Clients — auth** (iOS + web): sign-in / sign-up screen; attach the session
   token to `report-v2`; persist session.
2. **Clients — onboarding**: after signup with no Ecowitt creds, prompt for the
   key → call `ecowitt-devices` → show gateways/channels → create zones + label
   plants (writes to `gateways`/`zones`/`plants`).
3. **Settings to the cloud**: move the per-plant name/zone/range/order + notify
   prefs from device-local storage into the DB so they sync across devices.
4. **App Store readiness**: Sign in with Apple, in-app account deletion, privacy
   policy; optional subscriptions later.

The old public `plant-report` endpoint stays live so Dad's current app never
breaks during the transition; cut over only after the new client builds ship.
