// Supabase Edge Function: GET /plant-report
//
// Fetches both Ecowitt gateways + Open-Meteo forecast, runs the plant rule
// engine, returns one clean JSON document for the web dashboard + iOS app.
// Optionally logs each reading to the `soil_readings` table for long-term
// history beyond Ecowitt's ~3-month retention.
//
// Required environment variables (set via Supabase dashboard or `supabase
// secrets set`):
//   ECOWITT_APP_KEY        Ecowitt Application Key
//   ECOWITT_API_KEY        Ecowitt API Key
//   ECOWITT_MAC_BACKYARD   Back Yard gateway MAC
//   ECOWITT_MAC_SIDEYARDS  Side Yards gateway MAC
//   WEATHER_LAT            Backyard latitude  (e.g. 34.0714)
//   WEATHER_LON            Backyard longitude (e.g. -118.228)
//
// Optional:
//   LOG_HISTORY            "true" to insert readings into soil_readings
//   SUPABASE_URL           auto-injected
//   SUPABASE_SERVICE_ROLE_KEY  auto-injected

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { PLANTS } from "./plants.ts";
import { advise, advisePair, parseWeather, type PlantReading } from "./logic.ts";

const ECOWITT_BASE  = "https://api.ecowitt.net/api/v3";
const OPENMETEO_BASE = "https://api.open-meteo.com/v1/forecast";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function env(name: string, required = true): string {
  const v = Deno.env.get(name);
  if (!v && required) throw new Error(`Missing env var: ${name}`);
  return v ?? "";
}

async function fetchGateway(mac: string) {
  const url = `${ECOWITT_BASE}/device/real_time` +
    `?application_key=${env("ECOWITT_APP_KEY")}` +
    `&api_key=${env("ECOWITT_API_KEY")}` +
    `&mac=${encodeURIComponent(mac)}` +
    `&call_back=all`;
  const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`Ecowitt HTTP ${r.status} for mac ${mac}`);
  const j = await r.json();
  if (j.code !== 0) throw new Error(`Ecowitt error for mac ${mac}: ${j.msg}`);
  return j.data ?? {};
}

async function fetchWeather() {
  const url = `${OPENMETEO_BASE}?latitude=${env("WEATHER_LAT")}` +
    `&longitude=${env("WEATHER_LON")}` +
    `&daily=precipitation_sum,temperature_2m_max` +
    `&timezone=auto&forecast_days=2`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;  // weather is best-effort; rules degrade gracefully
  }
}

function readChannel(payload: any, ch: number) {
  const node = payload?.[`soil_ch${ch}`];
  const moisture = node?.soilmoisture?.value;
  const battery  = payload?.battery?.[`soilmoisture_sensor_ch${ch}`]?.value;
  return {
    moisture: moisture !== undefined ? Number(moisture) : null,
    battery:  battery  !== undefined ? Number(battery)  : null,
  };
}

async function logHistory(readings: PlantReading[]) {
  if (env("LOG_HISTORY", false) !== "true") return;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;
  const sb = createClient(url, key);
  const rows = readings
    .filter((r) => r.moisture !== null)
    .map((r) => ({
      zone: r.plant.zone,
      channel: r.plant.channel,
      plant: r.plant.name,
      moisture: r.moisture,
      battery: r.battery,
    }));
  if (rows.length) await sb.from("plantwatch_soil_readings").insert(rows);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405, headers: CORS });
  }

  try {
    const [backyard, sideyards, weatherRaw] = await Promise.all([
      fetchGateway(env("ECOWITT_MAC_BACKYARD")),
      fetchGateway(env("ECOWITT_MAC_SIDEYARDS")),
      fetchWeather(),
    ]);
    const payloadByZone: Record<string, any> = {
      "Back Yard":  backyard,
      "Side Yards": sideyards,
    };
    const wx = parseWeather(weatherRaw);

    const readings: PlantReading[] = PLANTS.map((p) => {
      const { moisture, battery } = readChannel(payloadByZone[p.zone], p.channel);
      if (moisture === null) {
        return {
          plant: p, moisture: null, battery,
          status: "no_reading",
          headline: "No reading",
          advice: "Check the sensor — it isn't reporting.",
          needsWater: false,
        };
      }
      return { plant: p, moisture, battery, ...advise(p, moisture, wx) };
    });

    // Paired-probe annotations (e.g. Avocado Deep + Shallow)
    const pairs: Record<string, { deep?: PlantReading; shallow?: PlantReading }> = {};
    for (const r of readings) {
      if (!r.plant.pair) continue;
      pairs[r.plant.pair] ??= {};
      if (r.plant.pair_role) pairs[r.plant.pair][r.plant.pair_role] = r;
    }
    const pairNotes: Record<string, string> = {};
    for (const [key, pair] of Object.entries(pairs)) {
      const note = advisePair(pair.deep, pair.shallow);
      if (note) pairNotes[key] = note;
    }

    await logHistory(readings);

    const counts = {
      needs_water: readings.filter((r) => r.needsWater).length,
      too_wet:     readings.filter((r) => r.status === "too_wet").length,
      good:        readings.filter((r) => r.status === "good" || r.status === "good_hot_warning").length,
      deferred:    readings.filter((r) => r.status === "dry_rain_coming").length,
      missing:     readings.filter((r) => r.status === "no_reading").length,
    };

    return new Response(JSON.stringify({
      generated_at: new Date().toISOString(),
      weather: {
        rain_soon_mm:  wx.rainSoonMm,
        high_today_c:  wx.highTodayC,
        rain_skip_threshold_mm: 5,
        available: wx.rainSoonMm !== null || wx.highTodayC !== null,
      },
      counts,
      pair_notes: pairNotes,
      readings: readings.map((r) => ({
        zone: r.plant.zone,
        channel: r.plant.channel,
        name: r.plant.name,
        type: r.plant.type,
        verified: r.plant.verified ?? false,
        pair: r.plant.pair ?? null,
        pair_role: r.plant.pair_role ?? null,
        ideal_low: r.plant.low,
        ideal_high: r.plant.high,
        moisture: r.moisture,
        battery: r.battery,
        status: r.status,
        headline: r.headline,
        advice: r.advice,
        needs_water: r.needsWater,
      })),
    }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
