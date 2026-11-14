// Zurich Fruit Bucket Quest — participant (#) · big screen (#screen) · host (#admin)
const CFG = window.HARVEST_CONFIG || {};
const FB_VER = "10.12.2";
const TEAM_IDS = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"];
const ZONE_IDS = ["z1", "z2", "z3", "z4", "z5"];

// Same structure as the church org chart (Fruit Consultation): each team has its own cells (1-5). Geneva joined as an 8th team (11 people).
const CELLS4 = ["Cell 1", "Cell 2", "Cell 3", "Cell 4"];
const YG_CELLS = [...CELLS4, "WOD"]; // WG and youth teams: four cells plus WOD
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
const GAME_VERSION = 2;
// The campaign ended on 13 November 2026: participants see the closing page; host views still work.
const QUEST_CLOSED = true;
const FEED_MAX = 50; // how many recent buckets the big-screen feed keeps (scrollable)
// Big-screen Tree of Life art: image size and the y where the tree's roots meet the ground
const BG = { w: 1408, h: 768, feet: 610 };
const DEFAULT_GAME = {
  v: GAME_VERSION,
  title: "Zurich Fruit Bucket Quest",
  teams: TEAM_IDS.map((id, i) => ({ id, name: DEFAULT_TEAMS[i].name, quota: DEFAULT_TEAMS[i].quota || 60, zones: [...DEFAULT_TEAMS[i].zones] })),
};

// ---------- helpers ----------
const $ = (s) => document.querySelector(s);
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 20);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const svg = (id, cls = "") => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;

// "김민수" → "김*수", "Anna Keller" → "A**a K****r"
function maskWord(w) {
  const a = [...w];
  if (a.length <= 1) return w;
  if (a.length === 2) return a[0] + "*";
  return a[0] + "*".repeat(a.length - 2) + a[a.length - 1];
}
export function maskName(n) {
  return clean(n).split(" ").map(maskWord).join(" ");
}

function normalizeGame(g) {
  g = g || {};
  const current = g.v === GAME_VERSION; // older saved settings (6 teams, shared zones) fall back to the new defaults
  const teams = TEAM_IDS.map((id, i) => {
    const d = DEFAULT_GAME.teams[i];
    const t = current ? (g.teams || []).find((x) => x && x.id === id) || {} : {};
    const q = Math.round(Number(t.quota));
    const zones = (Array.isArray(t.zones) ? t.zones : []).map((z) => clean(z).slice(0, 12)).filter(Boolean).slice(0, ZONE_IDS.length);
    return { id, name: clean(t.name) || d.name, quota: q > 0 && q <= 999 ? q : d.quota, zones: zones.length ? zones : [...d.zones] };
  });
  return { v: GAME_VERSION, title: String(g.title ?? "").replace(/\s+/g, " ").trim().slice(0, 40) || DEFAULT_GAME.title, teams };
}
const teamOf = (game, id) => game.teams.find((t) => t.id === id);
const zoneName = (game, teamId, zoneId) => teamOf(game, teamId)?.zones[ZONE_IDS.indexOf(zoneId)] || "";

const personKey = (team, zone, name) => `${team}|${zone}|${clean(name)}`;

// Lookup code for one bucket: a one-way scramble of team|cell|harvester|bucket|relationship.
// The host's screen publishes code -> bucket id, so a phone that knows all five (because its
// owner typed them) can find the id it needs to delete that bucket. No names are published.
async function bucketCode(team, zone, harvester, basket, relation) {
  const s = ["fbq1", team, zone, harvester, basket, relation].map((x) => clean(x).toLowerCase()).join("|");
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function computeStats(baskets) {
  const stats = { total: 0, teams: {}, people: {}, recent: [] };
  TEAM_IDS.forEach((t) => (stats.teams[t] = { total: 0, zones: Object.fromEntries(ZONE_IDS.map((z) => [z, 0])) }));
  const sorted = [...baskets].sort((a, b) => (b.ts || 0) - (a.ts || 0));
  for (const b of sorted) {
    const T = stats.teams[b.team];
    if (!T || !ZONE_IDS.includes(b.zone)) continue;
    stats.total++;
    T.total++;
    T.zones[b.zone]++;
    const k = personKey(b.team, b.zone, b.harvester);
    stats.people[k] = (stats.people[k] || 0) + 1;
    if (stats.recent.length < FEED_MAX)
      stats.recent.push({ id: b.id, team: b.team, zone: b.zone, harvester: clean(b.harvester), masked: maskName(b.basket), ts: b.ts || 0 });
  }
  return stats;
}

function toast(msg, err = false) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.toggle("err", err);
  el.classList.add("on");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove("on"), 2600);
}

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const joinUrl = () => location.origin + location.pathname;
const screenUrl = () => joinUrl() + "#screen";

function drawQR(el, text, size) {
  el.innerHTML = "";
  if (window.QRCode) new window.QRCode(el, { text, width: size, height: size, correctLevel: window.QRCode.CorrectLevel.M });
  else el.textContent = text;
}

// ---------- data: demo (browser storage) ----------
function makeDemoBackend() {
  const KEY = "harvest-demo-v1";
  const subs = new Set();
  let bc = null;
  try { bc = new BroadcastChannel("harvest-demo"); bc.onmessage = () => emit(); } catch {}
  window.addEventListener("storage", (e) => { if (e.key === KEY) emit(); });
  const load = () => store.get(KEY, null) || { game: DEFAULT_GAME, baskets: [] };
  const save = (s) => { store.set(KEY, s); try { bc?.postMessage(1); } catch {} emit(); };
  function emit() { subs.forEach((f) => f()); }
  const sub = (f) => { subs.add(f); f(); return () => subs.delete(f); };
  return {
    mode: "demo",
    live: true,
    async init() {},
    onAuth(cb) { cb({ email: "Demo host" }); },
    async signIn() {}, async signOut() {},
    async addBasket(b) { const s = load(); const id = Math.random().toString(36).slice(2, 10); s.baskets.push({ ...b, id, ts: Date.now() }); save(s); return id; },
    async fetchPublic() { const s = load(); return { game: normalizeGame(s.game), stats: computeStats(s.baskets) }; },
    watchPublic(cb) { return sub(() => { const s = load(); cb({ game: normalizeGame(s.game), stats: computeStats(s.baskets) }); }); },
    watchGame(cb) { return sub(() => cb(normalizeGame(load().game))); },
    watchBaskets(cb) { return sub(() => cb([...load().baskets].sort((a, b) => b.ts - a.ts))); },
    async saveGame(g) { const s = load(); s.game = g; save(s); },
    async writeSummary() {},
    async writeKeys(map) { const s = load(); s.keys = map; store.set(KEY, s); },
    async fetchKeys() { return load().keys || {}; },
    async deleteBasket(id) { const s = load(); s.baskets = s.baskets.filter((b) => b.id !== id); save(s); },
    async resetAll() { const s = load(); s.baskets = []; save(s); },
  };
}

// ---------- data: Firebase ----------
function makeFirebaseBackend(conf) {
  let fs, au, db, auth;
  const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
  return {
    mode: "firebase",
    live: false,
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
    async addBasket(b) { const ref = await fs.addDoc(fs.collection(db, "baskets"), { ...b, ts: fs.serverTimestamp() }); return ref.id; },
    async fetchPublic() {
      const s = await fs.getDoc(fs.doc(db, "public", "summary"));
      if (s.exists()) { const d = s.data(); return { game: normalizeGame(d.game), stats: d.stats || null }; }
      const c = await fs.getDoc(fs.doc(db, "public", "config"));
      return { game: normalizeGame(c.exists() ? c.data() : null), stats: null };
    },
    watchGame(cb, err) {
      return fs.onSnapshot(fs.doc(db, "public", "config"), (s) => cb(normalizeGame(s.exists() ? s.data() : null)), err);
    },
    watchBaskets(cb, err) {
      const q = fs.query(fs.collection(db, "baskets"), fs.orderBy("ts", "desc"));
      return fs.onSnapshot(q, (snap) => {
        cb(snap.docs.map((d) => {
          const x = d.data({ serverTimestamps: "estimate" });
          return { id: d.id, team: x.team, zone: x.zone, harvester: x.harvester, basket: x.basket, relation: x.relation, ts: x.ts?.toMillis ? x.ts.toMillis() : Date.now() };
        }));
      }, err);
    },
    async saveGame(g) { await fs.setDoc(fs.doc(db, "public", "config"), g); },
    async writeSummary(sum) { await fs.setDoc(fs.doc(db, "public", "summary"), { ...sum, updatedAt: fs.serverTimestamp() }); },
    async writeKeys(map) { await fs.setDoc(fs.doc(db, "public", "keys"), { map, updatedAt: fs.serverTimestamp() }); },
    async fetchKeys() { const s = await fs.getDoc(fs.doc(db, "public", "keys")); return s.exists() ? s.data().map || {} : {}; },
    async deleteBasket(id) { await fs.deleteDoc(fs.doc(db, "baskets", id)); },
    async resetAll() {
      const snap = await fs.getDocs(fs.collection(db, "baskets"));
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const batch = fs.writeBatch(db);
        docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    },
  };
}

const backend = CFG.firebase ? makeFirebaseBackend(CFG.firebase) : makeDemoBackend();

// Host-signed-in views also publish the bucket lookup codes (see bucketCode)
function makeKeysWriter() {
  let last = "", timer = null, pending = [];
  return (baskets) => {
    pending = baskets;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const map = {};
      for (const b of pending) if (b.id && b.team && b.zone) map[await bucketCode(b.team, b.zone, b.harvester, b.basket, b.relation)] = b.id;
      const json = JSON.stringify(map);
      if (json === last) return;
      try { await backend.writeKeys(map); last = json; } catch (e) { console.warn("keys", e); }
    }, 1500);
  };
}

// Host-signed-in views (screen/host) read all buckets and publish a public summary for phones
function makeSummaryWriter() {
  let last = "", timer = null, pending = null;
  return (game, stats) => {
    if (backend.mode !== "firebase") return;
    pending = { game, stats: { ...stats, recent: (stats.recent || []).map(({ id, ...r }) => r) } }; // ids stay private
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const json = JSON.stringify(pending);
      if (json === last) return;
      try { await backend.writeSummary(pending); last = json; } catch (e) { console.warn("summary", e); }
    }, 1500);
  };
}

// ======================================================================
// Participant view
// ======================================================================
function startJoin() {
  const view = $("#view-join");
  view.hidden = false;
  let game = normalizeGame(null);
  let stats = null;
  let profile = store.get("harvest-profile", null);
  let mine = store.get("harvest-mine", []);
  let draft = { team: profile?.team, zone: profile?.zone };
  let lastMyCount = null;

  const myLocal = () => mine.filter((m) => profile && m.team === profile.team && m.zone === profile.zone && clean(m.name) === clean(profile.name));

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
    setTimeout(() => linkIds(), 0);
    showMain();
  });
  $("#j-change").addEventListener("click", () => {
    draft = { team: profile.team, zone: profile.zone };
    $("#j-name").value = profile.name;
    $("#j-main").hidden = true; $("#j-setup").hidden = false; renderSetup();
  });

  function showMain() {
    $("#j-setup").hidden = true; $("#j-main").hidden = false;
    $("#f-me").value = profile.name;
    lastMyCount = null;
    render();
  }

  function render() {
    if (!profile) return;
    const team = teamOf(game, profile.team) || game.teams[0];
    $("#j-who").textContent = profile.name;
    $("#j-where").textContent = `${team.name} · ${zoneName(game, team.id, profile.zone)}`;
    $("#j-all-sub").textContent = `All ${game.teams.length} teams`;
    $("#j-team-label").textContent = team.name;
    document.title = game.title;
    document.querySelector(".j-brand h1").textContent = game.title;

    const serverMine = stats?.people?.[personKey(profile.team, profile.zone, profile.name)] || 0;
    const my = Math.max(serverMine, myLocal().length);
    $("#j-mycount").textContent = my;
    $("#j-mylabel").textContent = my === 1 ? "bucket collected" : "buckets collected";
    const box = $("#j-mybaskets");
    if (my === 0) box.innerHTML = `<span class="empty-note">Buckets you add below will pile up here</span>`;
    else {
      const shown = Math.min(my, 60);
      const grew = lastMyCount !== null && my > lastMyCount;
      box.innerHTML = Array.from({ length: shown }, (_, i) => svg("i-basket", grew && i >= shown - (my - lastMyCount) ? "pop" : "")).join("") + (my > 60 ? `<span class="empty-note">+${my - 60}</span>` : "");
    }
    lastMyCount = my;

    const tn = stats?.teams?.[team.id]?.total || 0;
    $("#j-team-n").textContent = tn;
    $("#j-team-q").textContent = team.quota;
    setBar("#j-team-bar", tn / team.quota);
    $("#j-team-left").textContent = tn >= team.quota ? `Quota reached! +${tn - team.quota} extra` : `${team.quota - tn} to go`;
    const goal = game.teams.reduce((s, t) => s + t.quota, 0);
    const all = stats?.total || 0;
    $("#j-all-n").textContent = all;
    $("#j-all-q").textContent = goal;
    setBar("#j-all-bar", all / goal);

    const list = myLocal().slice().reverse();
    $("#j-minelist").innerHTML = list.map((m) => `<li><span class="mb">${esc(m.basket)}</span><span class="mr">${esc(m.relation)}</span>${
      m.id ? `<button type="button" class="mine-del" data-del="${esc(m.id)}" aria-label="Delete the bucket for ${esc(m.basket)}">Delete</button>` : `<span class="mine-old">Host only</span>`}</li>`).join("");
    $("#j-mine-old").hidden = !list.some((m) => !m.id);
    $("#j-mine-empty").hidden = list.length > 0;
    const elsewhere = my - list.length; // counted on the server but typed on another phone or browser
    $("#j-mine-other").hidden = elsewhere <= 0;
    $("#j-mine-other").textContent = elsewhere === 1
      ? "+1 more bucket added from another phone or browser. To list it here, use “Added a bucket on another phone?” below."
      : `+${elsewhere} more buckets added from another phone or browser. To list them here, use “Added a bucket on another phone?” below.`;
  }

  $("#j-minelist").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-del]");
    if (!b || b.disabled) return;
    if (b.dataset.armed !== "1") { // first tap asks to confirm
      b.dataset.armed = "1"; b.textContent = "Confirm"; b.classList.add("armed");
      setTimeout(() => { if (b.isConnected) { b.dataset.armed = ""; b.textContent = "Delete"; b.classList.remove("armed"); } }, 3000);
      return;
    }
    const id = b.dataset.del;
    const m = mine.find((x) => x.id === id);
    b.disabled = true; b.textContent = "Deleting…";
    try {
      await backend.deleteBasket(id);
      mine = mine.filter((x) => x.id !== id);
      store.set("harvest-mine", mine);
      if (stats && m && !backend.live) { // show it right away until the next refresh
        const dec = (o, k) => { if (o && o[k] > 0) o[k]--; };
        dec(stats, "total"); const T = stats.teams?.[m.team]; dec(T, "total"); dec(T?.zones, m.zone);
        dec(stats.people, personKey(m.team, m.zone, m.name));
      }
      lastMyCount = null;
      toast(m ? `Removed the bucket for ${m.basket}` : "Bucket removed");
      render();
    } catch (err) {
      console.error(err);
      b.disabled = false; b.dataset.armed = ""; b.textContent = "Delete"; b.classList.remove("armed");
      toast("Couldn't delete. Check your internet connection and try again.", true);
    }
  });

  $("#j-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const me = clean($("#f-me").value), basket = clean($("#f-basket").value), relation = clean($("#f-rel").value);
    if (!me || !basket || !relation) { toast("Please fill in all three fields", true); return; }
    if (me !== profile.name) { profile = { ...profile, name: me }; store.set("harvest-profile", profile); lastMyCount = null; }
    if (myLocal().some((m) => m.basket === basket)) { toast(`You already added a bucket for ${basket}`, true); return; }
    const btn = $("#f-submit");
    btn.disabled = true; btn.textContent = "Adding…";
    try {
      const id = await backend.addBasket({ team: profile.team, zone: profile.zone, harvester: me, basket, relation });
      mine.push({ id, team: profile.team, zone: profile.zone, name: me, basket, relation, ts: Date.now() });
      store.set("harvest-mine", mine);
      if (stats && !backend.live) { // show it right away until the next refresh
        stats.total++; const T = stats.teams[profile.team]; if (T) { T.total++; T.zones[profile.zone]++; }
      }
      dropApple(btn);
      $("#f-basket").value = ""; $("#f-rel").value = "";
      toast("Bucket added!");
      render();
    } catch (err) {
      console.error(err);
      toast("Couldn't save. Check your internet connection and tap again.", true);
    } finally {
      btn.disabled = false; btn.textContent = "Add bucket";
    }
  });

  function dropApple(from) {
    const target = $("#j-mybaskets").getBoundingClientRect();
    const start = from.getBoundingClientRect();
    const a = document.createElement("div");
    a.className = "drop-apple";
    a.innerHTML = svg("i-apple");
    a.querySelector("svg").style.cssText = "width:100%;height:100%";
    document.body.appendChild(a);
    const x0 = start.left + start.width / 2 - 17, y0 = start.top, x1 = target.left + Math.min(target.width - 40, 20 + Math.random() * 120), y1 = target.top + 10;
    a.animate([{ transform: `translate(${x0}px,${y0}px) scale(.6)` }, { transform: `translate(${(x0 + x1) / 2}px,${Math.min(y0, y1) - 80}px) scale(1.2)` }, { transform: `translate(${x1}px,${y1}px) scale(.8)` }], { duration: 750, easing: "cubic-bezier(.3,.1,.3,1)" }).onfinish = () => a.remove();
  }

  function apply(pub) {
    game = pub.game; if (pub.stats) stats = pub.stats;
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
  if (profile) { $("#j-setup").hidden = true; }

  // Give this phone the ids of its own buckets that it doesn't have yet (older entries),
  // so every bucket the person added can be deleted by them.
  let linking = null;
  async function linkIds() {
    if (!profile || linking) return linking;
    const missing = myLocal().filter((m) => !m.id);
    if (!missing.length) return;
    linking = (async () => {
      try {
        const keys = await backend.fetchKeys();
        let n = 0;
        for (const m of missing) {
          const id = keys[await bucketCode(m.team, m.zone, m.name, m.basket, m.relation)];
          if (id && !mine.some((x) => x.id === id)) { m.id = id; n++; }
        }
        if (n) { store.set("harvest-mine", mine); render(); }
      } catch (e) { console.warn("link ids", e); }
      finally { linking = null; }
    })();
    return linking;
  }
  linkIds();

  // A bucket typed on another phone: find it by its name and relationship and add it here.
  $("#j-find").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!profile) return;
    const basket = clean($("#j-find-name").value), relation = clean($("#j-find-rel").value);
    if (!basket || !relation) { toast("Type the bucket name and the relationship", true); return; }
    const btn = $("#j-find-btn");
    btn.disabled = true; btn.textContent = "Looking…";
    try {
      const keys = await backend.fetchKeys();
      const id = keys[await bucketCode(profile.team, profile.zone, profile.name, basket, relation)];
      if (!id) { toast("Couldn't find it. Type both exactly as you entered them. A brand-new bucket can take a minute to appear.", true); return; }
      if (mine.some((m) => m.id === id)) { toast(`${basket} is already in My buckets`); return; }
      const same = myLocal().find((m) => !m.id && clean(m.basket).toLowerCase() === basket.toLowerCase());
      if (same) same.id = id;
      else mine.unshift({ id, team: profile.team, zone: profile.zone, name: profile.name, basket, relation, ts: 0 });
      store.set("harvest-mine", mine);
      $("#j-find-name").value = ""; $("#j-find-rel").value = "";
      $("#j-find-box").open = false;
      toast(`Found ${basket}. You can delete it from My buckets now.`);
      render();
    } catch (err) {
      console.error(err);
      toast("Couldn't look it up. Check your internet connection and try again.", true);
    } finally {
      btn.disabled = false; btn.textContent = "Find my bucket";
    }
  });

  // One-time restore link (#restore=...): puts names that were added from another device
  // back into this phone's "My buckets" list. It never writes to the server or changes counts.
  if (location.hash.startsWith("#restore=")) {
    try {
      const raw = location.hash.slice("#restore=".length).replace(/-/g, "+").replace(/_/g, "/");
      const items = JSON.parse(decodeURIComponent(escape(atob(raw))));
      let added = 0;
      if (profile && Array.isArray(items)) {
        for (const [basket, relation] of items) {
          const b = clean(basket), r = clean(relation);
          if (b && !myLocal().some((m) => m.basket === b)) {
            mine.unshift({ team: profile.team, zone: profile.zone, name: profile.name, basket: b, relation: r, ts: 0 }); // shown as the oldest
            added++;
          }
        }
        store.set("harvest-mine", mine);
      }
      history.replaceState(null, "", location.pathname + location.search);
      setTimeout(() => toast(profile ? (added ? `Added ${added} name${added > 1 ? "s" : ""} to My buckets` : "My buckets is already up to date") : "Join first, then open the link again", !profile), 400);
      render();
    } catch (e) { console.warn("restore", e); }
  }
}

function setBar(sel, ratio) {
  const el = $(sel);
  el.classList.toggle("done", ratio >= 1);
  el.querySelector("i").style.width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
}

// ======================================================================
// Host sign-in (shared)
// ======================================================================
function withAdmin({ loginBox, msgEl, onReady }) {
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
  let game = normalizeGame(null), baskets = [], stats = computeStats([]);
  let prev = null; // previous per-team totals
  const feedSeen = new Set(); // feed items already shown, so only new ones animate
  const writeSummary = makeSummaryWriter();
  const writeKeys = makeKeysWriter();
  $("#s-signin").onclick = () => backend.signIn().catch((e) => toast("Sign-in failed: " + (e.code || e.message), true));

  withAdmin({
    loginBox: $("#s-login"), msgEl: $("#s-login-msg"),
    onReady() {
      backend.watchGame((g) => { game = g; draw(); }, (e) => adminDenied($("#s-login"), $("#s-login-msg"), e));
      backend.watchBaskets((list) => { baskets = list; stats = computeStats(list); draw(); writeKeys(list); }, (e) => adminDenied($("#s-login"), $("#s-login-msg"), e));
    },
  });

  // Keep the tree's roots just above the team boards on any screen shape.
  function fitBg() {
    const bg = $(".scr-bg"), boards = $("#s-teams");
    if (!bg || !boards) return;
    const W = innerWidth, H = innerHeight;
    const line = boards.getBoundingClientRect().top - H * 0.005;
    const scale = Math.max(W / BG.w, line / BG.feet, H / BG.h);
    const w = BG.w * scale, h = BG.h * scale;
    let y = line - BG.feet * scale;
    y = Math.min(0, Math.max(H - h, y));
    bg.style.backgroundSize = `${w}px ${h}px, auto`;
    bg.style.backgroundPosition = `${(W - w) / 2}px ${y}px, 0 0`;
  }
  addEventListener("resize", fitBg);

  function draw() {
    writeSummary(game, stats);
    document.title = game.title;
    $("#s-title").textContent = game.title;
    $("#s-total").textContent = stats.total;
    $("#s-goal").textContent = game.teams.reduce((s, t) => s + t.quota, 0);

    const ranked = [...game.teams].sort((a, b) => stats.teams[b.id].total / b.quota - stats.teams[a.id].total / a.quota);
    const rankOf = Object.fromEntries(ranked.map((t, i) => [t.id, i + 1]));
    const box = $("#s-teams");
    if (box.children.length !== game.teams.length) box.innerHTML = game.teams.map((t) => `<article class="team glass" data-id="${t.id}"></article>`).join("");

    game.teams.forEach((t) => {
      const el = box.querySelector(`[data-id="${t.id}"]`);
      const T = stats.teams[t.id];
      const n = T.total, q = t.quota;
      const before = prev ? prev[t.id] : n;
      const cols = Math.max(10, Math.ceil(Math.sqrt(q * 2.6)));
      const filled = Math.min(n, q);
      const slots = Array.from({ length: q }, (_, i) =>
        i < filled ? `<div class="slot${i >= before && prev ? " new" : ""}">${svg("i-basket")}</div>` : `<div class="slot empty"></div>`).join("");
      const zones = t.zones.map((z, i) => {
        const v = T.zones[ZONE_IDS[i]];
        const max = Math.max(1, ...ZONE_IDS.slice(0, t.zones.length).map((k) => T.zones[k]));
        return `<div class="zone"><span>${esc(z)}</span><div class="bar"><i style="width:${(v / max) * 100}%"></i></div><span class="num">${v}</span></div>`;
      }).join("");
      el.classList.toggle("done", n >= q);
      el.innerHTML = `
        ${n >= q ? `<div class="done-badge">Quota reached</div>` : ""}
        <div class="team-head"><h2>${esc(t.name)}</h2><span class="rank">#${rankOf[t.id]}</span></div>
        <div class="team-count num">${n}<small> / ${q}</small></div>
        <div class="slots" style="grid-template-columns:repeat(${cols},1fr)">${slots}</div>
        ${n > q ? `<div class="over">${svg("i-basket-gold", "")} +${n - q} extra</div>` : ""}
        <div class="zones">${zones}</div>`;
      const ov = el.querySelector(".over svg"); if (ov) ov.style.cssText = "width:1.4em;height:1.4em;vertical-align:-.35em";
      if (prev && n > before) for (let k = 0; k < Math.min(n - before, 5); k++) setTimeout(() => flyApple(el), k * 180);
      if (prev && before < q && n >= q) celebrate(t.name);
    });
    prev = Object.fromEntries(game.teams.map((t) => [t.id, stats.teams[t.id].total]));
    fitBg();

    const nameOf = Object.fromEntries(game.teams.map((t) => [t.id, t.name]));
    const feed = $("#s-feed");
    const keepTop = feed.scrollTop; // don't jump back to the top while someone is scrolling
    const firstDraw = !feedSeen.size;
    const items = stats.recent.slice(0, FEED_MAX);
    feed.innerHTML = items.map((r) => `
      <div class="feed-item glass${!firstDraw && !feedSeen.has(r.id) ? " new" : ""}" data-k="${esc(r.id)}">${svg("i-basket")}
        <div><div><span class="who">${esc(r.harvester)}</span> added a bucket</div>
        <div class="meta">${esc(nameOf[r.team] || "")} · ${esc(zoneName(game, r.team, r.zone))} · ${esc(r.masked)}</div></div></div>`).join("");
    items.forEach((r) => feedSeen.add(r.id));
    feed.scrollTop = keepTop;
  }

  function flyApple(card) {
    const r = card.getBoundingClientRect();
    const a = document.createElement("div");
    a.className = "fly";
    a.innerHTML = svg("i-apple");
    a.querySelector("svg").style.cssText = "width:100%;height:100%";
    document.body.appendChild(a);
    const x0 = innerWidth * (0.15 + Math.random() * 0.55), y0 = innerHeight * (0.06 + Math.random() * 0.22);
    const x1 = r.left + r.width / 2 - 22, y1 = r.top + 40;
    a.animate([
      { transform: `translate(${x0}px,${y0}px) scale(.7)`, opacity: 0 },
      { transform: `translate(${x0}px,${y0 + 10}px) scale(1)`, opacity: 1, offset: 0.15 },
      { transform: `translate(${x1}px,${y1}px) scale(.8) rotate(200deg)`, opacity: 1 },
    ], { duration: 1100, easing: "cubic-bezier(.5,0,.7,1)" }).onfinish = () => a.remove();
  }

  function celebrate(name) {
    const cel = $("#s-cel");
    cel.innerHTML = `<div class="msg">${esc(name)} reached the quota!<small>Every bucket for the fruit of the Tree of Life is ready</small></div>`;
    for (let i = 0; i < 40; i++) {
      const c = document.createElement("div");
      c.className = "confetti";
      c.innerHTML = svg(i % 3 ? "i-apple" : "i-basket-gold");
      c.querySelector("svg").style.cssText = "width:100%;height:100%";
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
  $("#a-url-screen").textContent = screenUrl();
  drawQR($("#a-qr"), joinUrl(), 150);
  let game = normalizeGame(null), baskets = [], formDirty = false;
  const writeSummary = makeSummaryWriter();
  const writeKeys = makeKeysWriter();
  $("#a-signin").onclick = () => backend.signIn().catch((e) => toast("Sign-in failed: " + (e.code || e.message), true));
  $("#a-signout").onclick = () => backend.signOut().then(() => location.reload());
  if (backend.mode === "demo") $("#a-demo").hidden = false;

  backend.onAuth((u) => {
    $("#a-who").textContent = u ? u.email : "";
    $("#a-signout").hidden = !u || backend.mode === "demo";
  });

  withAdmin({
    loginBox: $("#a-login"), msgEl: $("#a-login-msg"),
    onReady() {
      $("#a-main").hidden = false;
      const deny = (e) => { $("#a-main").hidden = true; adminDenied($("#a-login"), $("#a-login-msg"), e); };
      backend.watchGame((g) => { game = g; if (!formDirty) fillForm(); writeSummary(game, computeStats(baskets)); }, deny);
      backend.watchBaskets((list) => { baskets = list; renderRows(); writeSummary(game, computeStats(baskets)); writeKeys(list); }, deny);
    },
  });

  function fillForm() {
    $("#a-title").value = game.title;
    $("#a-teams").innerHTML = `<div class="team-edit head"><span></span><span>Team</span><span>Quota</span><span>Cells (comma-separated, up to 5)</span></div>` +
      game.teams.map((t, i) => `
      <div class="team-edit"><b>${i + 1}</b>
        <input id="a-tn-${t.id}" value="${esc(t.name)}" maxlength="20" aria-label="Team ${i + 1} name">
        <input id="a-tq-${t.id}" type="number" min="1" max="999" value="${t.quota}" aria-label="Team ${i + 1} quota">
        <input id="a-tz-${t.id}" value="${esc(t.zones.join(", "))}" aria-label="Team ${i + 1} cells"></div>`).join("");
  }
  $("#a-form").addEventListener("input", () => (formDirty = true));
  $("#a-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const g = normalizeGame({
      title: $("#a-title").value,
      v: GAME_VERSION,
      teams: TEAM_IDS.map((id) => ({ id, name: $(`#a-tn-${id}`).value, quota: $(`#a-tq-${id}`).value, zones: $(`#a-tz-${id}`).value.split(",") })),
    });
    try { await backend.saveGame(g); formDirty = false; toast("Settings saved"); }
    catch (err) { console.error(err); toast("Couldn't save. Check that you're signed in as the host.", true); }
  });

  function renderRows() {
    const tn = Object.fromEntries(game.teams.map((t) => [t.id, t.name]));
    $("#a-count").textContent = `${baskets.length}`;
    $("#a-rows").innerHTML = baskets.map((b) => `
      <tr><td class="num">${new Date(b.ts).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</td>
      <td>${esc(tn[b.team] || b.team)}</td><td>${esc(zoneName(game, b.team, b.zone) || b.zone)}</td>
      <td>${esc(b.harvester)}</td><td>${esc(b.basket)}</td><td>${esc(b.relation)}</td>
      <td><button data-del="${esc(b.id)}">Delete</button></td></tr>`).join("") || `<tr><td colspan="7" class="muted">No buckets yet.</td></tr>`;
  }
  $("#a-rows").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-del]");
    if (!b) return;
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Confirm"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "Delete"; }, 3000); return; }
    try { await backend.deleteBasket(b.dataset.del); toast("Deleted"); } catch { toast("Couldn't delete", true); }
  });

  $("#a-csv").onclick = () => {
    const tn = Object.fromEntries(game.teams.map((t) => [t.id, t.name]));
    const rows = [["Time", "Team", "Cell", "Harvester", "Bucket name", "Relationship"], ...baskets.map((b) => [new Date(b.ts).toLocaleString("en-GB"), tn[b.team], zoneName(game, b.team, b.zone), b.harvester, b.basket, b.relation])];
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `fruit-bucket-quest_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  $("#a-reset-text").addEventListener("input", (e) => ($("#a-reset").disabled = e.target.value.trim().toUpperCase() !== "RESET"));
  $("#a-reset").onclick = async () => {
    $("#a-reset").disabled = true;
    try { await backend.resetAll(); $("#a-reset-text").value = ""; toast("All buckets deleted"); }
    catch { toast("Couldn't reset", true); }
  };

  $("#a-demo").onclick = async () => {
    const names = ["Anna", "Luca", "Mia", "Noah", "Lea", "Elias", "Sofia", "Jonas", "Lina", "David"];
    const fams = ["Anna", "Ben", "Clara", "Daniel", "Emma", "Felix", "Hanna", "Leon"], gives = ["Meier", "Keller", "Brunner", "Huber", "Weber", "Fischer"];
    const rels = ["Friend", "Family", "Coworker", "Neighbor", "Classmate"];
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    for (let i = 0; i < 30; i++) {
      const t = pick(game.teams);
      await backend.addBasket({ team: t.id, zone: ZONE_IDS[Math.floor(Math.random() * t.zones.length)], harvester: "Sample " + pick(names), basket: pick(fams) + " " + pick(gives), relation: pick(rels) });
    }
    toast("Added 30 sample buckets");
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
  else if (QUEST_CLOSED) $("#view-closed").hidden = false;
  else startJoin();
}
window.addEventListener("hashchange", () => location.reload());
boot();
