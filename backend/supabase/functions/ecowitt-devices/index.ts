// ecowitt-devices — authenticated (no external imports; raw REST via fetch).
const CORS = { "Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS" };
const SUPA = Deno.env.get("SUPABASE_URL"); const ANON = Deno.env.get("SUPABASE_ANON_KEY");
const num = (x) => { const n = parseFloat(x); return isFinite(n) ? n : null; };
const json = (o,s=200) => new Response(JSON.stringify(o),{status:s,headers:{...CORS,"Content-Type":"application/json"}});

async function getUser(auth){ const r=await fetch(`${SUPA}/auth/v1/user`,{headers:{apikey:ANON,Authorization:auth}}); return r.ok?await r.json():null; }
async function rest(path,auth,opts={}){ const r=await fetch(`${SUPA}/rest/v1/${path}`,{headers:{apikey:ANON,Authorization:auth,"Content-Type":"application/json",...(opts.headers||{})},method:opts.method||"GET",body:opts.body}); return r.ok?(r.status===204?null:await r.json()):null; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null,{headers:CORS});
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({error:"Not signed in"},401);
    const user = await getUser(auth);
    if (!user?.id) return json({error:"Not signed in"},401);

    let appKey, apiKey, save=false;
    try { const b=await req.json(); appKey=b.app_key; apiKey=b.api_key; save=!!b.save; } catch(_){}
    if (!appKey || !apiKey) {
      const rows = await rest("ecowitt_accounts?select=app_key,api_key", auth);
      if (rows && rows[0]) { appKey=rows[0].app_key; apiKey=rows[0].api_key; }
    }
    if (!appKey || !apiKey) return json({error:"No Ecowitt credentials provided or saved."},400);

    const lr = await fetch(`https://api.ecowitt.net/api/v3/device/list?application_key=${encodeURIComponent(appKey)}&api_key=${encodeURIComponent(apiKey)}`);
    const lj = await lr.json();
    if (lj.code !== 0) return json({error:`Ecowitt: ${lj.msg||"invalid key"}`, ecowitt_code:lj.code},400);
    const list = lj?.data?.list || [];

    const gateways = [];
    for (const g of list) {
      let channels = [];
      try {
        const rr = await fetch(`https://api.ecowitt.net/api/v3/device/real_time?application_key=${encodeURIComponent(appKey)}&api_key=${encodeURIComponent(apiKey)}&mac=${encodeURIComponent(g.mac)}&call_back=all`);
        const d = (await rr.json())?.data || {};
        for (let ch=1; ch<=16; ch++){ const n=d["soil_ch"+ch]; if(n?.soilmoisture?.value!=null) channels.push({channel:ch,moisture:num(n.soilmoisture.value),battery:num(d.battery?.["soilmoisture_sensor_ch"+ch]?.value)}); }
      } catch(_){}
      gateways.push({mac:g.mac,name:g.name,station_type:g.stationtype,latitude:g.latitude,longitude:g.longitude,channels});
    }

    if (save) {
      await rest("ecowitt_accounts", auth, { method:"POST",
        headers:{ Prefer:"resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ user_id:user.id, app_key:appKey, api_key:apiKey, updated_at:new Date().toISOString() }) });
    }
    return json({ gateways });
  } catch(err){ return json({error:String(err?.message ?? err)},500); }
});
