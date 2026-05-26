(function () {
  const cfg = window.PLANTWATCH_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  const fmtDateTime = (iso) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        weekday: "long", month: "long", day: "numeric",
        hour: "numeric", minute: "2-digit",
      });
    } catch { return iso; }
  };

  function statusBadge(status, headline) {
    return `<span class="badge ${status}">${headline}</span>`;
  }

  function bar(moisture, low, high) {
    const pct = (n) => Math.max(0, Math.min(100, n)) + "%";
    return `<div class="bar" aria-hidden="true">
      <div class="ideal" style="left:${pct(low)};right:${pct(100 - high)}"></div>
      <span style="width:${pct(moisture)}"></span>
      <div class="mark" style="left:${pct(moisture)}"></div>
    </div>`;
  }

  function renderCard(r) {
    const unverified = r.verified ? "" :
      `<span class="unverified" title="Channel-to-plant mapping not yet confirmed">unverified</span>`;
    const moistureLine = r.moisture === null
      ? `<div class="card-moisture" style="color:var(--muted);font-size:18px">no reading</div>`
      : `<div class="card-moisture">${Math.round(r.moisture)}<span style="font-size:18px;color:var(--muted)">%</span></div>
         ${bar(r.moisture, r.ideal_low, r.ideal_high)}
         <div class="card-range">Ideal ${r.ideal_low}–${r.ideal_high}% · ${r.type}${
           r.pair_role ? ` · ${r.pair_role} probe` : ""
         }</div>`;
    return `<article class="card">
      <div class="card-top">
        <div><span class="card-name">${r.name}</span>${unverified}</div>
        ${statusBadge(r.status, r.headline)}
      </div>
      <div class="card-ch">${r.zone} · CH${r.channel}${
        r.battery !== null ? ` · 🔋 ${r.battery.toFixed(1)}V` : ""
      }</div>
      ${moistureLine}
      <div class="card-advice">${r.advice}</div>
    </article>`;
  }

  function renderSummary(c) {
    const pills = [];
    if (c.needs_water) pills.push(`<span class="pill bad">${c.needs_water} need water</span>`);
    if (c.deferred)    pills.push(`<span class="pill warn">${c.deferred} dry but rain's coming</span>`);
    if (c.too_wet)     pills.push(`<span class="pill warn">${c.too_wet} too wet</span>`);
    if (c.good)        pills.push(`<span class="pill good">${c.good} doing fine</span>`);
    if (c.missing)     pills.push(`<span class="pill warn">${c.missing} not reporting</span>`);
    return pills.join("");
  }

  function renderWeather(wx) {
    if (!wx.available) return "";
    const rainTxt = wx.rain_soon_mm === null
      ? "No rain data."
      : wx.rain_soon_mm >= 1
        ? `<strong>~${Math.round(wx.rain_soon_mm)}mm</strong> rain expected over the next 2 days`
        : `little to no rain expected`;
    const tempTxt = wx.high_today_c !== null
      ? ` · high <strong>${Math.round(wx.high_today_c)}°C</strong>`
      : "";
    return `Weather: ${rainTxt}${tempTxt}`;
  }

  function groupByZone(readings) {
    const zones = {};
    for (const r of readings) (zones[r.zone] ??= []).push(r);
    return zones;
  }

  function render(data) {
    $("meta").textContent = `Last read ${fmtDateTime(data.generated_at)}`;

    const weatherHtml = renderWeather(data.weather);
    if (weatherHtml) { $("weather").innerHTML = weatherHtml; $("weather").classList.remove("hidden"); }
    else $("weather").classList.add("hidden");

    const summaryHtml = renderSummary(data.counts);
    if (summaryHtml) { $("summary").innerHTML = summaryHtml; $("summary").classList.remove("hidden"); }
    else $("summary").classList.add("hidden");

    const main = $("main");
    main.innerHTML = "";
    const zones = groupByZone(data.readings);
    const zoneOrder = ["Back Yard", "Side Yards"];
    for (const z of zoneOrder) {
      if (!zones[z]) continue;
      const section = document.createElement("section");
      section.className = "zone";
      section.innerHTML = `<h2>${z}</h2>
        <div class="grid">${zones[z].map(renderCard).join("")}</div>`;
      main.appendChild(section);
    }
    // Pair notes (avocado deep+shallow advisory)
    for (const [key, note] of Object.entries(data.pair_notes || {})) {
      const p = document.createElement("div");
      p.className = "pair-note";
      p.textContent = `Paired-probe note (${key}): ${note}`;
      main.appendChild(p);
    }
  }

  function renderSetup(data) {
    const main = $("main");
    main.innerHTML = "";
    const wrap = document.createElement("section");
    wrap.className = "setup";
    wrap.innerHTML = `
      <p>Use this to confirm the channel-to-plant mapping. The Ecowitt API
      doesn't return the labels you set in the app, so they have to be edited
      in <code>backend/supabase/functions/plant-report/plants.ts</code>.</p>`;
    for (const z of ["Back Yard", "Side Yards"]) {
      const rows = data.readings.filter((r) => r.zone === z).sort((a, b) => a.channel - b.channel);
      wrap.innerHTML += `<h2>${z}</h2>
        <table>
          <thead><tr><th>CH</th><th>Current name</th><th class="num">Moisture</th><th class="num">Battery</th><th>Status</th></tr></thead>
          <tbody>
            ${rows.map((r) => `<tr>
              <td>CH${r.channel}</td>
              <td>${r.name}${r.verified ? "" : ' <span class="unverified">unverified</span>'}</td>
              <td class="num">${r.moisture === null ? "—" : Math.round(r.moisture) + "%"}</td>
              <td class="num">${r.battery === null ? "—" : r.battery.toFixed(1) + "V"}</td>
              <td>${r.headline}</td>
            </tr>`).join("")}
          </tbody>
        </table>`;
    }
    main.appendChild(wrap);
  }

  function showError(msg) {
    $("meta").textContent = "Something went wrong.";
    $("weather").classList.add("hidden");
    $("summary").classList.add("hidden");
    $("main").innerHTML = `<div class="status-msg error">${msg}</div>`;
  }

  let lastData = null;
  let mode = "report"; // "report" or "setup"

  async function load() {
    if (!cfg.endpoint) {
      showError(`No endpoint configured. Edit <code>web/config.js</code> and set
        <code>endpoint</code> to your Supabase function URL
        (e.g. <code>https://YOUR-PROJECT.supabase.co/functions/v1/plant-report</code>).`);
      return;
    }
    $("refresh").disabled = true;
    $("meta").textContent = "Fetching…";
    try {
      const headers = { "Accept": "application/json" };
      if (cfg.anonKey) {
        headers["apikey"] = cfg.anonKey;
        headers["Authorization"] = `Bearer ${cfg.anonKey}`;
      }
      const r = await fetch(cfg.endpoint, { headers, cache: "no-store" });
      if (!r.ok) throw new Error(`Backend returned HTTP ${r.status}`);
      const data = await r.json();
      if (data.error) throw new Error(data.error);
      lastData = data;
      mode === "setup" ? renderSetup(data) : render(data);
    } catch (e) {
      showError(`Couldn't load the report: ${e.message}.<br/>
        Usually the Ecowitt keys/MAC are wrong, the weather coordinates are
        missing, or the function hasn't been deployed yet.`);
    } finally {
      $("refresh").disabled = false;
    }
  }

  $("refresh").addEventListener("click", load);
  $("toggle-setup").addEventListener("click", () => {
    mode = mode === "report" ? "setup" : "report";
    $("toggle-setup").textContent = mode === "setup"
      ? "Back to plant report"
      : "Show channel-mapping helper";
    if (lastData) (mode === "setup" ? renderSetup : render)(lastData);
    else load();
  });

  load();
})();
