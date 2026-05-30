/* ─────────────────────────────────────────────────────────────
   PlantWatch — authentication + onboarding (self-contained).
   Owns the login screen, session, and the new-user setup flow.
   The dashboard (app.js) only calls PW_AUTH.start(onReady),
   PW_AUTH.getAccessToken(), PW_AUTH.signOut(), PW_AUTH.showOnboarding().
   ───────────────────────────────────────────────────────────── */
window.PW_AUTH = (function () {
  const cfg = window.PLANTWATCH_CONFIG || {};
  const SKEY = "pw-session";
  let session = null;
  try { session = JSON.parse(localStorage.getItem(SKEY) || "null"); } catch (_) {}

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const SPECIES = [
    ["citrus", "Citrus (orange, lemon, lime…)"],
    ["avocado", "Avocado"],
    ["camellia", "Camellia"],
    ["hydrangea", "Hydrangea"],
    ["rosemary", "Rosemary"],
    ["lavender", "Lavender"],
    ["westringia", "Westringia (coast rosemary)"],
    ["bay_laurel", "Bay Laurel"],
    ["star_jasmine", "Star Jasmine"],
    ["boxwood", "Boxwood"],
    ["convolvulus", "Convolvulus (silverbush)"],
    ["unknown", "Other / not sure"],
  ];

  /* ── session helpers ──────────────────────────────────────── */
  function saveSession(s) { session = s; localStorage.setItem(SKEY, JSON.stringify(s)); }
  function clearSession() { session = null; localStorage.removeItem(SKEY); }
  const userId = () => session?.user?.id;
  const email  = () => session?.user?.email;

  async function gotrue(path, body) {
    const r = await fetch(`${cfg.supabaseUrl}/auth/v1/${path}`, {
      method: "POST",
      headers: { apikey: cfg.supabaseAnonKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error_description || d.msg || d.error || `Error ${r.status}`);
    return d;
  }
  async function signIn(em, pw) { saveSession(await gotrue("token?grant_type=password", { email: em, password: pw })); }
  async function signUp(em, pw) {
    const d = await gotrue("signup", { email: em, password: pw });
    if (d.access_token) saveSession(d);
    return d; // may require email confirmation if no access_token
  }
  async function refresh() {
    if (!session?.refresh_token) return false;
    try { saveSession(await gotrue("token?grant_type=refresh_token", { refresh_token: session.refresh_token })); return true; }
    catch (_) { clearSession(); return false; }
  }
  async function getAccessToken() {
    if (!session) return null;
    const expMs = (session.expires_at || 0) * 1000;
    if (Date.now() > expMs - 60_000) { if (!(await refresh())) return null; }
    return session.access_token;
  }
  function signOut() { clearSession(); location.reload(); }

  // Authenticated PostgREST helper (RLS scopes to this user)
  async function rest(path, opts = {}) {
    const token = await getAccessToken();
    const r = await fetch(`${cfg.supabaseUrl}/rest/v1/${path}`, {
      method: opts.method || "GET",
      headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${token}`,
                 "Content-Type": "application/json", ...(opts.headers || {}) },
      body: opts.body,
    });
    if (!r.ok) throw new Error(`DB error ${r.status}: ${await r.text()}`);
    return r.status === 204 ? null : r.json();
  }

  /* ── overlay plumbing ─────────────────────────────────────── */
  function overlay() {
    let el = document.getElementById("pw-auth-overlay");
    if (!el) { el = document.createElement("div"); el.id = "pw-auth-overlay"; document.body.appendChild(el); }
    return el;
  }
  function closeOverlay() { const el = document.getElementById("pw-auth-overlay"); if (el) el.remove(); }
  function showApp(show) { const app = document.querySelector(".app"); if (app) app.style.display = show ? "" : "none"; }

  /* ── login / signup screen ────────────────────────────────── */
  function renderAuth(onSuccess, startMode = "signin") {
    showApp(false);
    let amode = startMode; // "signin" | "signup"
    const el = overlay();
    const draw = () => {
      el.innerHTML = `
        <div class="auth-card">
          <div class="auth-brand">
            <span class="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a7 7 0 0 0-7 7c0 3.5 2.5 6 7 13 4.5-7 7-9.5 7-13a7 7 0 0 0-7-7z"/><path d="M12 11v11"/>
              </svg>
            </span>
            <h1>PlantWatch</h1>
          </div>
          <p class="auth-sub">${amode === "signin" ? "Sign in to your garden" : "Create your account"}</p>
          <form id="auth-form" class="auth-form">
            <label class="auth-field"><span>Email</span>
              <input type="email" id="auth-email" autocomplete="email" inputmode="email" required placeholder="you@example.com"/></label>
            <label class="auth-field"><span>Password</span>
              <input type="password" id="auth-pass" autocomplete="${amode === "signin" ? "current-password" : "new-password"}" required minlength="6" placeholder="••••••••"/></label>
            <div id="auth-error" class="auth-error" hidden></div>
            <button type="submit" id="auth-submit" class="auth-submit">${amode === "signin" ? "Sign in" : "Create account"}</button>
          </form>
          <div class="auth-toggle">
            ${amode === "signin"
              ? `New here? <button class="link-btn" id="auth-switch">Create an account</button>`
              : `Already have an account? <button class="link-btn" id="auth-switch">Sign in</button>`}
          </div>
        </div>`;
      const form = el.querySelector("#auth-form");
      const errEl = el.querySelector("#auth-error");
      el.querySelector("#auth-switch").addEventListener("click", () => { amode = amode === "signin" ? "signup" : "signin"; draw(); });
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        errEl.hidden = true;
        const btn = el.querySelector("#auth-submit");
        btn.disabled = true; btn.textContent = amode === "signin" ? "Signing in…" : "Creating…";
        const em = el.querySelector("#auth-email").value.trim();
        const pw = el.querySelector("#auth-pass").value;
        try {
          if (amode === "signin") { await signIn(em, pw); }
          else {
            const d = await signUp(em, pw);
            if (!d.access_token) { // email confirmation required
              errEl.textContent = "Check your email to confirm your account, then sign in.";
              errEl.hidden = false; btn.disabled = false; btn.textContent = "Create account";
              amode = "signin"; return;
            }
          }
          closeOverlay(); onSuccess();
        } catch (err) {
          errEl.textContent = err.message || "Something went wrong.";
          errEl.hidden = false;
          btn.disabled = false; btn.textContent = amode === "signin" ? "Sign in" : "Create account";
        }
      });
    };
    draw();
  }

  /* ── onboarding (new users): connect Ecowitt → organize devices ── */
  function showOnboarding(onDone) {
    showApp(false);
    const el = overlay();
    let gateways = null; // discovered

    const stepConnect = (errMsg) => {
      el.innerHTML = `
        <div class="auth-card onboard-card">
          <div class="auth-brand"><h1>Set up your garden</h1></div>
          <p class="auth-sub">Enter the Ecowitt keys for your sensors. (Your installer provides these.)</p>
          <form id="ob-form" class="auth-form">
            <label class="auth-field"><span>Application Key</span>
              <input type="text" id="ob-app" required placeholder="Ecowitt Application Key"/></label>
            <label class="auth-field"><span>API Key</span>
              <input type="text" id="ob-api" required placeholder="Ecowitt API Key"/></label>
            <div id="ob-error" class="auth-error" ${errMsg ? "" : "hidden"}>${esc(errMsg || "")}</div>
            <button type="submit" class="auth-submit" id="ob-discover">Discover my devices</button>
          </form>
          <div class="auth-toggle"><button class="link-btn" id="ob-signout">Sign out</button></div>
        </div>`;
      el.querySelector("#ob-signout").addEventListener("click", signOut);
      el.querySelector("#ob-form").addEventListener("submit", async (e) => {
        e.preventDefault();
        const btn = el.querySelector("#ob-discover"); btn.disabled = true; btn.textContent = "Connecting…";
        const app_key = el.querySelector("#ob-app").value.trim();
        const api_key = el.querySelector("#ob-api").value.trim();
        try {
          const token = await getAccessToken();
          const r = await fetch(cfg.devicesEndpoint, {
            method: "POST",
            headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ app_key, api_key, save: true }),
          });
          const d = await r.json();
          if (!r.ok || d.error) throw new Error(d.error || "Couldn't reach Ecowitt");
          gateways = d.gateways || [];
          if (!gateways.length) throw new Error("No devices found on that Ecowitt account.");
          stepOrganize();
        } catch (err) { stepConnect(err.message); }
      });
    };

    const stepOrganize = () => {
      const speciesOpts = SPECIES.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("");
      const zoneNames = gateways.map(g => g.name);
      const rows = gateways.map((g, gi) => {
        const chRows = g.channels.map(c => `
          <div class="ob-ch" data-gi="${gi}" data-ch="${c.channel}">
            <div class="ob-ch-id">CH${c.channel} · ${c.moisture ?? "–"}%</div>
            <input class="ob-name text-input" placeholder="Plant name" value="" />
            <select class="ob-species select-input">${speciesOpts}</select>
            <input class="ob-zone text-input" list="ob-zonelist" value="${esc(g.name)}" placeholder="Zone"/>
          </div>`).join("");
        return `<div class="ob-gw">
          <div class="ob-gw-head">${esc(g.name)} <span class="ch-tag">${g.channels.length} sensors</span></div>
          ${chRows || `<div class="info-text">No active soil sensors on this gateway.</div>`}
        </div>`;
      }).join("");
      el.innerHTML = `
        <div class="auth-card onboard-card onboard-wide">
          <div class="auth-brand"><h1>Organize your sensors</h1></div>
          <p class="auth-sub">Name each plant, pick its type, and set its zone. You can change any of this later.</p>
          <datalist id="ob-zonelist">${[...new Set(zoneNames)].map(z => `<option value="${esc(z)}">`).join("")}</datalist>
          <div class="ob-list">${rows}</div>
          <div id="ob-error" class="auth-error" hidden></div>
          <button class="auth-submit" id="ob-finish">Finish setup</button>
          <div class="auth-toggle"><button class="link-btn" id="ob-back">Back</button> · <button class="link-btn" id="ob-signout2">Sign out</button></div>
        </div>`;
      el.querySelector("#ob-back").addEventListener("click", () => stepConnect());
      el.querySelector("#ob-signout2").addEventListener("click", signOut);
      el.querySelector("#ob-finish").addEventListener("click", async () => {
        const btn = el.querySelector("#ob-finish"); btn.disabled = true; btn.textContent = "Saving…";
        try { await saveSetup(el, gateways); closeOverlay(); onDone(); }
        catch (err) {
          const e2 = el.querySelector("#ob-error"); e2.textContent = err.message || "Couldn't save."; e2.hidden = false;
          btn.disabled = false; btn.textContent = "Finish setup";
        }
      });
    };

    stepConnect();
  }

  async function saveSetup(el, gateways) {
    const uid = userId();
    // 1) Zones — collect unique zone names from the form
    const zoneNames = new Set();
    el.querySelectorAll(".ob-zone").forEach(i => { const v = i.value.trim() || "My Garden"; zoneNames.add(v); });
    const zoneRows = [...zoneNames].map((name, i) => ({ user_id: uid, name, sort: i }));
    const zones = await rest("zones?select=id,name", { method: "POST",
      headers: { Prefer: "return=representation" }, body: JSON.stringify(zoneRows) });
    const zoneId = Object.fromEntries(zones.map(z => [z.name, z.id]));

    // 2) Gateways
    const gwRows = gateways.map(g => ({ user_id: uid, mac: g.mac, name: g.name, station_type: g.station_type }));
    const gws = await rest("gateways?select=id,mac", { method: "POST",
      headers: { Prefer: "return=representation,resolution=merge-duplicates" }, body: JSON.stringify(gwRows) });
    const gwId = Object.fromEntries(gws.map(g => [g.mac, g.id]));

    // 3) Plants
    const plantRows = [];
    el.querySelectorAll(".ob-ch").forEach(row => {
      const gi = +row.dataset.gi, ch = +row.dataset.ch;
      const g = gateways[gi];
      const name = row.querySelector(".ob-name").value.trim() || `CH${ch}`;
      const species = row.querySelector(".ob-species").value;
      const zname = row.querySelector(".ob-zone").value.trim() || "My Garden";
      plantRows.push({ user_id: uid, gateway_id: gwId[g.mac], channel: ch, name, species,
        zone_id: zoneId[zname] ?? null, display_order: plantRows.length + 1 });
    });
    if (plantRows.length) await rest("plants", { method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(plantRows) });

    // 4) Mark onboarded
    await rest(`profiles?id=eq.${uid}`, { method: "PATCH",
      headers: { Prefer: "return=minimal" }, body: JSON.stringify({ onboarded: true }) });
  }

  /* ── public entry ─────────────────────────────────────────── */
  async function start(onReady) {
    if (session && (await getAccessToken())) { showApp(true); onReady(); }
    else { renderAuth(() => { showApp(true); onReady(); }); }
  }

  return { start, getAccessToken, signOut, showOnboarding, email, isAuthed: () => !!session };
})();
