/* ─────────────────────────────────────────────────────────────
   PlantWatch — dashboard logic
   ───────────────────────────────────────────────────────────── */
(function () {
  const cfg = window.PLANTWATCH_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  /* ── helpers ──────────────────────────────────────────────── */

  const emojiFor = (name, type) => {
    const n = name.toLowerCase();
    if (n.includes("lemon"))                        return "🍋";
    if (n.includes("lime"))                         return "🍐";
    if (n.includes("grapefruit") || n.includes("oro blanco")) return "🍈";
    if (n.includes("tangerine") || n.includes("mandarin") ||
        n.includes("orange")    || n.includes("cara cara"))   return "🍊";
    if (n.includes("avocado"))                      return "🥑";
    if (n.includes("hydrangea"))                    return "💐";
    if (n.includes("camelia") || n.includes("camellia") || n.includes("jasmine")) return "🌸";
    if (n.includes("rosemary"))                     return "🌿";
    if (n.includes("lavender"))                     return "💜";
    if (n.includes("westringia"))                   return "🌾";
    if (n.includes("bay laurel"))                   return "🌳";
    if (n.includes("boxwood"))                      return "🌳";
    if (n.includes("convolvulus") || n.includes("convovulos")) return "🌱";
    switch (type) {
      case "citrus":         return "🍊";
      case "avocado":        return "🥑";
      case "mediterranean":  return "🌿";
      case "broadleaf":      return "🌸";
      case "hydrangea":      return "💐";
      case "boxwood":        return "🌳";
      case "groundcover":    return "🌱";
    }
    return "🪴";
  };

  const relTime = (iso) => {
    const ms = Date.now() - new Date(iso).getTime();
    const s = Math.round(ms / 1000);
    if (s < 60)   return s <= 5 ? "just now" : `${s} seconds ago`;
    const m = Math.round(s / 60);
    if (m < 60)   return `${m} minute${m === 1 ? "" : "s"} ago`;
    const h = Math.round(m / 60);
    if (h < 24)   return `${h} hour${h === 1 ? "" : "s"} ago`;
    return new Date(iso).toLocaleDateString();
  };

  const escape = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ── renderers ────────────────────────────────────────────── */

  function renderHero(data) {
    const c = data.counts;
    const total = c.needs_water + c.too_wet + c.good + c.deferred + c.missing;
    const dryPlants = data.readings
      .filter((r) => r.needs_water)
      .sort((a, b) => (b.ideal_low - b.moisture) - (a.ideal_low - a.moisture));

    let title, sub, eyebrow;
    if (c.needs_water === 0 && c.too_wet === 0 && c.missing === 0) {
      eyebrow = "All set";
      title = "Garden looks happy.";
      sub = `All ${c.good} plants in their ideal range.`;
    } else if (c.needs_water > 0) {
      const list = dryPlants.slice(0, 3).map((r) => r.name).join(", ");
      const more = dryPlants.length > 3 ? ` +${dryPlants.length - 3} more` : "";
      eyebrow = "Action needed";
      title = `${c.needs_water} plant${c.needs_water === 1 ? "" : "s"} need${c.needs_water === 1 ? "s" : ""} water`;
      sub = list + more;
    } else if (c.too_wet > 0) {
      eyebrow = "Heads up";
      title = `${c.too_wet} plant${c.too_wet === 1 ? "" : "s"} too wet`;
      sub = data.readings.filter((r) => r.status === "too_wet").map((r) => r.name).join(", ");
    } else {
      eyebrow = "Heads up";
      title = `${c.missing} sensor${c.missing === 1 ? "" : "s"} not reporting`;
      sub = "Check the affected gateway.";
    }

    const wx = data.weather;
    let weatherChip = "";
    if (wx.available) {
      const rainIn = wx.rain_soon_in ?? (wx.rain_soon_mm !== null ? wx.rain_soon_mm / 25.4 : null);
      const rainBit = rainIn === null ? ""
        : rainIn >= 0.1 ? `~${rainIn.toFixed(1)}" rain next 2 days`
        : "Little to no rain";
      const tempF = wx.high_today_f ?? (wx.high_today_c !== null ? Math.round(wx.high_today_c * 9/5 + 32) : null);
      const tempBit = tempF !== null ? `${tempF}°F high today` : "";
      const txt = [rainBit, tempBit].filter(Boolean).join(" · ");
      weatherChip = `<span class="hero-weather">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17.5 19a4.5 4.5 0 1 0-3.4-7.5A6 6 0 1 0 7 19h10.5z"/>
        </svg>
        ${escape(txt)}
      </span>`;
    }

    return `<section class="hero-card fade-in">
      <div class="h-eyebrow">${escape(eyebrow)}</div>
      <h2 class="h-title">${escape(title)}</h2>
      <p class="h-sub">${escape(sub)}</p>
      ${weatherChip}
      <div class="h-stats">
        <div class="hero-stat"><div class="num">${c.needs_water}</div><div class="lbl">NEED WATER</div></div>
        <div class="hero-stat"><div class="num">${c.too_wet}</div><div class="lbl">TOO WET</div></div>
        <div class="hero-stat"><div class="num">${c.good}</div><div class="lbl">DOING FINE</div></div>
        ${c.deferred ? `<div class="hero-stat"><div class="num">${c.deferred}</div><div class="lbl">RAIN COMING</div></div>` : ""}
        ${c.missing  ? `<div class="hero-stat"><div class="num">${c.missing}</div><div class="lbl">OFFLINE</div></div>` : ""}
      </div>
    </section>`;
  }

  function renderCard(r) {
    const emoji = emojiFor(r.name, r.type);
    const unverified = r.verified ? "" : `<span class="unverified" title="Channel-to-plant mapping not yet confirmed">unverified</span>`;
    const battery = r.battery !== null ? ` · ${r.battery.toFixed(1)}V` : "";

    let gauge = "";
    let moistureBlock = `<div class="moisture-row"><div class="moisture-val" style="color:var(--ink-3);font-size:18px">No reading</div></div>`;
    if (r.moisture !== null) {
      const clamp = (n) => Math.max(0, Math.min(100, n));
      const pct = clamp(r.moisture);
      const lo  = clamp(r.ideal_low);
      const hi  = clamp(r.ideal_high);
      gauge = `
        <div class="gauge" aria-hidden="true">
          <div class="gauge-ideal" style="left:${lo}%;width:${hi - lo}%"></div>
          <div class="gauge-bar" style="width:${pct}%"></div>
          <div class="gauge-mark" style="left:${pct}%"></div>
        </div>`;
      moistureBlock = `
        <div class="moisture-row">
          <div class="moisture-val">${Math.round(r.moisture)}<span class="pct">%</span></div>
          <div class="moisture-range">Ideal ${r.ideal_low}–${r.ideal_high}%</div>
        </div>
        ${gauge}`;
    }

    return `<article class="card fade-in" data-status="${r.status}">
      <div class="card-head">
        <div class="card-name-wrap">
          <div class="card-emoji" aria-hidden="true">${emoji}</div>
          <div class="card-name-text">
            <div class="card-name" title="${escape(r.name)}">${escape(r.name)}${unverified}</div>
            <div class="card-sub">${escape(r.zone)} · CH${r.channel}${battery}${r.pair_role ? ` · ${r.pair_role}` : ""}</div>
          </div>
        </div>
        <span class="badge badge--${r.status}">${escape(r.headline)}</span>
      </div>
      ${moistureBlock}
      <div class="advice">${escape(r.advice)}</div>
    </article>`;
  }

  function groupByZone(readings) {
    const zones = {};
    for (const r of readings) (zones[r.zone] ??= []).push(r);
    for (const k in zones) zones[k].sort((a, b) => a.channel - b.channel);
    return zones;
  }

  function renderReport(data) {
    const main = $("main");
    const zones = groupByZone(data.readings);
    const order = ["Back Yard", "Side Yards"];

    let html = renderHero(data);
    for (const z of order) {
      if (!zones[z]) continue;
      const cnt = zones[z].length;
      html += `
        <section class="zone">
          <div class="zone-head">
            <h2>${escape(z)}</h2>
            <span class="zone-count">${cnt} plant${cnt === 1 ? "" : "s"}</span>
          </div>
          <div class="grid">${zones[z].map(renderCard).join("")}</div>
        </section>`;
    }
    for (const [k, note] of Object.entries(data.pair_notes || {})) {
      html += `<div class="pair-note fade-in"><div><strong>${escape(k)} probe pair</strong> · ${escape(note)}</div></div>`;
    }
    main.innerHTML = html;
  }

  function renderSetup(data) {
    const main = $("main");
    const zones = groupByZone(data.readings);
    let html = `<div class="setup-intro fade-in">
      <strong>Channel mapping helper.</strong>
      The Ecowitt API doesn't return the labels you set in their app, so the channel-to-plant
      mapping lives in <code>backend/supabase/functions/plant-report/plants.ts</code>.
      Compare these readings to your Ecowitt app — any channel marked
      <span class="unverified" style="margin:0">unverified</span> needs a quick double-check.
    </div>`;
    for (const z of ["Back Yard", "Side Yards"]) {
      if (!zones[z]) continue;
      html += `<div class="setup-zone fade-in">
        <h3>${escape(z)}</h3>
        <table class="setup-table">
          <thead>
            <tr><th>CH</th><th>Plant</th><th class="num">Moisture</th><th class="num">Battery</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${zones[z].map((r) => `<tr>
              <td>CH${r.channel}</td>
              <td>${escape(r.name)}${r.verified ? "" : `<span class="unverified">unverified</span>`}</td>
              <td class="num">${r.moisture === null ? "—" : Math.round(r.moisture) + "%"}</td>
              <td class="num">${r.battery === null ? "—" : r.battery.toFixed(1) + "V"}</td>
              <td>${escape(r.headline)}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>`;
    }
    main.innerHTML = html;
  }

  function showError(title, msg) {
    $("meta").textContent = "Couldn't load the report.";
    $("main").innerHTML = `<div class="error-card fade-in">
      <h3>${escape(title)}</h3>
      <p>${msg}</p>
    </div>`;
    $("counts-meta").textContent = "";
  }

  /* ── data layer ───────────────────────────────────────────── */

  let lastData = null;
  let mode = "report"; // "report" | "setup"

  async function load() {
    const ep = cfg.endpoint;
    if (!ep) {
      showError("Setup needed",
        `Edit <code>web/config.js</code> and set <code>endpoint</code> to your deployed Supabase function URL.`);
      return;
    }
    const btn = $("refresh");
    btn.dataset.spinning = "true";
    btn.disabled = true;
    $("meta").textContent = "Fetching the latest readings…";
    try {
      const headers = { Accept: "application/json" };
      if (cfg.anonKey) {
        headers.apikey = cfg.anonKey;
        headers.Authorization = `Bearer ${cfg.anonKey}`;
      }
      const r = await fetch(ep, { headers, cache: "no-store" });
      if (!r.ok) throw new Error(`Backend returned HTTP ${r.status}`);
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      lastData = data;
      $("meta").textContent = `Updated ${relTime(data.generated_at)}`;
      $("counts-meta").textContent = `${data.readings.length} sensors`;
      (mode === "setup" ? renderSetup : renderReport)(data);
    } catch (e) {
      showError("Couldn't load the report",
        `${escape(e.message)}.<br/>Usually the function hasn't been deployed yet, the Ecowitt keys are wrong, or a sensor is offline.`);
    } finally {
      btn.dataset.spinning = "false";
      btn.disabled = false;
    }
  }

  /* ── auto-refresh while tab is visible ────────────────────── */
  let refreshTimer = null;
  function startAutoRefresh() {
    stopAutoRefresh();
    refreshTimer = setInterval(() => {
      if (!document.hidden) load();
    }, 5 * 60 * 1000); // every 5 minutes
  }
  function stopAutoRefresh() {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && lastData) {
      const age = Date.now() - new Date(lastData.generated_at).getTime();
      if (age > 60_000) load();
    }
  });

  /* ── interactions ─────────────────────────────────────────── */
  $("refresh").addEventListener("click", load);
  $("toggle-setup").addEventListener("click", () => {
    mode = mode === "report" ? "setup" : "report";
    $("toggle-setup").textContent = mode === "setup"
      ? "Back to plant report"
      : "Show channel-mapping helper";
    if (lastData) (mode === "setup" ? renderSetup : renderReport)(lastData);
    else load();
  });

  /* keep "Updated X ago" fresh */
  setInterval(() => {
    if (lastData) $("meta").textContent = `Updated ${relTime(lastData.generated_at)}`;
  }, 30_000);

  load();
  startAutoRefresh();
})();
