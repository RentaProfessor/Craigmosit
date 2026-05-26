// PlantWatch edge function v14 — simplified, static, research-only.
//
// Design after user feedback:
//   • NO predictive / weather-adjusted ranges
//   • NO weather narration in per-plant advice
//   • Each plant: ideal range is fixed by species; advice = action + species "why"
//   • Weather lives ONLY at the top (hero card) — today's conditions, that's it
//
// Plant labels are confirmed from Ecowitt iPad app screenshots (May 26 2026).

const CORS = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET, OPTIONS"};

// ─── Care profiles (UC IPM, UC ANR Master Gardener, CA Avocado Comm.) ─────
const profiles = {
  citrus: {
    low: 40, high: 60,
    species: "citrus",
    why: "Citrus needs consistent moisture (UC IPM: 4–6\"/month in summer). Underwatering = small, sunburned fruit; overwatering invites root rot.",
  },
  avocado: {
    low: 45, high: 65,
    species: "avocado",
    why: "Avocados use ~2\"/week in summer with shallow, sensitive roots (CA Avocado Comm.). They hate drought AND wet feet equally — tightest band of any plant here.",
  },
  camellia: {
    low: 35, high: 50,
    species: "camellia",
    why: "Camellias are more often killed by over-watering than under (UC MG). Moderate, even moisture; protect from hot afternoon sun. Bud drop = summer water stress.",
  },
  hydrangea: {
    low: 45, high: 65,
    species: "hydrangea",
    why: "Hydrangea macrophylla needs consistently moist, well-drained soil (Missouri Botanical / UC MG). Wilts visibly when dry; tolerates full sun only with steady moisture.",
  },
  rosemary: {
    low: 18, high: 38,
    species: "rosemary",
    why: "Rosemary is Mediterranean and drought-adapted (UC MG Sonoma: \"no summer water required once established\"). Wet roots kill it.",
  },
  westringia: {
    low: 20, high: 40,
    species: "westringia",
    why: "Westringia (Australian coast rosemary) is drought-tolerant; tolerates wind and salt. Appreciates occasional summer water in inland heat (UC Marin MG).",
  },
  lavender: {
    low: 22, high: 40,
    species: "lavender",
    why: "Lavender is Mediterranean and drought-tolerant, but needs adequate moisture during growth (UC MG). Excellent drainage is non-negotiable.",
  },
  bay_laurel: {
    low: 22, high: 42,
    species: "bay-laurel",
    why: "Established (2+ yr) bay laurel adapts to low water; still needs irrigation in extended dry spells (UC MG Sonoma).",
  },
  star_jasmine: {
    low: 32, high: 52,
    species: "star-jasmine",
    why: "Established star jasmine needs modest irrigation; bumps in extreme heat (UC IPM). Well-drained soil only.",
  },
  boxwood: {
    low: 28, high: 50,
    species: "boxwood",
    why: "Boxwood prefers slow, deep watering over frequent shallow (UC MG Alameda). Drip only — overhead spreads boxwood blight.",
  },
  convolvulus: {
    low: 22, high: 42,
    species: "convolvulus",
    why: "Convolvulus cneorum (Silverbush) is a Mediterranean groundcover; drought-tolerant once established. Needs excellent drainage; root rot risk if wet.",
  },
};

// ─── PLANT MAP — confirmed from Ecowitt screenshots (May 26 2026) ─────────
//   physical = where the plant actually lives (Back Yard / Front Yard)
//   display  = tile position in the Ecowitt app (left-to-right, top-to-bottom)
const PLANTS = [
  // ── BACK YARD gateway (16 sensors) ────────────────────────────────────
  {zone:"Back Yard",ch:1, display:1,  name:"Hydrangea",                  p:"hydrangea",   verified:true,  physical:"Back Yard",  physical_verified:true},
  {zone:"Back Yard",ch:2, display:2,  name:"Bay Laurel Pool Equipment",  p:"bay_laurel",  verified:true,  physical:"Back Yard",  physical_verified:true},
  {zone:"Back Yard",ch:4, display:3,  name:"Convovulos Pool",            p:"convolvulus", verified:true,  physical:"Back Yard",  physical_verified:true},
  {zone:"Back Yard",ch:6, display:4,  name:"Westringia Pool Hill",       p:"westringia",  verified:true,  physical:"Back Yard",  physical_verified:true},
  {zone:"Back Yard",ch:3, display:5,  name:"Small Lime Tree",            p:"citrus",      verified:true,  physical:"Back Yard",  physical_verified:true},
  {zone:"Back Yard",ch:9, display:6,  name:"Small Grapefruit Tree",      p:"citrus",      verified:true,  physical:"Back Yard",  physical_verified:true},
  {zone:"Back Yard",ch:14,display:7,  name:"Cara Cara",                  p:"citrus",      verified:true,  physical:"Back Yard",  physical_verified:true},
  {zone:"Back Yard",ch:15,display:8,  name:"Naval Orange",               p:"citrus",      verified:true,  physical:"Back Yard",  physical_verified:true},
  {zone:"Back Yard",ch:5, display:9,  name:"Lemon Tree",                 p:"citrus",      verified:true,  physical:"Back Yard",  physical_verified:true},
  {zone:"Back Yard",ch:16,display:10, name:"Large Tangerine",            p:"citrus",      verified:true,  physical:"Back Yard",  physical_verified:true},
  {zone:"Back Yard",ch:13,display:11, name:"Mandarin",                   p:"citrus",      verified:true,  physical:"Back Yard",  physical_verified:true},
  {zone:"Back Yard",ch:12,display:12, name:"Oro Blanco",                 p:"citrus",      verified:true,  physical:"Back Yard",  physical_verified:true},
  {zone:"Back Yard",ch:7, display:13, name:"Ruby Red",                   p:"citrus",      verified:true,  physical:"Back Yard",  physical_verified:true},
  {zone:"Back Yard",ch:11,display:14, name:"Small Avocado",              p:"avocado",     verified:true,  physical:"Back Yard",  physical_verified:true},
  {zone:"Back Yard",ch:8, display:15, name:"Avocado Deep",               p:"avocado",     verified:true,  physical:"Back Yard",  physical_verified:true, pair:"av", role:"deep"},
  {zone:"Back Yard",ch:10,display:16, name:"Avocado Shallow",            p:"avocado",     verified:true,  physical:"Back Yard",  physical_verified:true, pair:"av", role:"shallow"},

  // ── SIDE YARDS gateway (8 sensors) ────────────────────────────────────
  {zone:"Side Yards",ch:1,display:1, name:"Camelia",                          p:"camellia",    verified:true, physical:"Back Yard",  physical_verified:true},
  {zone:"Side Yards",ch:2,display:2, name:"Rosemary Cook Center Floor",       p:"rosemary",    verified:true, physical:"Back Yard",  physical_verified:true},
  {zone:"Side Yards",ch:5,display:3, name:"Star Jasmine Cook Center Floor",   p:"star_jasmine",verified:true, physical:"Back Yard",  physical_verified:true},
  {zone:"Side Yards",ch:4,display:4, name:"Rosemary Cook Center Hill",        p:"rosemary",    verified:true, physical:"Back Yard",  physical_verified:true},
  {zone:"Side Yards",ch:7,display:5, name:"Bay Laurel Behind Spit",           p:"bay_laurel",  verified:true, physical:"Back Yard",  physical_verified:true},
  {zone:"Side Yards",ch:3,display:6, name:"Lavender Front Yard",              p:"lavender",    verified:true, physical:"Front Yard", physical_verified:true},
  {zone:"Side Yards",ch:6,display:7, name:"Boxwood Driveway",                 p:"boxwood",     verified:true, physical:"Front Yard", physical_verified:true},
  {zone:"Side Yards",ch:8,display:8, name:"Westringia Office",                p:"westringia",  verified:true, physical:"Front Yard", physical_verified:true},
];

const num = (x) => { const n = parseFloat(x); return isFinite(n) ? n : null; };
const getEnv = (k) => Deno.env.get(k) ?? "";
const cToF = (c) => c * 9/5 + 32;
const mmToIn = (mm) => mm / 25.4;

async function getGw(mac) {
  const url = `https://api.ecowitt.net/api/v3/device/real_time?application_key=${getEnv("ECOWITT_APP_KEY")}&api_key=${getEnv("ECOWITT_API_KEY")}&mac=${encodeURIComponent(mac)}&call_back=all`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Ecowitt HTTP " + r.status);
  const j = await r.json();
  if (j.code !== 0) throw new Error("Ecowitt: " + j.msg);
  return j.data || {};
}

async function getWx() {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${getEnv("WEATHER_LAT")}&longitude=${getEnv("WEATHER_LON")}&current=temperature_2m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_min&timezone=America/Los_Angeles&forecast_days=2&temperature_unit=fahrenheit&precipitation_unit=inch`);
    return r.ok ? r.json() : null;
  } catch { return null; }
}

// ─── Advice: action + species "why". No weather, ever. ────────────────────
function advise(p, m) {
  if (m < p.low) {
    const gap = p.low - m;
    const veryDry = gap >= 12;
    let action;
    if (gap >= 10)     action = "Deep-water today";
    else if (gap >= 5) action = "Water today";
    else               action = "Water lightly today";
    return {
      status: veryDry ? "very_dry" : "dry",
      headline: veryDry ? "VERY DRY" : "Dry",
      advice: `${action} — at ${Math.round(m)}% you're ${Math.round(gap)}% below the ${p.low}% floor. ${p.why}`,
      needsWater: true,
    };
  }
  if (m > p.high) {
    const over = Math.round(m - p.high);
    return {
      status: "too_wet", headline: "Too wet",
      advice: `Hold off — at ${Math.round(m)}% you're ${over}% above the ${p.high}% ceiling. ${p.why}`,
      needsWater: false,
    };
  }
  return {
    status: "good", headline: "Good",
    advice: `In range — at ${Math.round(m)}% you're inside the ideal ${p.low}–${p.high}% band. ${p.why}`,
    needsWater: false,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, {headers:CORS});
  if (req.method !== "GET") return new Response("Method Not Allowed", {status:405,headers:CORS});
  try {
    const [byd, sid, wxRaw] = await Promise.all([
      getGw(getEnv("ECOWITT_MAC_BACKYARD")),
      getGw(getEnv("ECOWITT_MAC_SIDEYARDS")),
      getWx(),
    ]);

    const daily = wxRaw?.daily || {};
    const cur = wxRaw?.current || {};
    const hiToday = num((daily.temperature_2m_max||[])[0]);
    const loToday = num((daily.temperature_2m_min||[])[0]);
    const rainToday = num((daily.precipitation_sum||[])[0]);
    const rainTom = num((daily.precipitation_sum||[])[1]);
    const rhMinToday = num((daily.relative_humidity_2m_min||[])[0]);
    const tempNow = num(cur.temperature_2m);
    const rhNow = num(cur.relative_humidity_2m);
    const hiTom = num((daily.temperature_2m_max||[])[1]);

    const zones = {"Back Yard": byd, "Side Yards": sid};
    const readings = PLANTS.map(plant => {
      const node = zones[plant.zone] && zones[plant.zone]["soil_ch"+plant.ch];
      const moisture = (node?.soilmoisture?.value != null) ? num(node.soilmoisture.value) : null;
      const batNode = zones[plant.zone]?.battery?.["soilmoisture_sensor_ch"+plant.ch];
      const battery = batNode ? num(batNode.value) : null;
      const p = profiles[plant.p];
      if (moisture === null) {
        return {
          zone:plant.zone, channel:plant.ch, display_order:plant.display,
          physical_zone:plant.physical, physical_zone_verified:plant.physical_verified,
          name:plant.name, species:p.species, type:p.species, verified:plant.verified,
          pair:plant.pair || null, pair_role:plant.role || null,
          ideal_low:p.low, ideal_high:p.high,
          moisture:null, battery,
          status:"no_reading", headline:"No reading",
          advice:"Sensor isn't reporting — check battery / placement.",
          species_note: p.why, needs_water:false,
        };
      }
      const a = advise(p, moisture);
      return {
        zone:plant.zone, channel:plant.ch, display_order:plant.display,
        physical_zone:plant.physical, physical_zone_verified:plant.physical_verified,
        name:plant.name, species:p.species, type:p.species, verified:plant.verified,
        pair:plant.pair || null, pair_role:plant.role || null,
        ideal_low:p.low, ideal_high:p.high,
        moisture, battery,
        status:a.status, headline:a.headline, advice:a.advice,
        species_note: p.why, needs_water:a.needsWater,
      };
    });

    const counts = {needs_water:0,too_wet:0,good:0,missing:0};
    for (const r of readings) {
      if (r.needs_water) counts.needs_water++;
      else if (r.status==="too_wet") counts.too_wet++;
      else if (r.status==="good") counts.good++;
      else if (r.status==="no_reading") counts.missing++;
    }

    if (getEnv("LOG_HISTORY")==="true" && getEnv("SUPABASE_URL") && getEnv("SUPABASE_SERVICE_ROLE_KEY")) {
      try {
        const {createClient} = await import("https://esm.sh/@supabase/supabase-js@2.45.4");
        const sb = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
        const rows = readings.filter(r=>r.moisture!==null).map(r=>({zone:r.zone,channel:r.channel,plant:r.name,moisture:r.moisture,battery:r.battery}));
        if (rows.length) await sb.from("plantwatch_soil_readings").insert(rows);
      } catch(_) {}
    }

    return new Response(JSON.stringify({
      generated_at: new Date().toISOString(),
      // Weather block lives ONLY at the top of the dashboard now.
      weather: {
        temp_now_f:           tempNow !== null ? Math.round(tempNow) : null,
        humidity_now:         rhNow !== null ? Math.round(rhNow) : null,
        high_today_f:         hiToday !== null ? Math.round(hiToday) : null,
        low_today_f:          loToday !== null ? Math.round(loToday) : null,
        min_humidity_today:   rhMinToday !== null ? Math.round(rhMinToday) : null,
        rain_today_in:        rainToday,
        high_tomorrow_f:      hiTom !== null ? Math.round(hiTom) : null,
        rain_tomorrow_in:     rainTom,
        available:            hiToday !== null,
      },
      counts, pair_notes:{}, readings
    }), {status:200, headers:{...CORS, "Content-Type":"application/json", "Cache-Control":"no-store"}});
  } catch(err) {
    return new Response(JSON.stringify({error: String(err?.message ?? err)}),
      {status:500, headers:{...CORS, "Content-Type":"application/json"}});
  }
});
