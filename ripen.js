// Worthy Fruit (Game 2) — participant (ripen.html) · big screen (#screen) · host (#admin)
// Every bucket from Game 1 (Fruit Bucket Quest) becomes one green fruit on its harvester's phone.
// Water, Nourish and Sunlight ripen it; a fruit turns red when all three are full.
const CFG = window.HARVEST_CONFIG || {};
const FB_VER = "10.12.2";
const TEAM_IDS = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"];
const ZONE_IDS = ["z1", "z2", "z3", "z4", "z5"];
const KINDS = ["water", "nourish", "sun"];
const FEED_MAX = 50;
// Big-screen orchard art: image size and the y where the tree trunks meet the hill
const BG = { w: 2400, h: 1309, feet: 800 };

// Same teams as Game 1 (used only until Game 1's saved settings load)
const CELLS4 = ["Cell 1", "Cell 2", "Cell 3", "Cell 4"];
const YG_CELLS = [...CELLS4, "WOD"];
const DEFAULT_TEAMS = [
  { name: "TH", zones: ["Theology", "CWOD"] },
  { name: "MG", zones: ["Cell 1", "Cell 2", "WOD"] },
  { name: "WG", zones: YG_CELLS },
  { name: "YG T1", zones: YG_CELLS },
  { name: "YG T2", zones: YG_CELLS },
  { name: "YG T3", zones: YG_CELLS },
  { name: "YG T4", zones: YG_CELLS },
  { name: "Geneva", zones: ["Geneva"], quota: 11 },
];
const GAME1_VERSION = 2;

const DEFAULT_CFG = {
  v: 1,
  title: "Worthy Fruit",
  need: 3,      // taps of each action to fill it
  gapHours: 0,  // minimum hours between two taps of the same action on the same fruit (0 = no wait)
  actions: [
    { name: "Water", hint: "Reach out with a call or a message" },
    { name: "Nourish", hint: "Meet up and share a meal or a good word" },
    { name: "Sunlight", hint: "Pray for them by name" },
  ],
};

// ---------- helpers ----------
const $ = (s) => document.querySelector(s);
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 20);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const svg = (id, cls = "") => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
const KIND_ICON = { water: "i-water", nourish: "i-sprout", sun: "i-sun" };

function maskWord(w) {
  const a = [...w];
  if (a.length <= 1) return w;
  if (a.length === 2) return a[0] + "*";
  return a[0] + "*".repeat(a.length - 2) + a[a.length - 1];
}
const maskName = (n) => clean(n).split(" ").map(maskWord).join(" ");

function normalizeGame(g) {
  g = g || {};
  const current = g.v === GAME1_VERSION;
  const teams = TEAM_IDS.map((id, i) => {
    const d = DEFAULT_TEAMS[i];
    const t = current ? (g.teams || []).find((x) => x && x.id === id) || {} : {};
    const zones = (Array.isArray(t.zones) ? t.zones : []).map((z) => clean(z).slice(0, 12)).filter(Boolean).slice(0, ZONE_IDS.length);
    return { id, name: clean(t.name) || d.name, zones: zones.length ? zones : [...d.zones] };
  });
  return { teams };
}
function normalizeCfg(c) {
  c = c || {};
  const need = Math.round(Number(c.need));
  const gap = Number(c.gapHours);
  const actions = DEFAULT_CFG.actions.map((d, i) => {
    const a = (Array.isArray(c.actions) && c.actions[i]) || {};
    return { name: clean(a.name).slice(0, 14) || d.name, hint: String(a.hint ?? "").replace(/\s+/g, " ").trim().slice(0, 60) || d.hint };
  });
  return {
    v: 1,
    title: String(c.title ?? "").replace(/\s+/g, " ").trim().slice(0, 40) || DEFAULT_CFG.title,
    need: need >= 1 && need <= 9 ? need : DEFAULT_CFG.need,
    gapHours: gap >= 0 && gap <= 168 ? Math.round(gap * 10) / 10 : 0,
    actions,
  };
}
const teamOf = (game, id) => game.teams.find((t) => t.id === id);
const zoneName = (game, teamId, zoneId) => teamOf(game, teamId)?.zones[ZONE_IDS.indexOf(zoneId)] || "";
const personKey = (team, zone, name) => `${team}|${zone}|${clean(name)}`;

// Same one-way code Game 1 uses for a bucket. Here it is also the fruit's id, so care records
// never carry a name or a bucket id.
async function bucketCode(team, zone, harvester, basket, relation) {
  const s = ["fbq1", team, zone, harvester, basket, relation].map((x) => clean(x).toLowerCase()).join("|");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 0 = fresh green, 1 = fully red
const ripeness = (c, need) => KINDS.reduce((s, _, k) => s + Math.min(c?.[k] || 0, need), 0) / (3 * need);
const STOPS = [[0, [106, 168, 79]], [0.34, [176, 196, 58]], [0.67, [240, 160, 58]], [1, [200, 40, 58]]];
function ripeColor(p) {
  p = Math.max(0, Math.min(1, p));
  for (let i = 1; i < STOPS.length; i++) {
    const [p1, c1] = STOPS[i];
    if (p <= p1) {
      const [p0, c0] = STOPS[i - 1];
      const t = (p - p0) / (p1 - p0);
      return `rgb(${c0.map((v, j) => Math.round(v + (c1[j] - v) * t)).join(",")})`;
    }
  }
  return "rgb(200,40,58)";
}
const ripeWord = (p) => (p >= 1 ? "Ripe" : p >= 0.67 ? "Almost ripe" : p >= 0.34 ? "Ripening" : p > 0 ? "Growing" : "Green");

// Phone apple, coloured by ripeness
function appleSvg(p, cls = "") {
  return `<svg class="apple ${cls}" viewBox="0 0 48 48" aria-hidden="true">
    <path d="M24 14 C18 9 7 11 7 24 C7 35 15 44 20 44 C22 44 23 43 24 43 C25 43 26 44 28 44 C33 44 41 35 41 24 C41 11 30 9 24 14Z" fill="${ripeColor(p)}"/>
    <ellipse cx="16" cy="21" rx="3" ry="5" fill="#fff" opacity=".35"/>
    <path d="M24 14 q0-6 4-9" fill="none" stroke="#5a3a1a" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M26 9 q7-6 12-1 q-6 5-12 1z" fill="#4f8a3f"/></svg>`;
}

function toast(msg, err = false) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.toggle("err", err);
  el.classList.add("on");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove("on"), 2800);
}

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const joinUrl = () => location.origin + location.pathname;
function drawQR(el, text, size) {
  el.innerHTML = "";
  if (window.QRCode) new window.QRCode(el, { text, width: size, height: size, correctLevel: window.QRCode.CorrectLevel.M });
  else el.textContent = text;
}
function setBar(sel, ratio) {
  const el = typeof sel === "string" ? $(sel) : sel;
  el.classList.toggle("done", ratio >= 1);
  const i = el.querySelector("i");
  i.style.width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
  i.style.background = ripeColor(ratio);
}
const pct = (x) => `${Math.round((x || 0) * 100)}%`;

// ---------- stats (computed on the big screen and host panel) ----------
// fruits: [{code, team, zone, harvester, masked, ts}], care: [{id, fruit, kind, harvester, team, zone, ts}]
function computeStats(game, cfg, fruits, care) {
  const need = cfg.need;
  const byCode = new Map(fruits.map((f) => [f.code, { ...f, c: [0, 0, 0] }]));
  const S = { fruits: 0, ripe: 0, pct: 0, care: [0, 0, 0], teams: {}, people: {}, codes: {}, recent: [] };
  TEAM_IDS.forEach((t) => (S.teams[t] = { fruits: 0, ripe: 0, pct: 0, care: [0, 0, 0], zones: Object.fromEntries(ZONE_IDS.map((z) => [z, { fruits: 0, sum: 0 }])), dots: [] }));

  const events = [];
  for (const r of [...care].sort((a, b) => (a.ts || 0) - (b.ts || 0))) {
    const f = byCode.get(r.fruit);
    const k = KINDS.indexOf(r.kind);
    if (!f || k < 0) continue; // fruit was deleted in Game 1, or a bad record
    const before = ripeness(f.c, need);
    f.c[k]++;
    const after = ripeness(f.c, need);
    events.push({ id: r.id, team: f.team, zone: f.zone, who: clean(r.harvester), kind: r.kind, masked: f.masked, ts: r.ts || 0, p: after, ripened: before < 1 && after >= 1, counted: f.c[k] <= need });
  }
  for (const f of [...byCode.values()].sort((a, b) => (a.ts || 0) - (b.ts || 0))) {
    const T = S.teams[f.team];
    if (!T || !ZONE_IDS.includes(f.zone)) continue;
    const p = ripeness(f.c, need);
    S.fruits++; T.fruits++;
    T.zones[f.zone].fruits++; T.zones[f.zone].sum += p;
    T.pct += p; S.pct += p;
    if (p >= 1) { S.ripe++; T.ripe++; }
    f.c.forEach((v, k) => { const m = Math.min(v, need); T.care[k] += m; S.care[k] += m; });
    T.dots.push(Math.round(p * 100) / 100);
    const pk = personKey(f.team, f.zone, f.harvester);
    const P = (S.people[pk] ||= { fruits: 0, ripe: 0 });
    P.fruits++; if (p >= 1) P.ripe++;
    if (f.c.some((v) => v > 0)) S.codes[f.code] = f.c;
  }
  S.pct = S.fruits ? S.pct / S.fruits : 0;
  for (const t of TEAM_IDS) {
    const T = S.teams[t];
    T.pct = T.fruits ? T.pct / T.fruits : 0;
    for (const z of ZONE_IDS) { const Z = T.zones[z]; T.zones[z] = { fruits: Z.fruits, pct: Z.fruits ? Z.sum / Z.fruits : 0 }; }
  }
  S.recent = events.reverse().slice(0, FEED_MAX);
  return S;
}

// ---------- data: demo (browser storage, shares Game 1's demo buckets) ----------
function makeDemoBackend() {
  const KEY1 = "harvest-demo-v1", KEY2 = "ripen-demo-v1";
  const subs = new Set();
  let bc = null;
  try { bc = new BroadcastChannel("ripen-demo"); bc.onmessage = () => emit(); } catch {}
  window.addEventListener("storage", (e) => { if (e.key === KEY1 || e.key === KEY2) emit(); });
  const load1 = () => store.get(KEY1, null) || { game: null, baskets: [] };
  const load2 = () => store.get(KEY2, null) || { cfg: DEFAULT_CFG, care: [] };
  const ping = () => { try { bc?.postMessage(1); } catch {} try { new BroadcastChannel("harvest-demo").postMessage(1); } catch {} emit(); };
  function emit() { subs.forEach((f) => f()); }
  const sub = (f) => { subs.add(f); f(); return () => subs.delete(f); };
  const id = () => Math.random().toString(36).slice(2, 10);
  return {
    mode: "demo", live: true,
    async init() {},
    onAuth(cb) { cb({ email: "Demo host" }); },
    async signIn() {}, async signOut() {},
    watchGame(cb) { return sub(() => cb(normalizeGame(load1().game))); },
    watchCfg(cb) { return sub(() => cb(normalizeCfg(load2().cfg))); },
    watchBaskets(cb) { return sub(() => cb([...load1().baskets])); },
    watchCare(cb) { return sub(() => cb([...load2().care])); },
    async saveCfg(c) { const s = load2(); s.cfg = c; store.set(KEY2, s); ping(); },
    async addBasket(b) { const s = load1(); const i = id(); s.baskets.push({ ...b, id: i, ts: Date.now() }); store.set(KEY1, s); ping(); return i; },
    async addCare(r) { const s = load2(); const i = id(); s.care.push({ ...r, id: i, ts: Date.now() }); store.set(KEY2, s); ping(); return i; },
    async deleteCare(i) { const s = load2(); s.care = s.care.filter((r) => r.id !== i); store.set(KEY2, s); ping(); },
    async resetCare() { const s = load2(); s.care = []; store.set(KEY2, s); ping(); },
    async writeSummary() {},
    async fetchKeys() { return load1().keys || {}; },
    watchPublic(cb) { // demo phones compute everything themselves
      let game = null, cfg = null, baskets = [], care = [];
      const go = async () => { if (game && cfg) cb({ game, cfg, stats: computeStats(game, cfg, await fruitsOf(baskets), care) }); };
      this.watchGame((g) => { game = g; go(); }); this.watchCfg((c) => { cfg = c; go(); });
      this.watchBaskets((b) => { baskets = b; go(); }); this.watchCare((c) => { care = c; go(); });
    },
  };
}

// ---------- data: Firebase (same project as Game 1) ----------
function makeFirebaseBackend(conf) {
  let fs, au, db, auth;
  const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
  const ms = (x) => (x?.toMillis ? x.toMillis() : Date.now());
  return {
    mode: "firebase", live: false,
    async init() {
      const [appM, fsM, auM] = await Promise.all([import(base + "firebase-app.js"), import(base + "firebase-firestore.js"), import(base + "firebase-auth.js")]);
      fs = fsM; au = auM;
      const app = appM.initializeApp(conf);
      db = fs.getFirestore(app);
      auth = au.getAuth(app);
    },
    onAuth(cb) { au.onAuthStateChanged(auth, (u) => cb(u ? { email: u.email } : null)); },
    async signIn() { await au.signInWithPopup(auth, new au.GoogleAuthProvider()); },
    async signOut() { await au.signOut(auth); },
    async fetchPublic() {
      const s = await fs.getDoc(fs.doc(db, "public", "summary2"));
      if (s.exists()) { const d = s.data(); return { game: normalizeGame(d.game), cfg: normalizeCfg(d.cfg), stats: d.stats || null }; }
      const [g, c] = await Promise.all([fs.getDoc(fs.doc(db, "public", "config")), fs.getDoc(fs.doc(db, "public", "config2"))]);
      return { game: normalizeGame(g.exists() ? g.data() : null), cfg: normalizeCfg(c.exists() ? c.data() : null), stats: null };
    },
    watchGame(cb, err) { return fs.onSnapshot(fs.doc(db, "public", "config"), (s) => cb(normalizeGame(s.exists() ? s.data() : null)), err); },
    watchCfg(cb, err) { return fs.onSnapshot(fs.doc(db, "public", "config2"), (s) => cb(normalizeCfg(s.exists() ? s.data() : null)), err); },
    watchBaskets(cb, err) {
      return fs.onSnapshot(fs.collection(db, "baskets"), (snap) => cb(snap.docs.map((d) => {
        const x = d.data({ serverTimestamps: "estimate" });
        return { id: d.id, team: x.team, zone: x.zone, harvester: x.harvester, basket: x.basket, relation: x.relation, ts: ms(x.ts) };
      })), err);
    },
    watchCare(cb, err) {
      return fs.onSnapshot(fs.collection(db, "care"), (snap) => cb(snap.docs.map((d) => {
        const x = d.data({ serverTimestamps: "estimate" });
        return { id: d.id, fruit: x.fruit, kind: x.kind, harvester: x.harvester, team: x.team, zone: x.zone, ts: ms(x.ts) };
      })), err);
    },
    async saveCfg(c) { await fs.setDoc(fs.doc(db, "public", "config2"), c); },
    async addBasket(b) { const ref = await fs.addDoc(fs.collection(db, "baskets"), { ...b, ts: fs.serverTimestamp() }); return ref.id; },
    async addCare(r) { const ref = await fs.addDoc(fs.collection(db, "care"), { ...r, ts: fs.serverTimestamp() }); return ref.id; },
    async deleteCare(id) { await fs.deleteDoc(fs.doc(db, "care", id)); },
    async resetCare() {
      const snap = await fs.getDocs(fs.collection(db, "care"));
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = fs.writeBatch(db);
        snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    },
    async writeSummary(sum) { await fs.setDoc(fs.doc(db, "public", "summary2"), { ...sum, updatedAt: fs.serverTimestamp() }); },
    async fetchKeys() { const s = await fs.getDoc(fs.doc(db, "public", "keys")); return s.exists() ? s.data().map || {} : {}; },
  };
}

const backend = CFG.firebase ? makeFirebaseBackend(CFG.firebase) : makeDemoBackend();

// bucket records -> fruits (codes are cached per bucket)
const codeCache = new Map();
async function fruitsOf(baskets) {
  const out = [];
  for (const b of baskets) {
    if (!b.team || !b.zone) continue;
    const sig = [b.team, b.zone, b.harvester, b.basket, b.relation].join("|");
    let c = codeCache.get(b.id);
    if (!c || c.sig !== sig) { c = { sig, code: await bucketCode(b.team, b.zone, b.harvester, b.basket, b.relation) }; codeCache.set(b.id, c); }
    out.push({ code: c.code, team: b.team, zone: b.zone, harvester: clean(b.harvester), masked: maskName(b.basket), name: b.basket, relation: b.relation, ts: b.ts || 0 });
  }
  return out;
}

// Host-signed-in views read everything and publish a small summary for phones
function makeSummaryWriter() {
  let last = "", timer = null, pending = null;
  return (game, cfg, stats) => {
    if (backend.mode !== "firebase") return;
    const teams = Object.fromEntries(Object.entries(stats.teams).map(([k, { dots, ...T }]) => [k, T]));
    pending = { game: { v: GAME1_VERSION, teams: game.teams }, cfg, stats: { ...stats, teams, recent: stats.recent.slice(0, 12).map(({ id, ...r }) => r) } };
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const json = JSON.stringify(pending);
      if (json === last) return;
      try { await backend.writeSummary(pending); last = json; } catch (e) { console.warn("summary2", e); }
    }, 1500);
  };
}

// Shared live model for the big screen and host panel
function watchAll(onChange, onDenied) {
  let game = normalizeGame(null), cfg = normalizeCfg(null), baskets = [], care = [], fruits = [];
  let seq = 0;
  const go = async () => {
    const my = ++seq;
    const f = await fruitsOf(baskets);
    if (my !== seq) return;
    fruits = f;
    onChange({ game, cfg, fruits, care, stats: computeStats(game, cfg, fruits, care) });
  };
  backend.watchGame((g) => { game = g; go(); }, onDenied);
  backend.watchCfg((c) => { cfg = c; go(); }, onDenied);
  backend.watchBaskets((b) => { baskets = b; go(); }, onDenied);
  backend.watchCare((c) => { care = c; go(); }, onDenied);
}

// ======================================================================
// Participant view
// ======================================================================
function startJoin() {
  $("#view-join").hidden = false;
  let game = normalizeGame(null), cfg = normalizeCfg(null), stats = null;
  let profile = store.get("harvest-profile", null); // shared with Game 1 on the same site
  let mine = store.get("harvest-mine", []);         // the buckets this phone added in Game 1
  let taps = store.get("ripen-taps", []);           // [{id, code, kind, ts}] care this phone gave
  let draft = { team: profile?.team, zone: profile?.zone };
  const codes = new Map(); // bucket signature -> fruit code
  let fruits = []; // [{m, code}]
  const busy = new Set();

  const myLocal = () => mine.filter((m) => profile && m.team === profile.team && m.zone === profile.zone && clean(m.name) === clean(profile.name));

  async function refreshFruits() {
    const list = myLocal();
    const out = [];
    for (const m of list) {
      const sig = [m.team, m.zone, m.name, m.basket, m.relation].join("|");
      if (!codes.has(sig)) codes.set(sig, await bucketCode(m.team, m.zone, m.name, m.basket, m.relation));
      out.push({ m, code: codes.get(sig) });
    }
    fruits = out;
    render();
  }

  // Care count for one fruit: what this phone tapped, or the server's count for fruits tapped elsewhere
  function countsOf(code) {
    const local = taps.filter((t) => t.code === code);
    if (local.length) return KINDS.map((k) => local.filter((t) => t.kind === k).length);
    return stats?.codes?.[code] || [0, 0, 0];
  }

  // ---- setup ----
  function renderSetup() {
    $("#j-teams").innerHTML = game.teams.map((t) => `<button type="button" data-team="${t.id}" aria-pressed="${draft.team === t.id}">${esc(t.name)}</button>`).join("");
    const team = teamOf(game, draft.team);
    const zones = team ? team.zones : [];
    if (team && !(ZONE_IDS.indexOf(draft.zone) >= 0 && ZONE_IDS.indexOf(draft.zone) < zones.length)) draft.zone = zones.length === 1 ? ZONE_IDS[0] : undefined;
    $("#j-zone-step").hidden = !team;
    $("#j-zones").style.gridTemplateColumns = zones.length === 5 ? "repeat(3,1fr)" : "";
    $("#j-zones").innerHTML = zones.map((z, i) => `<button type="button" data-zone="${ZONE_IDS[i]}" aria-pressed="${draft.zone === ZONE_IDS[i]}">${esc(z)}</button>`).join("");
    $("#j-start").disabled = !(draft.team && draft.zone && clean($("#j-name").value));
  }
  $("#j-teams").addEventListener("click", (e) => { const b = e.target.closest("[data-team]"); if (b) { draft.team = b.dataset.team; renderSetup(); } });
  $("#j-zones").addEventListener("click", (e) => { const b = e.target.closest("[data-zone]"); if (b) { draft.zone = b.dataset.zone; renderSetup(); } });
  $("#j-name").addEventListener("input", renderSetup);
  $("#j-start").addEventListener("click", () => {
    profile = { team: draft.team, zone: draft.zone, name: clean($("#j-name").value) };
    store.set("harvest-profile", profile);
    showMain();
  });
  $("#j-change").addEventListener("click", () => {
    draft = { team: profile.team, zone: profile.zone };
    $("#j-name").value = profile.name;
    $("#j-main").hidden = true; $("#j-setup").hidden = false; renderSetup();
  });
  function showMain() {
    $("#j-setup").hidden = true; $("#j-main").hidden = false;
    refreshFruits();
  }

  // ---- main ----
  function render() {
    if (!profile || $("#j-main").hidden) return;
    const team = teamOf(game, profile.team) || game.teams[0];
    const need = cfg.need;
    document.title = cfg.title;
    $("#j-title").textContent = cfg.title;
    $("#j-who").textContent = profile.name;
    $("#j-where").textContent = `${team.name} · ${zoneName(game, team.id, profile.zone)}`;

    // how-to card
    $("#j-how").innerHTML = cfg.actions.map((a, k) => `<li>${svg(KIND_ICON[KINDS[k]], "how-ic " + KINDS[k])}<div><b>${esc(a.name)}</b><span>${esc(a.hint)}</span></div></li>`).join("");
    $("#j-need").textContent = need === 1 ? "once" : `${need} times`;
    $("#j-gap").hidden = !cfg.gapHours;
    $("#j-gap").textContent = cfg.gapHours ? `Wait ${cfg.gapHours} hour${cfg.gapHours === 1 ? "" : "s"} between two taps of the same action on the same fruit.` : "";

    // hero
    const ps = fruits.map((f) => ripeness(countsOf(f.code), need));
    const ripe = ps.filter((p) => p >= 1).length;
    $("#j-ripe").textContent = ripe;
    $("#j-ripe-of").textContent = fruits.length;
    $("#j-orchard").innerHTML = fruits.length ? ps.map((p) => appleSvg(p)).join("") : `<span class="empty-note">Your fruits from the bucket game grow here</span>`;

    // team + everyone
    const T = stats?.teams?.[team.id];
    $("#j-team-label").textContent = team.name;
    $("#j-team-pct").textContent = pct(T?.pct);
    setBar("#j-team-bar", T?.pct || 0);
    $("#j-team-sub").textContent = T ? `${T.ripe} of ${T.fruits} fruits ripe` : "Waiting for the big screen";
    $("#j-all-pct").textContent = pct(stats?.pct);
    setBar("#j-all-bar", stats?.pct || 0);
    $("#j-all-sub").textContent = stats ? `${stats.ripe} of ${stats.fruits} fruits ripe` : "Waiting for the big screen";

    // fruit cards
    const box = $("#j-fruits");
    $("#j-nofruit").hidden = fruits.length > 0;
    const sorted = fruits.map((f, i) => ({ ...f, p: ps[i] })).sort((a, b) => (a.p >= 1) - (b.p >= 1) || (b.m.ts || 0) - (a.m.ts || 0));
    box.innerHTML = sorted.map(({ m, code, p }) => {
      const c = countsOf(code);
      const lastTap = taps.filter((t) => t.code === code && t.id).sort((a, b) => b.ts - a.ts)[0];
      const btns = KINDS.map((k, i) => {
        const full = c[i] >= need;
        const wait = waitLeft(code, k);
        const pips = Array.from({ length: need }, (_, j) => `<i class="${j < c[i] ? "on" : ""}"></i>`).join("");
        return `<button type="button" class="act ${k}" data-code="${code}" data-kind="${k}" ${full || wait || busy.has(code) ? "disabled" : ""}
          aria-label="${esc(cfg.actions[i].name)} for ${esc(m.basket)}: ${Math.min(c[i], need)} of ${need}">
          ${svg(KIND_ICON[k], "act-ic")}<span class="act-n">${esc(cfg.actions[i].name)}</span>
          <span class="pips">${pips}</span>${full ? `<span class="act-s">Full</span>` : wait ? `<span class="act-s">${wait}</span>` : ""}</button>`;
      }).join("");
      return `<article class="fruit${p >= 1 ? " ripe" : ""}" data-fruit="${code}">
        <div class="fruit-top">${appleSvg(p, "big")}
          <div class="fruit-who"><b>${esc(m.basket)}</b><span>${esc(m.relation)}</span>
            <div class="ripe-line"><span class="ripe-tag" style="--c:${ripeColor(p)}">${ripeWord(p)}</span><span class="num">${pct(p)}</span></div></div>
          ${lastTap ? `<button type="button" class="undo" data-undo="${esc(lastTap.id)}">Undo</button>` : ""}
        </div>
        <div class="acts">${btns}</div></article>`;
    }).join("");
  }

  function waitLeft(code, kind) {
    if (!cfg.gapHours) return "";
    const last = taps.filter((t) => t.code === code && t.kind === kind).reduce((a, t) => Math.max(a, t.ts), 0);
    const left = last + cfg.gapHours * 3600e3 - Date.now();
    if (left <= 0) return "";
    const h = Math.floor(left / 3600e3), mi = Math.ceil((left % 3600e3) / 60e3);
    return h ? `in ${h}h ${mi}m` : `in ${mi}m`;
  }

  $("#j-fruits").addEventListener("click", async (e) => {
    const u = e.target.closest("[data-undo]");
    if (u) return undo(u);
    const b = e.target.closest(".act");
    if (!b || b.disabled) return;
    const code = b.dataset.code, kind = b.dataset.kind;
    const f = fruits.find((x) => x.code === code);
    if (!f) return;
    // first tap on a fruit that was cared for on another phone: start from the server counts
    if (!taps.some((t) => t.code === code)) {
      const sc = stats?.codes?.[code];
      if (sc) KINDS.forEach((k, i) => { for (let j = 0; j < sc[i]; j++) taps.push({ code, kind: k, ts: 0 }); });
    }
    const before = ripeness(countsOf(code), cfg.need);
    busy.add(code);
    render();
    try {
      const id = await backend.addCare({ team: profile.team, zone: profile.zone, harvester: profile.name, fruit: code, kind });
      taps.push({ id, code, kind, ts: Date.now() });
      store.set("ripen-taps", taps);
      const after = ripeness(countsOf(code), cfg.need);
      busy.delete(code);
      render();
      const card = $(`[data-fruit="${code}"]`);
      floatIcon(b, card, kind);
      const ap = card?.querySelector(".apple");
      ap?.animate([{ transform: "scale(1)" }, { transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 500, easing: "ease-out" });
      if (after >= 1 && before < 1) { toast(`${f.m.basket} is ripe!`); burst(card); }
      else toast(`${cfg.actions[KINDS.indexOf(kind)].name} given`);
    } catch (err) {
      console.error(err);
      busy.delete(code);
      render();
      toast("Couldn't save. Check your internet connection and tap again.", true);
    }
  });

  async function undo(btn) {
    if (btn.dataset.armed !== "1") {
      btn.dataset.armed = "1"; btn.textContent = "Confirm"; btn.classList.add("armed");
      setTimeout(() => { if (btn.isConnected) { btn.dataset.armed = ""; btn.textContent = "Undo"; btn.classList.remove("armed"); } }, 3000);
      return;
    }
    const id = btn.dataset.undo;
    btn.disabled = true;
    try {
      await backend.deleteCare(id);
      taps = taps.filter((t) => t.id !== id);
      store.set("ripen-taps", taps);
      toast("Last care removed");
      render();
    } catch (err) {
      console.error(err);
      btn.disabled = false;
      toast("Couldn't undo. Check your internet connection and try again.", true);
    }
  }

  function floatIcon(from, card, kind) {
    const target = card?.querySelector(".apple")?.getBoundingClientRect();
    if (!target) return;
    const s = from.getBoundingClientRect();
    const a = document.createElement("div");
    a.className = "float-ic";
    a.innerHTML = svg(KIND_ICON[kind], kind);
    document.body.appendChild(a);
    const x0 = s.left + s.width / 2 - 16, y0 = s.top, x1 = target.left + target.width / 2 - 16, y1 = target.top + 4;
    a.animate([{ transform: `translate(${x0}px,${y0}px) scale(.7)`, opacity: 0 }, { transform: `translate(${(x0 + x1) / 2}px,${Math.min(y0, y1) - 40}px) scale(1.2)`, opacity: 1 }, { transform: `translate(${x1}px,${y1}px) scale(.6)`, opacity: 0 }], { duration: 750, easing: "cubic-bezier(.3,.1,.3,1)" }).onfinish = () => a.remove();
  }
  function burst(card) {
    if (!card) return;
    const r = card.querySelector(".apple").getBoundingClientRect();
    for (let i = 0; i < 12; i++) {
      const d = document.createElement("div");
      d.className = "spark";
      document.body.appendChild(d);
      const ang = (i / 12) * Math.PI * 2, dist = 50 + Math.random() * 30;
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      d.animate([{ transform: `translate(${x}px,${y}px) scale(1)`, opacity: 1 }, { transform: `translate(${x + Math.cos(ang) * dist}px,${y + Math.sin(ang) * dist}px) scale(.3)`, opacity: 0 }], { duration: 800, easing: "ease-out" }).onfinish = () => d.remove();
    }
  }

  // ---- add a new fruit (adds a bucket to Game 1 too) ----
  $("#j-add").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!profile) return;
    const basket = clean($("#j-add-name").value), relation = clean($("#j-add-rel").value);
    if (!basket || !relation) { toast("Type the name and the relationship", true); return; }
    if (myLocal().some((m) => clean(m.basket).toLowerCase() === basket.toLowerCase())) { toast(`${basket} is already one of your fruits`, true); return; }
    const btn = $("#j-add-btn");
    btn.disabled = true; btn.textContent = "Planting…";
    try {
      const id = await backend.addBasket({ team: profile.team, zone: profile.zone, harvester: profile.name, basket, relation });
      mine.push({ id, team: profile.team, zone: profile.zone, name: profile.name, basket, relation, ts: Date.now() });
      store.set("harvest-mine", mine);
      $("#j-add-name").value = ""; $("#j-add-rel").value = "";
      $("#j-add-box").open = false;
      toast(`${basket} is a new green fruit`);
      refreshFruits();
    } catch (err) {
      console.error(err);
      toast("Couldn't save. Check your internet connection and try again.", true);
    } finally { btn.disabled = false; btn.textContent = "Plant this fruit"; }
  });

  // ---- a bucket typed on another phone ----
  $("#j-find").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!profile) return;
    const basket = clean($("#j-find-name").value), relation = clean($("#j-find-rel").value);
    if (!basket || !relation) { toast("Type the bucket name and the relationship", true); return; }
    const btn = $("#j-find-btn");
    btn.disabled = true; btn.textContent = "Looking…";
    try {
      const keys = await backend.fetchKeys();
      const code = await bucketCode(profile.team, profile.zone, profile.name, basket, relation);
      const id = keys[code];
      if (!id) { toast("Couldn't find it. Type both exactly as you entered them in the bucket game.", true); return; }
      if (mine.some((m) => m.id === id)) { toast(`${basket} is already one of your fruits`); return; }
      mine.unshift({ id, team: profile.team, zone: profile.zone, name: profile.name, basket, relation, ts: 0 });
      store.set("harvest-mine", mine);
      $("#j-find-name").value = ""; $("#j-find-rel").value = "";
      $("#j-find-box").open = false;
      toast(`Found ${basket}`);
      refreshFruits();
    } catch (err) {
      console.error(err);
      toast("Couldn't look it up. Check your internet connection and try again.", true);
    } finally { btn.disabled = false; btn.textContent = "Find my bucket"; }
  });

  function apply(pub) {
    game = pub.game; cfg = pub.cfg; if (pub.stats) stats = pub.stats;
    $("#j-sync").textContent = backend.live ? "Live" : "Just updated";
    if (!profile) { $("#j-setup").hidden = false; renderSetup(); }
    else if (!$("#j-setup").hidden) renderSetup();
    else if ($("#j-main").hidden) showMain();
    else render();
  }

  if (backend.live) backend.watchPublic(apply);
  else {
    const poll = async () => {
      if (document.hidden) return;
      try { apply(await backend.fetchPublic()); } catch (e) { $("#j-sync").textContent = "Reconnecting…"; }
    };
    poll();
    setInterval(poll, Math.max(10, CFG.pollSeconds || 30) * 1000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });
  }
  if (profile) $("#j-setup").hidden = true;
  setInterval(() => { if (cfg.gapHours) render(); }, 60e3);
}

// ======================================================================
// Host sign-in (shared)
// ======================================================================
function withAdmin({ loginBox, onReady }) {
  let started = false;
  backend.onAuth((user) => {
    if (!user) { loginBox.hidden = false; return; }
    loginBox.hidden = true;
    if (!started) { started = true; onReady(user); }
  });
}
function adminDenied(loginBox, msgEl, e) {
  console.warn(e);
  loginBox.hidden = false;
  msgEl.textContent = "This account isn't a host. Sign in with the host email listed in firestore.rules.";
}

// ======================================================================
// Big screen
// ======================================================================
function startScreen() {
  $("#view-screen").hidden = false;
  document.body.style.overflow = "hidden";
  drawQR($("#s-qr"), joinUrl(), 220);
  const writeSummary = makeSummaryWriter();
  let prevRipe = null, prevDone = null;
  const feedSeen = new Set();
  $("#s-signin").onclick = () => backend.signIn().catch((e) => toast("Sign-in failed: " + (e.code || e.message), true));

  withAdmin({
    loginBox: $("#s-login"),
    onReady() {
      const deny = (e) => adminDenied($("#s-login"), $("#s-login-msg"), e);
      watchAll((m) => { writeSummary(m.game, m.cfg, m.stats); draw(m); }, deny);
    },
  });

  function fitBg() {
    const bg = $(".scr-bg"), boards = $("#s-teams");
    if (!bg || !boards) return;
    const W = innerWidth, H = innerHeight;
    const line = boards.getBoundingClientRect().top + H * 0.02;
    const scale = Math.max(W / BG.w, line / BG.feet, H / BG.h);
    const w = BG.w * scale, h = BG.h * scale;
    let y = line - BG.feet * scale;
    y = Math.min(0, Math.max(H - h, y));
    bg.style.backgroundSize = `${w}px ${h}px`;
    bg.style.backgroundPosition = `${(W - w) / 2}px ${y}px`;
  }
  addEventListener("resize", fitBg);

  function crown(dots, need) {
    const n = dots.length;
    const RX = 41, RY = 30, CX = 50, CY = 36;
    const r = n ? Math.max(1.6, Math.min(5.2, Math.sqrt((Math.PI * RX * RY) / n / Math.PI) * 0.78)) : 0;
    const fr = dots.map((p, i) => {
      const t = Math.sqrt((i + 0.5) / n), a = i * 2.39996;
      const x = CX + t * (RX - r) * Math.cos(a), y = CY + t * (RY - r) * Math.sin(a);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="${ripeColor(p)}"${p >= 1 ? ` class="rd"` : ""}/>`;
    }).join("");
    return `<svg class="crown" viewBox="0 0 100 82" aria-hidden="true">
      <path d="M47 82 L48.5 58 Q50 55 51.5 58 L53 82Z" fill="#6b4a2b" opacity=".85"/>
      <g fill="#2f6b34" opacity=".55"><ellipse cx="50" cy="36" rx="46" ry="34"/><circle cx="22" cy="30" r="18"/><circle cx="78" cy="30" r="18"/><circle cx="50" cy="12" r="16"/></g>
      ${fr}${n ? "" : `<text x="50" y="40" text-anchor="middle" font-size="7" fill="#fff" opacity=".85">No fruits yet</text>`}</svg>`;
  }

  function draw({ game, cfg, stats }) {
    document.title = cfg.title;
    $("#s-title").textContent = cfg.title;
    $("#s-ripe").textContent = stats.ripe;
    $("#s-fruits").textContent = stats.fruits;
    $("#s-pct").textContent = pct(stats.pct);
    $("#s-care").innerHTML = KINDS.map((k, i) => `<span>${svg(KIND_ICON[k], "ic " + k)}<b class="num">${stats.care[i]}</b> ${esc(cfg.actions[i].name)}</span>`).join("");

    const ranked = [...game.teams].sort((a, b) => stats.teams[b.id].pct - stats.teams[a.id].pct || stats.teams[b.id].ripe - stats.teams[a.id].ripe);
    const rankOf = Object.fromEntries(ranked.map((t, i) => [t.id, i + 1]));
    const box = $("#s-teams");
    if (box.children.length !== game.teams.length) box.innerHTML = game.teams.map((t) => `<article class="team glass" data-id="${t.id}"></article>`).join("");

    game.teams.forEach((t) => {
      const el = box.querySelector(`[data-id="${t.id}"]`);
      const T = stats.teams[t.id];
      const done = T.fruits > 0 && T.ripe === T.fruits;
      const zones = t.zones.map((z, i) => {
        const Z = T.zones[ZONE_IDS[i]];
        return `<div class="zone"><span>${esc(z)}</span><div class="bar"><i style="width:${Z.pct * 100}%;background:${ripeColor(Z.pct)}"></i></div><span class="num">${Math.round(Z.pct * 100)}</span></div>`;
      }).join("");
      el.classList.toggle("done", done);
      el.innerHTML = `
        ${done ? `<div class="done-badge">All ripe</div>` : ""}
        <div class="team-head"><h2>${esc(t.name)}</h2><span class="rank">#${rankOf[t.id]}</span></div>
        <div class="team-count num">${Math.round(T.pct * 100)}<small>% ripe</small></div>
        ${crown(T.dots, cfg.need)}
        <div class="team-ripe">${svg("i-apple-red", "ic")}<b class="num">${T.ripe}</b><span>/ ${T.fruits} red</span></div>
        <div class="team-care">${KINDS.map((k, i) => `<span>${svg(KIND_ICON[k], "ic " + k)}<b class="num">${T.care[i]}</b></span>`).join("")}</div>
        <div class="zones">${zones}</div>`;
      if (prevRipe && T.ripe > prevRipe[t.id]) for (let k = 0; k < Math.min(T.ripe - prevRipe[t.id], 4); k++) setTimeout(() => ripePulse(el), k * 220);
      if (prevDone && !prevDone[t.id] && done) celebrate(`${t.name}: every fruit is red!`);
    });
    prevRipe = Object.fromEntries(game.teams.map((t) => [t.id, stats.teams[t.id].ripe]));
    prevDone = Object.fromEntries(game.teams.map((t) => [t.id, stats.teams[t.id].fruits > 0 && stats.teams[t.id].ripe === stats.teams[t.id].fruits]));
    fitBg();

    const nameOf = Object.fromEntries(game.teams.map((t) => [t.id, t.name]));
    const feed = $("#s-feed");
    const keepTop = feed.scrollTop;
    const firstDraw = !feedSeen.size;
    feed.innerHTML = stats.recent.map((r) => {
      const k = KINDS.indexOf(r.kind);
      return `<div class="feed-item glass${r.ripened ? " ripe" : ""}${!firstDraw && !feedSeen.has(r.id) ? " new" : ""}">
        ${r.ripened ? svg("i-apple-red") : svg(KIND_ICON[r.kind], r.kind)}
        <div><div>${r.ripened ? `<span class="who">${esc(r.masked)}</span> is ripe! <span class="by">by ${esc(r.who)}</span>` : `<span class="who">${esc(r.who)}</span> gave ${esc(cfg.actions[k]?.name || r.kind)}`}</div>
        <div class="meta">${esc(nameOf[r.team] || "")} · ${esc(zoneName(game, r.team, r.zone))}${r.ripened ? "" : ` · ${esc(r.masked)} ${pct(r.p)}`}</div></div></div>`;
    }).join("");
    stats.recent.forEach((r) => feedSeen.add(r.id));
    feed.scrollTop = keepTop;
  }

  function ripePulse(card) {
    const dots = card.querySelectorAll(".crown .rd");
    const d = dots[Math.floor(Math.random() * dots.length)];
    if (d) d.animate([{ r: d.getAttribute("r") * 2.4, opacity: 0.4 }, { r: d.getAttribute("r"), opacity: 1 }], { duration: 900, easing: "cubic-bezier(.2,1.4,.4,1)" });
    card.animate([{ boxShadow: "0 0 0 3px rgba(255,90,100,.9), 0 0 40px rgba(255,60,80,.7)" }, { boxShadow: "0 8px 30px rgba(0,0,0,.18)" }], { duration: 1400, easing: "ease-out" });
  }

  function celebrate(msg) {
    const cel = $("#s-cel");
    cel.innerHTML = `<div class="msg">${esc(msg)}<small>The fruit of the Tree of Life is ready for harvest</small></div>`;
    for (let i = 0; i < 40; i++) {
      const c = document.createElement("div");
      c.className = "confetti";
      c.innerHTML = svg("i-apple-red");
      c.style.left = Math.random() * 100 + "%";
      c.style.animationDuration = 2.5 + Math.random() * 2.5 + "s";
      c.style.animationDelay = Math.random() * 0.8 + "s";
      cel.appendChild(c);
    }
    clearTimeout(celebrate.t);
    celebrate.t = setTimeout(() => (cel.innerHTML = ""), 5500);
  }
}

// ======================================================================
// Host panel
// ======================================================================
function startAdmin() {
  $("#view-admin").hidden = false;
  $("#a-url-join").textContent = joinUrl();
  $("#a-url-screen").textContent = joinUrl() + "#screen";
  drawQR($("#a-qr"), joinUrl(), 150);
  let model = null, formDirty = false;
  const writeSummary = makeSummaryWriter();
  $("#a-signin").onclick = () => backend.signIn().catch((e) => toast("Sign-in failed: " + (e.code || e.message), true));
  $("#a-signout").onclick = () => backend.signOut().then(() => location.reload());
  if (backend.mode === "demo") $("#a-demo").hidden = false;
  backend.onAuth((u) => { $("#a-who").textContent = u ? u.email : ""; $("#a-signout").hidden = !u || backend.mode === "demo"; });

  withAdmin({
    loginBox: $("#a-login"),
    onReady() {
      $("#a-main").hidden = false;
      const deny = (e) => { $("#a-main").hidden = true; adminDenied($("#a-login"), $("#a-login-msg"), e); };
      watchAll((m) => { model = m; writeSummary(m.game, m.cfg, m.stats); if (!formDirty) fillForm(); renderRows(); }, deny);
    },
  });

  function fillForm() {
    const c = model.cfg;
    $("#a-title").value = c.title;
    $("#a-need").value = c.need;
    $("#a-gap").value = c.gapHours;
    $("#a-actions").innerHTML = c.actions.map((a, i) => `
      <div class="act-edit">${svg(KIND_ICON[KINDS[i]], "ic " + KINDS[i])}
        <input id="a-an-${i}" value="${esc(a.name)}" maxlength="14" aria-label="Action ${i + 1} name">
        <input id="a-ah-${i}" value="${esc(a.hint)}" maxlength="60" aria-label="Action ${i + 1} meaning"></div>`).join("");
  }
  $("#a-form").addEventListener("input", () => (formDirty = true));
  $("#a-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const c = normalizeCfg({
      title: $("#a-title").value, need: $("#a-need").value, gapHours: $("#a-gap").value,
      actions: [0, 1, 2].map((i) => ({ name: $(`#a-an-${i}`).value, hint: $(`#a-ah-${i}`).value })),
    });
    try { await backend.saveCfg(c); formDirty = false; toast("Settings saved"); }
    catch (err) { console.error(err); toast("Couldn't save. Check that you're signed in as the host.", true); }
  });

  function renderRows() {
    const { game, cfg, fruits, care, stats } = model;
    const tn = Object.fromEntries(game.teams.map((t) => [t.id, t.name]));
    const byCode = new Map(fruits.map((f) => [f.code, f]));
    $("#a-sum").innerHTML = `<b class="num">${stats.ripe}</b> of <b class="num">${stats.fruits}</b> fruits ripe · <b class="num">${pct(stats.pct)}</b> overall`;
    $("#a-team-rows").innerHTML = game.teams.map((t) => { const T = stats.teams[t.id]; return `<tr><td>${esc(t.name)}</td><td class="num">${T.fruits}</td><td class="num">${T.ripe}</td><td class="num">${pct(T.pct)}</td>${T.care.map((v) => `<td class="num">${v}</td>`).join("")}</tr>`; }).join("");
    $("#a-team-head").innerHTML = `<th>Team</th><th>Fruits</th><th>Ripe</th><th>Ripeness</th>${cfg.actions.map((a) => `<th>${esc(a.name)}</th>`).join("")}`;
    const rows = [...care].sort((a, b) => b.ts - a.ts);
    $("#a-count").textContent = rows.length;
    $("#a-rows").innerHTML = rows.slice(0, 500).map((r) => {
      const f = byCode.get(r.fruit);
      return `<tr><td class="num">${new Date(r.ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
      <td>${esc(tn[r.team] || r.team)}</td><td>${esc(zoneName(game, r.team, r.zone) || r.zone)}</td><td>${esc(r.harvester)}</td>
      <td>${f ? esc(f.name) : `<span class="muted">Bucket deleted</span>`}</td><td>${esc(cfg.actions[KINDS.indexOf(r.kind)]?.name || r.kind)}</td>
      <td><button data-del="${esc(r.id)}">Delete</button></td></tr>`;
    }).join("") || `<tr><td colspan="7" class="muted">No care given yet.</td></tr>`;
  }
  $("#a-rows").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-del]");
    if (!b) return;
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Confirm"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "Delete"; }, 3000); return; }
    try { await backend.deleteCare(b.dataset.del); toast("Deleted"); } catch { toast("Couldn't delete", true); }
  });

  $("#a-csv").onclick = () => {
    const { game, cfg, fruits, care } = model;
    const tn = Object.fromEntries(game.teams.map((t) => [t.id, t.name]));
    const byCode = new Map(fruits.map((f) => [f.code, f]));
    const rows = [["Time", "Team", "Cell", "Gardener", "Fruit (bucket name)", "Relationship", "Action"],
      ...[...care].sort((a, b) => a.ts - b.ts).map((r) => { const f = byCode.get(r.fruit); return [new Date(r.ts).toLocaleString("en-GB"), tn[r.team], zoneName(game, r.team, r.zone), r.harvester, f?.name || "(deleted)", f?.relation || "", cfg.actions[KINDS.indexOf(r.kind)]?.name || r.kind]; })];
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `worthy-fruit_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  $("#a-reset-text").addEventListener("input", (e) => ($("#a-reset").disabled = e.target.value.trim().toUpperCase() !== "RESET"));
  $("#a-reset").onclick = async () => {
    $("#a-reset").disabled = true;
    try { await backend.resetCare(); $("#a-reset-text").value = ""; toast("All care records deleted. Every fruit is green again."); }
    catch { toast("Couldn't reset", true); }
  };

  $("#a-demo").onclick = async () => {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    if (model.fruits.length < 20) {
      const names = ["Anna", "Luca", "Mia", "Noah", "Lea", "Elias", "Sofia", "Jonas"], fams = ["Ben", "Clara", "Daniel", "Emma", "Felix", "Hanna", "Leon", "Nina"], gives = ["Meier", "Keller", "Brunner", "Huber", "Weber"];
      for (let i = 0; i < 60; i++) { const t = pick(model.game.teams); await backend.addBasket({ team: t.id, zone: ZONE_IDS[Math.floor(Math.random() * t.zones.length)], harvester: "Sample " + pick(names), basket: pick(fams) + " " + pick(gives) + i, relation: pick(["Friend", "Family", "Coworker"]) }); }
      await new Promise((r) => setTimeout(r, 300));
    }
    for (let i = 0; i < 40; i++) {
      const f = pick(model.fruits);
      if (!f) break;
      await backend.addCare({ team: f.team, zone: f.zone, harvester: f.harvester, fruit: f.code, kind: pick(KINDS) });
    }
    toast("Added 40 sample care taps");
  };
}

// ======================================================================
async function boot() {
  if (backend.mode === "demo") $("#demo-flag").hidden = false;
  try { await backend.init(); }
  catch (e) { console.error(e); toast("Couldn't connect to Firebase. Check config.js.", true); return; }
  const route = location.hash.replace("#", "");
  if (route === "screen") startScreen();
  else if (route === "admin") startAdmin();
  else startJoin();
}
window.addEventListener("hashchange", () => location.reload());
boot();
