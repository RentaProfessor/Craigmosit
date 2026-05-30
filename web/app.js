/* ─────────────────────────────────────────────────────────────
   PlantWatch — dashboard logic
   ───────────────────────────────────────────────────────────── */
(function () {
  const cfg = window.PLANTWATCH_CONFIG || {};
  const $ = (id) => document.getElementById(id);

  /* ─────────────────────────────────────────────────────────────
     Local preferences: per-plant range overrides + notifications
     ───────────────────────────────────────────────────────────── */
  const PREF = {
    overrides:   "pw-overrides",        // { "Back Yard-4": {low, high} }
    assignments: "pw-assignments",      // { "Front Yard-7": {name, species, low, high} }
    notifyMode:  "pw-notify-mode",      // "off" | "dry" | "wet" | "both"
    notifyOn:    "pw-notify-plants",    // ["Back Yard-4", ...]
    lastStatus:  "pw-last-status",      // { "Back Yard-4": "good" }
  };
  const lsRead  = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const lsWrite = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const getOverrides     = () => lsRead(PREF.overrides, {});
  const setOverride      = (id, low, high) => { const o = getOverrides(); o[id] = { low, high }; lsWrite(PREF.overrides, o); };
  const clearOverride    = (id) => { const o = getOverrides(); delete o[id]; lsWrite(PREF.overrides, o); };

  const getAssignments   = () => lsRead(PREF.assignments, {});
  const setAssignment    = (id, a) => { const o = getAssignments(); o[id] = a; lsWrite(PREF.assignments, o); };
  const clearAssignment  = (id) => { const o = getAssignments(); delete o[id]; lsWrite(PREF.assignments, o); };

  // Species catalog from the API (presets for the assign dropdown).
  let speciesCatalog = [];
  const findSpecies = (key) => speciesCatalog.find(s => s.key === key);

  const getNotifyMode    = () => localStorage.getItem(PREF.notifyMode) || "off";
  const setNotifyMode    = (m) => localStorage.setItem(PREF.notifyMode, m);

  const getNotifyPlants  = () => new Set(lsRead(PREF.notifyOn, []));
  const isNotifyOn       = (id) => getNotifyPlants().has(id);
  const setNotifyOn      = (id, on) => {
    const s = getNotifyPlants();
    if (on) s.add(id); else s.delete(id);
    lsWrite(PREF.notifyOn, Array.from(s));
  };

  // Apply overrides + recompute status client-side so the rest of the UI
  // and the notification check both see the user's adjusted band.
  // Compute status/headline/advice for a moisture value against a low/high band.
  function classify(m, low, high, speciesLabel) {
    if (m === null) return { status: "no_reading", headline: "No reading", needs_water: false };
    if (m < low) {
      const gap = low - m, vd = gap >= 12;
      return { status: vd ? "very_dry" : "dry", headline: vd ? "VERY DRY" : "Dry", needs_water: true };
    }
    if (m > high) return { status: "too_wet", headline: "Too wet", needs_water: false };
    return { status: "good", headline: "Good", needs_water: false };
  }

  function applyOverrides(readings) {
    const ov = getOverrides();
    const asg = getAssignments();
    return readings.map(r => {
      const id = `${r.zone}-${r.channel}`;

      // 1) Assigned (previously unassigned) sensor → become a full plant card
      if (r.status === "unassigned" && asg[id]) {
        const a = asg[id];
        const sp = findSpecies(a.species);
        const c = classify(r.moisture, a.low, a.high, a.species);
        const adviceBits = r.moisture === null ? "Sensor isn't reporting."
          : c.status === "good" ? `In range — at ${Math.round(r.moisture)}% you're inside the ideal ${a.low}–${a.high}% band.`
          : c.status === "too_wet" ? `Hold off — at ${Math.round(r.moisture)}% you're above the ${a.high}% ceiling.`
          : `Water — at ${Math.round(r.moisture)}% you're below the ${a.low}% floor.`;
        return {
          ...r,
          name: a.name || r.name,
          species: a.species || "custom",
          type: a.species || "custom",
          ideal_low: a.low, ideal_high: a.high,
          ...c,
          advice: adviceBits + (sp?.why ? " " + sp.why : ""),
          species_note: sp?.why || null,
          source_label: sp?.source_label || null,
          source_url: sp?.source_url || null,
          rating_explanation: r.moisture === null ? null
            : `At ${Math.round(r.moisture)}% against your ${a.low}–${a.high}% band, this reads as ${c.headline.toLowerCase()}.`,
          custom_assigned: true,
          custom_range: false,
        };
      }
      // 2) Still unassigned (no local assignment yet)
      if (r.status === "unassigned") return { ...r, custom_range: false };

      // 3) Range override on a known plant
      const o = ov[id];
      if (!o) return { ...r, custom_range: false };
      const m = r.moisture;
      if (m === null) return { ...r, custom_range: true, ideal_low: o.low, ideal_high: o.high };
      let status, headline;
      if (m < o.low) {
        const gap = o.low - m;
        const vd  = gap >= 12;
        status = vd ? "very_dry" : "dry";
        headline = vd ? "VERY DRY" : "Dry";
      } else if (m > o.high) {
        status = "too_wet"; headline = "Too wet";
      } else {
        status = "good";    headline = "Good";
      }
      return {
        ...r,
        ideal_low: o.low, ideal_high: o.high,
        status, headline,
        needs_water: status === "dry" || status === "very_dry",
        custom_range: true,
      };
    });
  }

  // Fire browser notifications when a plant's status worsens, respecting
  // the global mode + per-plant opt-in.
  async function notifyIfChanged(readings) {
    const mode = getNotifyMode();
    if (mode === "off") return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    const last = lsRead(PREF.lastStatus, {});
    const cur  = {};
    for (const r of readings) {
      const id = `${r.zone}-${r.channel}`;
      cur[id] = r.status;
      if (!isNotifyOn(id)) continue;

      const prev = last[id];
      if (prev === r.status) continue;       // unchanged

      const becameDry = (r.status === "dry" || r.status === "very_dry") &&
                        (prev !== "dry" && prev !== "very_dry");
      const becameWet = r.status === "too_wet" && prev !== "too_wet";

      const fireDry = (mode === "dry" || mode === "both") && becameDry;
      const fireWet = (mode === "wet" || mode === "both") && becameWet;

      if (fireDry || fireWet) {
        try {
          new Notification(`🌱 ${r.name}`, {
            body: `${r.headline} · ${Math.round(r.moisture)}% (ideal ${r.ideal_low}–${r.ideal_high}%)`,
            tag: id,
            icon: "icon-192.png",
          });
        } catch (_) {}
      }
    }
    lsWrite(PREF.lastStatus, cur);
  }

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
    const total = c.needs_water + c.too_wet + c.good + (c.missing || 0);
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

    // Weather lives ONLY at the top — plain today/tomorrow, no predictive chips.
    const wx = data.weather;
    let weatherChip = "";
    if (wx.available) {
      const parts = [];
      if (wx.temp_now_f !== null && wx.temp_now_f !== undefined) parts.push(`Now ${wx.temp_now_f}°F`);
      if (wx.humidity_now !== null && wx.humidity_now !== undefined) parts.push(`${wx.humidity_now}% RH`);
      if (wx.high_today_f !== null) {
        const lo = (wx.low_today_f !== null && wx.low_today_f !== undefined) ? ` / ${wx.low_today_f}°F low` : "";
        parts.push(`Today ${wx.high_today_f}°F${lo}`);
      }
      if (wx.rain_today_in && wx.rain_today_in >= 0.05) parts.push(`${wx.rain_today_in.toFixed(2)}" rain today`);
      if (wx.high_tomorrow_f !== null && wx.high_tomorrow_f !== undefined) {
        let tomBit = `Tomorrow ${wx.high_tomorrow_f}°F`;
        if (wx.rain_tomorrow_in && wx.rain_tomorrow_in >= 0.05) tomBit += `, ${wx.rain_tomorrow_in.toFixed(2)}" rain`;
        parts.push(tomBit);
      }
      const txt = parts.join(" · ");
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
    const hasRange = r.ideal_low !== null && r.ideal_high !== null;
    if (r.moisture !== null && hasRange) {
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
    } else if (r.moisture !== null) {
      // Unassigned sensor — show the reading but no ideal band yet.
      moistureBlock = `
        <div class="moisture-row">
          <div class="moisture-val">${Math.round(r.moisture)}<span class="pct">%</span></div>
          <div class="moisture-range">No range set</div>
        </div>`;
    }

    const readingId = `${r.zone}-${r.channel}`;
    const isOpen = openInfo.has(readingId);
    const infoPanel = isOpen ? renderInfoPanel(r) : "";
    return `<article class="card fade-in${isOpen ? " card--info-open" : ""}" data-status="${r.status}" data-id="${escape(readingId)}">
      <div class="card-head">
        <div class="card-name-wrap">
          <div class="card-emoji" aria-hidden="true">${emoji}</div>
          <div class="card-name-text">
            <div class="card-name" title="${escape(r.name)}">${escape(r.name)}${unverified}</div>
            <div class="card-sub">CH${r.channel}${battery}${r.physical_zone_verified === false ? ` · <span class="unverified">zone unverified</span>` : ""}${r.pair_role ? ` · ${r.pair_role}` : ""}</div>
          </div>
        </div>
        <div class="card-head-right">
          <span class="badge badge--${r.status}">${escape(r.headline)}</span>
          <button class="info-btn" data-info-id="${escape(readingId)}" aria-label="Plant details" aria-expanded="${isOpen}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><circle cx="12" cy="8" r=".5" fill="currentColor" stroke="currentColor"/>
            </svg>
          </button>
        </div>
      </div>
      ${moistureBlock}
      <div class="advice">${escape(r.advice)}</div>
      ${infoPanel}
    </article>`;
  }

  function renderInfoPanel(r) {
    const id = `${r.zone}-${r.channel}`;
    // Unassigned (and not yet locally assigned) → show the Assign form.
    if (r.status === "unassigned") {
      return `<div class="info-panel">${renderAssignForm(r, id)}</div>`;
    }
    const sourceLink = (r.source_label && r.source_url)
      ? `<div class="info-source">Source: <a href="${escape(r.source_url)}" target="_blank" rel="noopener">${escape(r.source_label)}</a></div>`
      : "";
    const assignedNote = r.custom_assigned
      ? `<div class="info-section"><button class="link-btn unassign-btn" data-plant-id="${escape(id)}">Remove label (back to Unassigned)</button></div>`
      : "";
    const sections = [
      r.rating_explanation ? `<div class="info-section"><div class="info-label">Why this rating</div><div class="info-text">${escape(r.rating_explanation)}</div></div>` : "",
      r.watering_recommendation ? `<div class="info-section"><div class="info-label">Suggested watering</div><div class="info-text">${escape(r.watering_recommendation)}</div></div>` : "",
      r.species_note ? `<div class="info-section"><div class="info-label">Why ${escape(r.species)} needs this range</div><div class="info-text">${escape(r.species_note)}</div>${sourceLink}</div>` : "",
      renderRangeEditor(r, id),
      renderNotifyToggle(r, id),
      assignedNote,
    ].filter(Boolean).join("");
    return `<div class="info-panel">${sections}</div>`;
  }

  // Form to label + configure an unassigned sensor.
  function renderAssignForm(r, id) {
    const opts = speciesCatalog.map(s =>
      `<option value="${escape(s.key)}" data-low="${s.low}" data-high="${s.high}">${escape(titleCase(s.key))} (${s.low}–${s.high}%)</option>`
    ).join("");
    return `<div class="assign-form" data-plant-id="${escape(id)}">
      <div class="info-section">
        <div class="info-label">Label this sensor</div>
        <input type="text" class="assign-name text-input" placeholder="e.g. Tomato Bed, Rose Hedge…" />
      </div>
      <div class="info-section">
        <div class="info-label">Plant type (sets the ideal range)</div>
        <select class="assign-species select-input">
          <option value="custom" data-low="30" data-high="50">Custom / Other</option>
          ${opts}
        </select>
      </div>
      <div class="info-section">
        <div class="info-label">Ideal range</div>
        <div class="range-editor">
          <div class="range-row">
            <label>Low</label>
            <input type="range" min="5" max="80" value="30" class="range-input assign-low" />
            <span class="range-val assign-low-val">30%</span>
          </div>
          <div class="range-row">
            <label>High</label>
            <input type="range" min="20" max="95" value="50" class="range-input assign-high" />
            <span class="range-val assign-high-val">50%</span>
          </div>
        </div>
      </div>
      <button class="assign-save-btn">Save & assign</button>
    </div>`;
  }

  const titleCase = (s) => String(s || "").replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  function renderRangeEditor(r, id) {
    const isCustom = !!r.custom_range;
    const customBadge = isCustom ? `<span class="custom-badge">Custom</span>` : "";
    const resetBtn   = isCustom ? `<button class="link-btn reset-range-btn" data-plant-id="${escape(id)}">Reset to default</button>` : "";
    return `<div class="info-section">
      <div class="info-label">Adjust ideal range ${customBadge}</div>
      <div class="range-editor" data-plant-id="${escape(id)}">
        <div class="range-row">
          <label>Low</label>
          <input type="range" min="5" max="80" value="${r.ideal_low}" class="range-input range-low" />
          <span class="range-val range-low-val">${r.ideal_low}%</span>
        </div>
        <div class="range-row">
          <label>High</label>
          <input type="range" min="20" max="95" value="${r.ideal_high}" class="range-input range-high" />
          <span class="range-val range-high-val">${r.ideal_high}%</span>
        </div>
        ${resetBtn}
      </div>
    </div>`;
  }

  function renderNotifyToggle(r, id) {
    const on = isNotifyOn(id);
    const mode = getNotifyMode();
    const hint = mode === "off"
      ? `Global notifications are off — enable in <button class="link-btn open-settings-btn">Settings</button>.`
      : `Will alert when ${mode === "both" ? "too dry OR too wet" : (mode === "dry" ? "too dry" : "too wet")}.`;
    return `<div class="info-section">
      <div class="info-label">Alerts for this plant</div>
      <div class="notify-row">
        <label class="switch">
          <input type="checkbox" class="notify-toggle" data-plant-id="${escape(id)}" ${on ? "checked" : ""}/>
          <span class="slider-pill"></span>
        </label>
        <span class="notify-state">${on ? "On" : "Off"}</span>
      </div>
      <div class="notify-hint">${hint}</div>
    </div>`;
  }

  // Group by physical_zone (Back Yard / Side Yards) — what the user thinks about.
  // Falls back to gateway 'zone' if backend doesn't provide physical_zone.
  function groupByPhysicalZone(readings) {
    const zones = {};
    for (const r of readings) {
      // Unassigned sensors get their own group regardless of gateway.
      const z = r.status === "unassigned" ? "Unassigned" : (r.physical_zone || r.zone || "Other");
      (zones[z] ??= []).push(r);
    }
    for (const k in zones) {
      zones[k].sort((a, b) => {
        const z = (a.zone || "").localeCompare(b.zone || "");
        if (z !== 0) return z;
        return (a.display_order ?? a.channel) - (b.display_order ?? b.channel);
      });
    }
    return zones;
  }

  // Filter state: "all" | "Back Yard" | "Side Yards"
  let zoneFilter = "all";
  // Layout state: "grid" (responsive 2/3/4-col) | "list" (single column)
  let layoutMode = localStorage.getItem("pw-layout") || "grid";
  // Track which card info panels are open (by reading id)
  const openInfo = new Set();

  function renderFilterChips(zones) {
    const chip = (key, label, count) => {
      const active = zoneFilter === key ? " filter-chip--active" : "";
      return `<button class="filter-chip${active}" data-filter="${escape(key)}">${escape(label)} <span class="filter-count">${count ?? 0}</span></button>`;
    };
    const layoutBtn = (key, label, icon) => {
      const active = layoutMode === key ? " layout-btn--active" : "";
      return `<button class="layout-btn${active}" data-layout="${key}" aria-label="${label} view">${icon}</button>`;
    };
    const gridIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>`;
    const listIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="18" height="3" rx="1.5"/><rect x="3" y="10.5" width="18" height="3" rx="1.5"/><rect x="3" y="17" width="18" height="3" rx="1.5"/></svg>`;
    const total = Object.values(zones).reduce((s, a) => s + a.length, 0);
    let chips = chip("all", "All", total);
    for (const z of ["Back Yard", "Side Yards", "Front Yard"]) {
      if (zones[z]?.length) chips += chip(z, z, zones[z].length);
    }
    if (zones["Unassigned"]?.length) chips += chip("Unassigned", "Unassigned", zones["Unassigned"].length);
    return `<div class="filter-row">
      <div class="filter-chips">${chips}</div>
      <div class="layout-toggle" role="group" aria-label="Layout">
        ${layoutBtn("grid", "Grid", gridIcon)}
        ${layoutBtn("list", "List", listIcon)}
      </div>
    </div>`;
  }

  function renderReport(data) {
    const main = $("main");
    const zones = groupByPhysicalZone(data.readings);
    const order = ["Back Yard", "Side Yards", "Front Yard", "Unassigned"];

    let html = renderHero(data) + renderFilterChips(zones);

    for (const z of order) {
      if (!zones[z]) continue;
      if (zoneFilter !== "all" && zoneFilter !== z) continue;
      const cnt = zones[z].length;
      const noun = z === "Unassigned" ? "sensor" : "plant";
      html += `
        <section class="zone">
          <div class="zone-head">
            <h2>${escape(z)}</h2>
            <span class="zone-count">${cnt} ${noun}${cnt === 1 ? "" : "s"}</span>
          </div>
          <div class="grid grid--${layoutMode}">${zones[z].map(renderCard).join("")}</div>
        </section>`;
    }
    for (const [k, note] of Object.entries(data.pair_notes || {})) {
      html += `<div class="pair-note fade-in"><div><strong>${escape(k)} probe pair</strong> · ${escape(note)}</div></div>`;
    }
    main.innerHTML = html;

    // Wire up filter buttons
    main.querySelectorAll(".filter-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        zoneFilter = btn.dataset.filter;
        renderReport(data);
      });
    });
    // Layout toggle buttons
    main.querySelectorAll(".layout-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        layoutMode = btn.dataset.layout;
        localStorage.setItem("pw-layout", layoutMode);
        renderReport(data);
      });
    });
    // Info button toggles
    main.querySelectorAll(".info-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const id = btn.dataset.infoId;
        if (openInfo.has(id)) openInfo.delete(id); else openInfo.add(id);
        renderReport(data);
      });
    });

    // Range editor sliders (debounced save)
    main.querySelectorAll(".range-editor").forEach(ed => {
      const id     = ed.dataset.plantId;
      const lowEl  = ed.querySelector(".range-low");
      const highEl = ed.querySelector(".range-high");
      const lowVal = ed.querySelector(".range-low-val");
      const highVal= ed.querySelector(".range-high-val");
      let saveTimer;
      const sync = () => {
        let lo = +lowEl.value, hi = +highEl.value;
        if (lo >= hi) { lo = Math.min(hi - 1, lo); lowEl.value = lo; }
        lowVal.textContent  = lo + "%";
        highVal.textContent = hi + "%";
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          setOverride(id, lo, hi);
          fetchAndRender();
        }, 400);
      };
      lowEl.addEventListener("input", sync);
      highEl.addEventListener("input", sync);
    });
    main.querySelectorAll(".reset-range-btn").forEach(b => {
      b.addEventListener("click", () => {
        clearOverride(b.dataset.plantId);
        fetchAndRender();
      });
    });

    // Assign form for unassigned sensors
    main.querySelectorAll(".assign-form").forEach(form => {
      const id      = form.dataset.plantId;
      const nameEl  = form.querySelector(".assign-name");
      const spEl    = form.querySelector(".assign-species");
      const lowEl   = form.querySelector(".assign-low");
      const highEl  = form.querySelector(".assign-high");
      const lowVal  = form.querySelector(".assign-low-val");
      const highVal = form.querySelector(".assign-high-val");
      const syncVals = () => {
        let lo = +lowEl.value, hi = +highEl.value;
        if (lo >= hi) { lo = hi - 1; lowEl.value = lo; }
        lowVal.textContent = lo + "%"; highVal.textContent = hi + "%";
      };
      // Selecting a species prefills its range
      spEl.addEventListener("change", () => {
        const opt = spEl.selectedOptions[0];
        if (opt?.dataset.low) { lowEl.value = opt.dataset.low; highEl.value = opt.dataset.high; syncVals(); }
        if (!nameEl.value && spEl.value !== "custom") nameEl.value = titleCase(spEl.value);
      });
      lowEl.addEventListener("input", syncVals);
      highEl.addEventListener("input", syncVals);
      form.querySelector(".assign-save-btn").addEventListener("click", () => {
        const species = spEl.value;
        const name = nameEl.value.trim() || (species !== "custom" ? titleCase(species) : "Unnamed");
        setAssignment(id, { name, species, low: +lowEl.value, high: +highEl.value });
        openInfo.delete(id);   // collapse after saving
        fetchAndRender();
      });
    });

    // Unassign (remove a local label)
    main.querySelectorAll(".unassign-btn").forEach(b => {
      b.addEventListener("click", () => {
        clearAssignment(b.dataset.plantId);
        fetchAndRender();
      });
    });

    // Per-plant notification toggle
    main.querySelectorAll(".notify-toggle").forEach(t => {
      t.addEventListener("change", async () => {
        const on = t.checked;
        if (on && typeof Notification !== "undefined" && Notification.permission === "default") {
          await Notification.requestPermission();
        }
        setNotifyOn(t.dataset.plantId, on);
        renderReport(data);
      });
    });

    // "Open settings" links inside info panels
    main.querySelectorAll(".open-settings-btn").forEach(b => {
      b.addEventListener("click", openGlobalSettings);
    });
  }

  // Re-render using the current cached data after a preference change,
  // without forcing a network roundtrip.
  function recountReadings(readings) {
    return {
      needs_water: readings.filter(r => r.needs_water).length,
      too_wet:     readings.filter(r => r.status === "too_wet").length,
      good:        readings.filter(r => r.status === "good").length,
      missing:     readings.filter(r => r.status === "no_reading").length,
      unassigned:  readings.filter(r => r.status === "unassigned").length,
    };
  }

  // Re-apply local prefs from the pristine server snapshot (no double-apply).
  function fetchAndRender() {
    if (!lastData || !rawReadings) return;
    lastData.readings = applyOverrides(rawReadings);
    lastData.counts = recountReadings(lastData.readings);
    renderReport(lastData);
  }

  // Global notification settings — opens a small modal anchored to the gear
  function openGlobalSettings() {
    const cur = getNotifyMode();
    const opts = [
      { v: "off",  label: "Off" },
      { v: "dry",  label: "Only when too dry" },
      { v: "wet",  label: "Only when too wet" },
      { v: "both", label: "Both dry and too wet" },
    ];
    const perm = (typeof Notification !== "undefined") ? Notification.permission : "unsupported";

    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    wrap.innerHTML = `
      <div class="modal">
        <div class="modal-head">
          <h3>Notifications</h3>
          <button class="icon-btn modal-close" aria-label="Close">×</button>
        </div>
        <div class="modal-body">
          <div class="info-label" style="margin-bottom:6px">When to alert</div>
          ${opts.map(o => `
            <label class="radio-row">
              <input type="radio" name="notify-mode" value="${o.v}" ${cur === o.v ? "checked" : ""}/>
              <span>${o.label}</span>
            </label>`).join("")}
          <div class="modal-divider"></div>
          <div class="info-label" style="margin-bottom:4px">Browser permission</div>
          <div class="info-text" style="margin-bottom:8px">${
            perm === "granted" ? "✅ Granted" :
            perm === "denied"  ? "❌ Denied — enable in browser settings" :
            perm === "default" ? "Not yet requested — turn on a plant toggle to request" :
            "Notifications are not supported in this browser."
          }</div>
          <div class="info-text" style="font-size:12px;color:var(--ink-3)">
            Per-plant toggles live in each plant's info panel (tap the ⓘ on a card).
            Alerts fire when the dashboard is open or recently active.
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const close = () => wrap.remove();
    wrap.querySelector(".modal-close").addEventListener("click", close);
    wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
    wrap.querySelectorAll('input[name="notify-mode"]').forEach(r => {
      r.addEventListener("change", () => {
        setNotifyMode(r.value);
        if (r.value !== "off" && typeof Notification !== "undefined" && Notification.permission === "default") {
          Notification.requestPermission();
        }
        if (lastData) renderReport(lastData);
      });
    });
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
  let rawReadings = null;   // untouched server readings, before local prefs
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
      if (Array.isArray(data.species_catalog)) speciesCatalog = data.species_catalog;
      // Keep a pristine copy of server readings, then apply local prefs.
      rawReadings = data.readings;
      data.readings = applyOverrides(rawReadings);
      data.counts = recountReadings(data.readings);
      lastData = data;
      $("meta").textContent = `Updated ${relTime(data.generated_at)}`;
      $("counts-meta").textContent = `${data.readings.length} sensors`;
      (mode === "setup" ? renderSetup : renderReport)(data);
      // Fire notifications for any plant whose status worsened
      notifyIfChanged(data.readings);
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
    }, 60 * 1000); // every 60 seconds
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
  $("settings").addEventListener("click", openGlobalSettings);
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
