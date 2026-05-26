// PlantWatch edge function v11 — weather-narrative advice.
//
// Every advice line is built from 4 parts so the user sees BOTH what today
// + tomorrow's weather actually is AND what it means for THIS species:
//
//   1. ACTION verb       (Deep-water / Water / Top off / In range / Hold off)
//   2. WEATHER NARRATION ("Today's 91°F + 12% RH and tomorrow drops to 73°F")
//   3. IMPACT FOR SPECIES("…will spike citrus transpiration")
//   4. NUMERIC POINTER   ("at 38% you're 7% below the adjusted 45% floor")
//
// The species citation / educational note lives in a separate field
// (species_note) so the actionable line stays short.

const CORS = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET, OPTIONS"};

// ─── Care profiles ────────────────────────────────────────────────────
const profiles = {
  citrus: {
    low: 40, high: 60, dries: false, dt: false, heat: true, species: "citrus",
    why: "Citrus needs consistent moisture (4–6\"/month in summer per UC IPM). Stress = small, sunburned fruit; over-water = root rot.",
    name_for_advice: "citrus",
  },
  avocado: {
    low: 45, high: 65, dries: false, dt: false, heat: true, species: "avocado",
    why: "Avocados use ~2\"/week in summer and have shallow, sensitive roots (CA Avocado Comm.). They hate drought AND wet feet equally.",
    name_for_advice: "avocados",
  },
  camellia: {
    low: 35, high: 50, dries: false, dt: false, heat: true, species: "camellia",
    why: "Camellias are more often killed by over-watering than under (UC MG). Need moderate, even moisture and protection from hot afternoon sun.",
    name_for_advice: "camellias",
  },
  rosemary: {
    low: 18, high: 38, dries: true, dt: true, heat: false, species: "rosemary",
    why: "Rosemary is Mediterranean and drought-adapted — UC MG: \"no summer water required once established.\" Wet roots kill it.",
    name_for_advice: "rosemary",
  },
  westringia: {
    low: 20, high: 40, dries: true, dt: true, heat: false, species: "westringia",
    why: "Westringia is Australian coast rosemary — drought-tolerant; tolerates wind and salt.",
    name_for_advice: "westringia",
  },
  lavender: {
    low: 22, high: 40, dries: true, dt: true, heat: false, species: "lavender",
    why: "Lavender is Mediterranean; drought-tolerant but needs adequate moisture during growth (UC MG). Excellent drainage non-negotiable.",
    name_for_advice: "lavender",
  },
  bay_laurel: {
    low: 22, high: 42, dries: true, dt: true, heat: false, species: "bay-laurel",
    why: "Established (2+ yr) bay laurel adapts to low water but still needs irrigation in extended dry spells.",
    name_for_advice: "bay laurel",
  },
  star_jasmine: {
    low: 32, high: 52, dries: false, dt: false, heat: true, species: "star-jasmine",
    why: "Established star jasmine needs modest irrigation; bumps in extreme heat (UC IPM). Well-drained soil only.",
    name_for_advice: "star jasmine",
  },
  boxwood: {
    low: 28, high: 50, dries: false, dt: true, heat: false, species: "boxwood",
    why: "Boxwood prefers slow deep watering over frequent shallow. Drip only — overhead spreads boxwood blight.",
    name_for_advice: "boxwood",
  },
  unknown: {
    low: 25, high: 45, dries: false, dt: true, heat: false, species: "unknown",
    why: "Species not yet confirmed; treated as a generic moderate-water shrub.",
    name_for_advice: "this plant",
  },
};

const PLANTS = [
  {zone:"Back Yard",ch:4, display:1,  name:"Cook Center Hill",         p:"unknown",     verified:false, physical:"Back Yard", physical_verified:false},
  {zone:"Back Yard",ch:1, display:2,  name:"Camelia",                  p:"camellia",    verified:false, physical:"Back Yard", physical_verified:false},
  {zone:"Back Yard",ch:2, display:3,  name:"Cook Center Rosemary",     p:"rosemary",    verified:true, physical:"Back Yard", physical_verified:false},
  {zone:"Back Yard",ch:9, display:4,  name:"Pool Hill Westringia",     p:"westringia",  verified:false, physical:"Back Yard", physical_verified:false},
  {zone:"Back Yard",ch:3, display:5,  name:"Front Yard Lavender",      p:"lavender",    verified:false, physical:"Back Yard", physical_verified:false},
  {zone:"Back Yard",ch:12,display:6,  name:"Small Grapefruit Tree",    p:"citrus",      verified:false, physical:"Back Yard", physical_verified:false},
  {zone:"Back Yard",ch:11,display:7,  name:"Cara Cara",                p:"citrus",      verified:false, physical:"Back Yard", physical_verified:false},
  {zone:"Back Yard",ch:10,display:8,  name:"Naval Orange",             p:"citrus",      verified:false, physical:"Back Yard", physical_verified:false},
  {zone:"Back Yard",ch:5, display:9,  name:"Cook Center Star Jasmine", p:"star_jasmine",verified:false, physical:"Back Yard", physical_verified:false},
  {zone:"Back Yard",ch:16,display:10, name:"Large Tangerine",          p:"citrus",      verified:true, physical:"Back Yard", physical_verified:false},
  {zone:"Back Yard",ch:13,display:11, name:"Mandarin",                 p:"citrus",      verified:false, physical:"Back Yard", physical_verified:false},
  {zone:"Back Yard",ch:6, display:12, name:"Driveway Boxwood",         p:"boxwood",     verified:false, physical:"Back Yard", physical_verified:false},
  {zone:"Back Yard",ch:7, display:13, name:"Bay Laurel Behind Spit",   p:"bay_laurel",  verified:true, physical:"Back Yard", physical_verified:false},
  {zone:"Back Yard",ch:14,display:14, name:"Small Avocado",            p:"avocado",     verified:false, physical:"Back Yard", physical_verified:false},
  {zone:"Back Yard",ch:8, display:15, name:"Westringia Office",        p:"westringia",  verified:true, physical:"Back Yard", physical_verified:false},
  {zone:"Back Yard",ch:15,display:16, name:"Avocado Shallow",          p:"avocado",     verified:false, physical:"Back Yard", physical_verified:false},
  // SIDE YARDS gateway — labels confirmed from Ecowitt app screenshot (Tue May 26 3:56 PM)
  // physical_zone confirmed via user (Camelia + Cook Center + Bay Laurel Behind Spit → Back Yard; Lavender Front Yard / Boxwood Driveway / Westringia Office → Front Yard)
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
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${getEnv("WEATHER_LAT")}&longitude=${getEnv("WEATHER_LON")}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_min,et0_fao_evapotranspiration&timezone=America/Los_Angeles&forecast_days=7`);
    return r.ok ? r.json() : null;
  } catch(e) { return null; }
}

// ─── Range adjustment (v10 logic) ─────────────────────────────────────
function adjustRange(p, wx) {
  const adjustments = [];
  let lowDelta = 0;
  const maxNext2F = Math.max(wx.todayHighF ?? 0, wx.tomorrowHighF ?? 0);
  const heatTrigger = p.heat ? 82 : 92;
  const heatScale   = p.heat ? 0.7 : 0.25;

  if (maxNext2F >= heatTrigger) {
    const excess = Math.min(maxNext2F - heatTrigger, 15);
    const bump = Math.round(excess * heatScale);
    if (bump > 0) {
      lowDelta += bump;
      const when = (wx.todayHighF ?? 0) >= (wx.tomorrowHighF ?? 0) ? "today" : "tomorrow";
      adjustments.push({delta:`+${bump}%`, reason:`${Math.round(maxNext2F)}°F ${when}`+(p.heat?" (heat-sensitive)":"")});
    }
  }
  const minRH = Math.min(wx.todayMinRH ?? 100, wx.tomorrowMinRH ?? 100);
  if (minRH < 15) {
    const bump = p.heat ? 4 : 2;
    lowDelta += bump;
    adjustments.push({delta:`+${bump}%`, reason:`very dry air (${Math.round(minRH)}% RH)`});
  } else if (minRH < 25 && p.heat) {
    lowDelta += 2;
    adjustments.push({delta:"+2%", reason:`dry air (${Math.round(minRH)}% RH)`});
  }
  const rainNext2In = ((wx.todayRainIn ?? 0) + (wx.tomorrowRainIn ?? 0));
  if (rainNext2In >= 0.3) {
    const drop = p.dt ? 3 : 6;
    lowDelta -= drop;
    adjustments.push({delta:`−${drop}%`, reason:`${rainNext2In.toFixed(1)}" rain expected`});
  } else if (rainNext2In >= 0.1) {
    lowDelta -= 2;
    adjustments.push({delta:"−2%", reason:`~${rainNext2In.toFixed(1)}" rain expected`});
  }
  if ((wx.todayHighF ?? 100) < 70 && (wx.todayMinRH ?? 0) >= 50) {
    lowDelta -= 2;
    adjustments.push({delta:"−2%", reason:"marine layer (cool & humid)"});
  }
  if (maxNext2F > 0 && maxNext2F < 70 && !p.heat) lowDelta -= 1;

  return {
    base_low: p.low, base_high: p.high,
    adjusted_low: Math.max(5, Math.min(70, p.low + lowDelta)),
    adjusted_high: Math.max(20, Math.min(90, p.high + 0)),
    adjustments,
  };
}

// ─── WEATHER NARRATION ────────────────────────────────────────────────
// Produces a short, plain-English description of today + tomorrow that
// the advice prepends. Always present, never generic.
function weatherNarration(wx) {
  const t  = wx.todayHighF, tm = wx.tomorrowHighF;
  const rh = wx.todayMinRH, rhm = wx.tomorrowMinRH;
  const r1 = wx.todayRainIn ?? 0, r2 = wx.tomorrowRainIn ?? 0;
  const rainSum = r1 + r2;
  const max = Math.max(t ?? 0, tm ?? 0);
  if (t === null || tm === null) return "Forecast unavailable";

  // Rain dominates
  if (rainSum >= 0.3) return `${rainSum.toFixed(1)}" of rain expected over today + tomorrow (${Math.round(t)}°F → ${Math.round(tm)}°F)`;
  if (rainSum >= 0.1) return `Light rain (~${rainSum.toFixed(1)}") expected, ${Math.round(t)}°F today → ${Math.round(tm)}°F tomorrow`;

  // Severe / hot
  if (max >= 95) {
    const when = (t ?? 0) >= (tm ?? 0) ? "today" : "tomorrow";
    return `Severe heat — ${Math.round(max)}°F ${when} with ${Math.round(Math.min(rh ?? 100, rhm ?? 100))}% RH`;
  }
  if (max >= 85) {
    const when = (t ?? 0) >= (tm ?? 0) ? "today" : "tomorrow";
    return `Hot ${when} (${Math.round(max)}°F, ${Math.round(Math.min(rh ?? 100, rhm ?? 100))}% RH)`;
  }
  if (max >= 78) return `Warming to ${Math.round(max)}°F (today ${Math.round(t)}°F → tomorrow ${Math.round(tm)}°F)`;

  // Cool marine layer
  if ((t ?? 100) < 70 && (rh ?? 0) >= 50) return `Marine layer — ${Math.round(t)}°F today + ${Math.round(rh)}% RH, ${Math.round(tm)}°F tomorrow`;

  // Mild / default
  return `Mild — ${Math.round(t)}°F today and ${Math.round(tm)}°F tomorrow`;
}

// Plant-specific impact statement based on conditions
function impactForPlant(p, wx) {
  const max = Math.max(wx.todayHighF ?? 0, wx.tomorrowHighF ?? 0);
  const rh  = Math.min(wx.todayMinRH ?? 100, wx.tomorrowMinRH ?? 100);
  const rain = (wx.todayRainIn ?? 0) + (wx.tomorrowRainIn ?? 0);
  const sp = p.name_for_advice;

  if (rain >= 0.3) return p.dries ? `more than ${sp} needs` : `should largely cover ${sp}'s 48h need`;
  if (rain >= 0.1) return p.dt ? `extra moisture ${sp} won't really need` : `a small contribution to ${sp}'s need`;
  if (max >= 95) return p.heat ? `will sharply accelerate ${sp} transpiration` : `${sp} will handle this thanks to its drought tolerance`;
  if (max >= 85) return p.heat ? `will noticeably raise ${sp} water demand` : `${sp} will be fine — it's adapted to this`;
  if (max >= 78) return p.heat ? `slightly above average for ${sp}` : `well within ${sp}'s comfort zone`;
  if ((wx.todayHighF ?? 100) < 70 && (wx.todayMinRH ?? 0) >= 50) {
    return p.heat ? `minimal water loss for ${sp}` : `${sp} loves these conditions`;
  }
  return p.heat ? `modest water loss for ${sp}` : `${sp} is at no risk in mild weather`;
}

// ─── Build full advice ────────────────────────────────────────────────
function advise(plant, moisture, wx) {
  const p = profiles[plant.p];
  const range = adjustRange(p, wx);
  const adjLow = range.adjusted_low;
  const adjCeil = range.adjusted_high;
  const narr   = weatherNarration(wx);
  const impact = impactForPlant(p, wx);

  // Range moved note for the advice tail
  let moveNote = "";
  if (range.adjusted_low !== range.base_low) {
    const sign = range.adjusted_low > range.base_low ? "lifted" : "lowered";
    moveNote = ` Floor ${sign} from ${range.base_low}% to ${adjLow}%.`;
  }

  if (moisture < adjLow) {
    const gap = adjLow - moisture;
    const veryDry = gap >= 10 || (p.dt && gap >= 15);
    let action;
    if (gap >= 8)      action = "Deep-water today";
    else if (gap >= 4) action = "Water today";
    else               action = "Water lightly today";
    const pointer = `At ${Math.round(moisture)}% you're ${Math.round(gap)}% below the ${adjLow}% floor.`;
    return {
      status: veryDry ? "very_dry" : "dry",
      headline: veryDry ? "VERY DRY" : "Dry",
      advice: `${action}. ${narr} — ${impact}. ${pointer}${moveNote}`,
      needsWater: true,
      range,
    };
  }
  if (moisture > adjCeil) {
    const over = Math.round(moisture - adjCeil);
    const dryNote = p.dries ? "this species likes drying between waterings, so this is mostly a watch" : "watch for root rot if it stays high";
    return {
      status: "too_wet", headline: "Too wet",
      advice: `Hold off. ${narr} — ${impact}. At ${Math.round(moisture)}% you're ${over}% above the ${adjCeil}% ceiling — ${dryNote}.${moveNote}`,
      needsWater: false,
      range,
    };
  }

  // In range
  const heatLooming = ((wx.todayHighF ?? 0) >= 85) || ((wx.tomorrowHighF ?? 0) >= 85);
  const buffer = moisture - adjLow;
  if (heatLooming && p.heat && buffer < 5) {
    return {
      status: "good_hot_warning",
      headline: "Tight before heat",
      advice: `Top off today. ${narr} — ${impact}. At ${Math.round(moisture)}% you have only ${Math.round(buffer)}% buffer above the ${adjLow}% floor.${moveNote}`,
      needsWater: false,
      range,
    };
  }
  return {
    status: "good", headline: "Good",
    advice: `In range — no action. ${narr} — ${impact}. At ${Math.round(moisture)}% you're comfortably inside the ${adjLow}–${adjCeil}% band.${moveNote}`,
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
          status:"no_reading", headline:"No reading",
          advice:"Sensor isn't reporting — check the battery / placement.",
          species_note: p.why, needs_water:false,
        };
      }
      const a = advise(plant, moisture, wxCtx);
      return {
        zone:plant.zone, channel:plant.ch, display_order:plant.display,
        physical_zone:plant.physical, physical_zone_verified:plant.physical_verified,
        name:plant.name, species:p.species, type:p.species, verified:plant.verified,
        pair:null, pair_role:null,
        base_low:a.range.base_low, base_high:a.range.base_high,
        ideal_low:a.range.adjusted_low, ideal_high:a.range.adjusted_high,
        adjustments:a.range.adjustments,
        moisture, battery,
        status:a.status, headline:a.headline,
        advice:a.advice,
        species_note: p.why,        // citation / educational text kept separate
        needs_water:a.needsWater,
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
        available: todayHighC !== null,
      },
      counts, pair_notes:{}, readings
    }), {status:200, headers:{...CORS, "Content-Type":"application/json", "Cache-Control":"no-store"}});
  } catch(err) {
    return new Response(JSON.stringify({error: String(err?.message ?? err)}),
      {status:500, headers:{...CORS, "Content-Type":"application/json"}});
  }
});
