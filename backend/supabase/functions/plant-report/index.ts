// PlantWatch edge function v10 — weather-adjusted ideal ranges.
//
// The plant's static low/high are the BASE band (research-backed for the
// species). The actual "ideal range right now" SHIFTS based on the next
// 2 days of weather, weighted by the plant's species traits:
//
//   • Hot day today/tomorrow + heat-sensitive plant → floor lifts more
//   • Hot day + drought-tolerant plant → floor barely moves
//   • Rain in next 2 days → floor drops (no need to pre-water)
//   • Cool + humid marine layer → floor drops slightly
//   • Very dry air (<15% RH) → floor lifts for ALL plants somewhat
//
// Advice explains BOTH the species reason AND the weather reason, so
// the user understands why "35% is fine for rosemary but VERY DRY for citrus."

const CORS = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET, OPTIONS"};

// ─── Research-backed care profiles (UC IPM, UC ANR, CA Avocado Comm.) ────
const profiles = {
  citrus: {
    low: 40, high: 60, dries: false, dt: false, heat: true,
    species: "citrus",
    why: "Citrus needs consistent moisture (4–6\"/month in summer per UC IPM). Stress = small, sunburned fruit; over-water = root rot.",
  },
  avocado: {
    low: 45, high: 65, dries: false, dt: false, heat: true,
    species: "avocado",
    why: "Avocados use ~2\"/week in summer and have shallow, sensitive roots (CA Avocado Comm.). They hate drought AND wet feet equally — tightest band of any plant here.",
  },
  camellia: {
    low: 35, high: 50, dries: false, dt: false, heat: true,
    species: "camellia",
    why: "Camellias are more often killed by over-watering than under (UC MG). Need moderate, even moisture and protection from hot afternoon sun.",
  },
  rosemary: {
    low: 18, high: 38, dries: true, dt: true, heat: false,
    species: "rosemary",
    why: "Rosemary is Mediterranean and drought-adapted — UC MG: \"no summer water required once established.\" Wet roots kill it; drying out is what it wants.",
  },
  westringia: {
    low: 20, high: 40, dries: true, dt: true, heat: false,
    species: "westringia",
    why: "Westringia is Australian coast rosemary — drought-tolerant; tolerates wind and salt. Appreciates occasional summer water in inland heat.",
  },
  lavender: {
    low: 22, high: 40, dries: true, dt: true, heat: false,
    species: "lavender",
    why: "Lavender is Mediterranean; drought-tolerant but needs adequate moisture during growth (UC MG). Excellent drainage non-negotiable.",
  },
  bay_laurel: {
    low: 22, high: 42, dries: true, dt: true, heat: false,
    species: "bay-laurel",
    why: "Established (2+ yr) bay laurel adapts to low water but still needs irrigation in extended dry spells.",
  },
  star_jasmine: {
    low: 32, high: 52, dries: false, dt: false, heat: true,
    species: "star-jasmine",
    why: "Established star jasmine needs only modest irrigation; bumps up in extreme heat (UC IPM). Well-drained soil only.",
  },
  boxwood: {
    low: 28, high: 50, dries: false, dt: true, heat: false,
    species: "boxwood",
    why: "Boxwood prefers slow deep watering over frequent shallow. Drip only — overhead spreads boxwood blight.",
  },
  unknown: {
    low: 25, high: 45, dries: false, dt: true, heat: false,
    species: "unknown",
    why: "Species not yet confirmed; treated as a generic moderate-water shrub.",
  },
};

// ─── PLANT MAP (locked to Ecowitt screenshots May 25 2026) ─────────────
const PLANTS = [
  {zone:"Back Yard",ch:4, display:1,  name:"Cook Center Hill",         p:"unknown",     verified:false},
  {zone:"Back Yard",ch:1, display:2,  name:"Camelia",                  p:"camellia",    verified:false},
  {zone:"Back Yard",ch:2, display:3,  name:"Cook Center Rosemary",     p:"rosemary",    verified:true},
  {zone:"Back Yard",ch:9, display:4,  name:"Pool Hill Westringia",     p:"westringia",  verified:false},
  {zone:"Back Yard",ch:3, display:5,  name:"Front Yard Lavender",      p:"lavender",    verified:false},
  {zone:"Back Yard",ch:12,display:6,  name:"Small Grapefruit Tree",    p:"citrus",      verified:false},
  {zone:"Back Yard",ch:11,display:7,  name:"Cara Cara",                p:"citrus",      verified:false},
  {zone:"Back Yard",ch:10,display:8,  name:"Naval Orange",             p:"citrus",      verified:false},
  {zone:"Back Yard",ch:5, display:9,  name:"Cook Center Star Jasmine", p:"star_jasmine",verified:false},
  {zone:"Back Yard",ch:16,display:10, name:"Large Tangerine",          p:"citrus",      verified:true},
  {zone:"Back Yard",ch:13,display:11, name:"Mandarin",                 p:"citrus",      verified:false},
  {zone:"Back Yard",ch:6, display:12, name:"Driveway Boxwood",         p:"boxwood",     verified:false},
  {zone:"Back Yard",ch:7, display:13, name:"Bay Laurel Behind Spit",   p:"bay_laurel",  verified:true},
  {zone:"Back Yard",ch:14,display:14, name:"Small Avocado",            p:"avocado",     verified:false},
  {zone:"Back Yard",ch:8, display:15, name:"Westringia Office",        p:"westringia",  verified:true},
  {zone:"Back Yard",ch:15,display:16, name:"Avocado Shallow",          p:"avocado",     verified:false},
  {zone:"Side Yards",ch:1,display:1, name:"Camelia",                   p:"camellia",    verified:true},
  {zone:"Side Yards",ch:2,display:2, name:"Cook Center Rosemary",      p:"rosemary",    verified:true},
  {zone:"Side Yards",ch:5,display:3, name:"Cook Center Star Jasmine",  p:"star_jasmine",verified:true},
  {zone:"Side Yards",ch:4,display:4, name:"Cook Center Hill",          p:"unknown",     verified:true},
  {zone:"Side Yards",ch:7,display:5, name:"Bay Laurel Behind Spit",    p:"bay_laurel",  verified:true},
  {zone:"Side Yards",ch:3,display:6, name:"Front Yard Lavender",       p:"lavender",    verified:false},
  {zone:"Side Yards",ch:6,display:7, name:"Driveway Boxwood",          p:"boxwood",     verified:true},
  {zone:"Side Yards",ch:8,display:8, name:"Westringia Office",         p:"westringia",  verified:false},
];

const num = (x) => { const n = parseFloat(x); return isFinite(n) ? n : null; };
const getEnv = (k) => Deno.env.get(k) ?? "";
const cToF = (c) => c * 9/5 + 32;
const mmToIn = (mm) => mm / 25.4;
const fmtIn = (mm) => { const i = mmToIn(mm); return i < 0.1 ? "<0.1\"" : i.toFixed(1) + "\""; };

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
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${getEnv("WEATHER_LAT")}&longitude=${getEnv("WEATHER_LON")}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_min,et0_fao_evapotranspiration&timezone=America/Los_Angeles&forecast_days=7`);
    return r.ok ? r.json() : null;
  } catch(e) { return null; }
}

// ───── The core: adjust each plant's ideal band based on the
// next 2 days' weather, weighted by species. ─────
function adjustRange(p, wx) {
  const adjustments = [];
  let lowDelta = 0;
  let highDelta = 0;

  // Worst-case max temp over today + tomorrow drives the heat factor
  const maxNext2F = Math.max(wx.todayHighF ?? 0, wx.tomorrowHighF ?? 0);
  const heatTrigger = p.heat ? 82 : 92;   // heat-sensitive triggers earlier
  const heatScale   = p.heat ? 0.7 : 0.25; // and reacts more strongly

  if (maxNext2F >= heatTrigger) {
    const heatExcess = Math.min(maxNext2F - heatTrigger, 15);  // cap at +15°F
    const bump = Math.round(heatExcess * heatScale);
    if (bump > 0) {
      lowDelta += bump;
      const day = (wx.todayHighF ?? 0) >= (wx.tomorrowHighF ?? 0) ? "today" : "tomorrow";
      adjustments.push({
        delta: `+${bump}%`,
        reason: `${Math.round(maxNext2F)}°F ${day}` + (p.heat ? " (heat-sensitive species)" : ""),
      });
    }
  }

  // Arid air (very low RH) pulls moisture out faster
  const minRH = Math.min(wx.todayMinRH ?? 100, wx.tomorrowMinRH ?? 100);
  if (minRH < 15) {
    const bump = p.heat ? 4 : 2;
    lowDelta += bump;
    adjustments.push({ delta: `+${bump}%`, reason: `very dry air (${Math.round(minRH)}% RH)` });
  } else if (minRH < 25 && p.heat) {
    lowDelta += 2;
    adjustments.push({ delta: `+2%`, reason: `dry air (${Math.round(minRH)}% RH)` });
  }

  // Rain coming → no need to water, pull floor down
  const rainNext2In = ((wx.todayRainIn ?? 0) + (wx.tomorrowRainIn ?? 0));
  if (rainNext2In >= 0.3) {
    const drop = p.dt ? 3 : 6;
    lowDelta -= drop;
    adjustments.push({ delta: `−${drop}%`, reason: `${rainNext2In.toFixed(1)}" of rain expected` });
  } else if (rainNext2In >= 0.1) {
    lowDelta -= 2;
    adjustments.push({ delta: `−2%`, reason: `~${rainNext2In.toFixed(1)}" of rain expected` });
  }

  // Marine layer relief (cool + humid today)
  if ((wx.todayHighF ?? 100) < 70 && (wx.todayMinRH ?? 0) >= 50) {
    lowDelta -= 2;
    adjustments.push({ delta: `−2%`, reason: `marine layer (cool & humid)` });
  }

  // Cool spell with no heat = no reason to water aggressively
  if (maxNext2F > 0 && maxNext2F < 70 && !p.heat) {
    lowDelta -= 1;
  }

  return {
    base_low: p.low,
    base_high: p.high,
    adjusted_low: Math.max(5, Math.min(70, p.low + lowDelta)),
    adjusted_high: Math.max(20, Math.min(90, p.high + highDelta)),
    adjustments,
  };
}

// Build advice that names BOTH the species reason and the weather reason
function advise(plant, moisture, wx) {
  const p = profiles[plant.p];
  const range = adjustRange(p, wx);
  const adjustedFloor = range.adjusted_low;
  const adjustedCeil  = range.adjusted_high;

  // Build the "why we lifted / lowered the floor" string
  let weatherReason = "";
  if (range.adjustments.length) {
    const parts = range.adjustments.map(a => `${a.delta} for ${a.reason}`);
    if (range.adjusted_low !== range.base_low) {
      weatherReason = ` Floor moved from ${range.base_low}% → ${adjustedFloor}% (${parts.join("; ")}).`;
    } else {
      weatherReason = ` Conditions: ${parts.map(p => p.replace(/^[+−][\d]+% for /, "")).join("; ")}.`;
    }
  }

  // STATUS using the adjusted range
  if (moisture < adjustedFloor) {
    const gap = adjustedFloor - moisture;
    const veryDry = gap >= 10 || (p.dt && gap >= 15);
    let action;
    if (gap >= 8)      action = "Deep-water today";
    else if (gap >= 4) action = "Water today";
    else               action = "Water lightly today";
    return {
      status: veryDry ? "very_dry" : "dry",
      headline: veryDry ? "VERY DRY" : "Dry",
      advice: `${action}. ${p.why}${weatherReason}`,
      needsWater: true,
      range,
    };
  }
  if (moisture > adjustedCeil) {
    const driesNote = p.dries
      ? "This species likes drying between waterings, so this is mostly a watch."
      : "Watch for root rot if it stays high.";
    return {
      status: "too_wet", headline: "Too wet",
      advice: `Hold off — let it dry toward ${adjustedCeil}%. ${p.why} ${driesNote}${weatherReason}`,
      needsWater: false,
      range,
    };
  }

  // In range — but is there forecast pressure?
  const heatLooming = ((wx.todayHighF ?? 0) >= 85) || ((wx.tomorrowHighF ?? 0) >= 85);
  if (heatLooming && p.heat) {
    const buffer = moisture - adjustedFloor;
    if (buffer < 5) {
      return {
        status: "good_hot_warning",
        headline: `Tight before heat`,
        advice: `Within range now but only ${Math.round(buffer)}% above the adjusted floor (${adjustedFloor}%). ${p.why}${weatherReason} Top it off today.`,
        needsWater: false,
        range,
      };
    }
  }
  return {
    status: "good", headline: "Good",
    advice: `In range. ${p.why}${weatherReason}`,
    needsWater: false,
    range,
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
    const hi = (daily.temperature_2m_max || []).map(num);
    const rain = (daily.precipitation_sum || []).map(num);
    const humMin = (daily.relative_humidity_2m_min || []).map(num);
    const et0  = (daily.et0_fao_evapotranspiration || []).map(num);
    const dates = (daily.time || []);

    const todayHighC    = hi[0] ?? null;
    const tomorrowHighC = hi[1] ?? null;
    const todayRainMm   = rain[0] ?? null;
    const tomorrowRainMm= rain[1] ?? null;
    const todayMinRH    = humMin[0] ?? null;
    const tomorrowMinRH = humMin[1] ?? null;

    // Peak-day tracking (informational only — 3 days drives advice)
    const peakIdx = (arr, n) => {
      let best=-Infinity, idx=-1;
      for (let i=0;i<Math.min(n,arr.length);i++){ if (arr[i]!==null && arr[i]>best){best=arr[i];idx=i;} }
      return {value: idx>=0?best:null, index: idx};
    };
    const dayName = (iso) => {
      if (!iso) return null;
      const d = new Date(iso + "T12:00:00");
      return d.toLocaleDateString("en-US", {weekday:"short", month:"short", day:"numeric", timeZone:"America/Los_Angeles"});
    };
    const p3 = peakIdx(hi, 3);
    const p5 = peakIdx(hi, 5);
    const p7 = peakIdx(hi, 7);

    const wxCtx = {
      todayHighF:    todayHighC    !== null ? cToF(todayHighC)    : null,
      tomorrowHighF: tomorrowHighC !== null ? cToF(tomorrowHighC) : null,
      todayRainIn:   todayRainMm   !== null ? mmToIn(todayRainMm) : null,
      tomorrowRainIn:tomorrowRainMm!== null ? mmToIn(tomorrowRainMm): null,
      todayMinRH, tomorrowMinRH,
    };

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
          name:plant.name, species:p.species, type:p.species, verified:plant.verified,
          pair:null, pair_role:null,
          base_low:p.low, base_high:p.high, ideal_low:p.low, ideal_high:p.high,
          adjustments:[], moisture:null, battery,
          status:"no_reading", headline:"No reading", advice:"Check the sensor.", needs_water:false,
          species_note:p.why,
        };
      }
      const a = advise(plant, moisture, wxCtx);
      return {
        zone:plant.zone, channel:plant.ch, display_order:plant.display,
        name:plant.name, species:p.species, type:p.species, verified:plant.verified,
        pair:null, pair_role:null,
        base_low:a.range.base_low, base_high:a.range.base_high,
        ideal_low:a.range.adjusted_low, ideal_high:a.range.adjusted_high,
        adjustments:a.range.adjustments,
        moisture, battery,
        status:a.status, headline:a.headline, advice:a.advice, needs_water:a.needsWater,
        species_note:p.why,
      };
    });

    const counts = {needs_water:0,too_wet:0,good:0,deferred:0,missing:0};
    for (const r of readings) {
      if (r.needs_water) counts.needs_water++;
      else if (r.status==="too_wet") counts.too_wet++;
      else if (r.status==="good"||r.status==="good_hot_warning") counts.good++;
      else if (r.status==="dry_rain_coming") counts.deferred++;
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
      weather: {
        high_today_f:        wxCtx.todayHighF !== null ? Math.round(wxCtx.todayHighF) : null,
        high_tomorrow_f:     wxCtx.tomorrowHighF !== null ? Math.round(wxCtx.tomorrowHighF) : null,
        rain_today_in:       wxCtx.todayRainIn,
        rain_tomorrow_in:    wxCtx.tomorrowRainIn,
        rain_soon_mm:        ((todayRainMm ?? 0) + (tomorrowRainMm ?? 0)),
        rain_soon_in:        +(((wxCtx.todayRainIn ?? 0) + (wxCtx.tomorrowRainIn ?? 0))).toFixed(2),
        min_humidity_today:  todayMinRH,
        min_humidity_tomorrow: tomorrowMinRH,
        et0_today_in:        et0[0] !== null ? +mmToIn(et0[0]).toFixed(2) : null,
        max_high_3day_f:     p3.value !== null ? Math.round(cToF(p3.value)) : null,
        max_high_3day_day:   dayName(dates[p3.index]),
        max_high_5day_f:     p5.value !== null ? Math.round(cToF(p5.value)) : null,
        max_high_5day_day:   dayName(dates[p5.index]),
        max_high_7day_f:     p7.value !== null ? Math.round(cToF(p7.value)) : null,
        max_high_7day_day:   dayName(dates[p7.index]),
        heatwave_coming:     p3.value !== null && cToF(p3.value) >= 88,
        severe_heat_coming:  p3.value !== null && cToF(p3.value) >= 95,
        forecast_horizon_days: 3,
        available: todayHighC !== null || (todayRainMm ?? 0) > 0,
      },
      counts, pair_notes:{}, readings
    }), {status:200, headers:{...CORS, "Content-Type":"application/json", "Cache-Control":"no-store"}});
  } catch(err) {
    return new Response(JSON.stringify({error: String(err?.message ?? err)}),
      {status:500, headers:{...CORS, "Content-Type":"application/json"}});
  }
});
