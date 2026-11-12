// The Ripening Quest (Game 2) — participant (ripen.html) · big screen (#screen) · host (#admin)
// Simple rules: pick a person -> give Water, Nourish and Sunlight once each -> the fruit turns red
// -> +1 red fruit for your team. Teams race to fill their red-fruit goal.
const CFG = window.HARVEST_CONFIG || {};
const FB_VER = "10.12.2";
const TEAM_IDS = ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8"];
const ZONE_IDS = ["z1", "z2", "z3", "z4", "z5"];
const STEPS = [
  { id: "water", name: "Water", icon: "i-water", did: "gave water to" },
  { id: "nourish", name: "Nourish", icon: "i-sprout", did: "nourished" },
  { id: "sun", name: "Sunlight", icon: "i-sun", did: "gave sunlight to" },
];
const STEP_OF = Object.fromEntries(STEPS.map((x) => [x.id, x]));
const FEED_MAX = 50;
const CARE_MAX = 30; // care taps the big-screen feed keeps

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

// ---------- helpers ----------
const $ = (s) => document.querySelector(s);
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 20);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const svg = (id, cls = "") => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
function maskWord(w) { const a = [...w]; if (a.length <= 1) return w; if (a.length === 2) return a[0] + "*"; return a[0] + "*".repeat(a.length - 2) + a[a.length - 1]; }
const maskName = (n) => clean(n).split(" ").map(maskWord).join(" ");
const personKey = (team, zone, name) => `${team}|${zone}|${clean(name)}`;

// Teams and cells come from the bucket game (public/config); goals from this game (public/config2)
function normalizeGame(g1, g2) {
  g1 = g1 || {}; g2 = g2 || {};
  const current = g1.v === GAME1_VERSION;
  const teams = TEAM_IDS.map((id, i) => {
    const d = DEFAULT_TEAMS[i];
    const t = current ? (g1.teams || []).find((x) => x && x.id === id) || {} : {};
    const zones = (Array.isArray(t.zones) ? t.zones : []).map((z) => clean(z).slice(0, 12)).filter(Boolean).slice(0, ZONE_IDS.length);
    const q1 = Math.round(Number(t.quota)), q2 = Math.round(Number(g2.goals?.[id]));
    const goal = q2 > 0 && q2 <= 999 ? q2 : q1 > 0 && q1 <= 999 ? q1 : d.quota || 60;
    return { id, name: clean(t.name) || d.name, zones: zones.length ? zones : [...d.zones], goal };
  });
  return { title: String(g2.title ?? "").replace(/\s+/g, " ").trim().slice(0, 40) || "The Ripening Quest", teams };
}
const teamOf = (game, id) => game.teams.find((t) => t.id === id);
const zoneName = (game, teamId, zoneId) => teamOf(game, teamId)?.zones[ZONE_IDS.indexOf(zoneId)] || "";

function computeStats(fruits) {
  const S = { total: 0, teams: {}, people: {}, recent: [] };
  TEAM_IDS.forEach((t) => (S.teams[t] = { total: 0, zones: Object.fromEntries(ZONE_IDS.map((z) => [z, 0])) }));
  for (const f of [...fruits].sort((a, b) => (b.ts || 0) - (a.ts || 0))) {
    const T = S.teams[f.team];
    if (!T || !ZONE_IDS.includes(f.zone)) continue;
    S.total++; T.total++; T.zones[f.zone]++;
    const k = personKey(f.team, f.zone, f.harvester);
    S.people[k] = (S.people[k] || 0) + 1;
    if (S.recent.length < FEED_MAX) S.recent.push({ id: f.id, team: f.team, zone: f.zone, harvester: clean(f.harvester), masked: maskName(f.fruit), ts: f.ts || 0 });
  }
  return S;
}

function toast(msg, err = false) {
  const el = $("#toast");
  el.textContent = msg; el.classList.toggle("err", err); el.classList.add("on");
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("on"), 2600);
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
  const el = $(sel);
  el.classList.toggle("done", ratio >= 1);
  el.querySelector("i").style.width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
}
// apple colour for 0..3 steps done
const STEP_COLORS = ["#6aa84f", "#b5c43a", "#f0a03a", "#c8283a"];

// ---------- data: demo (browser storage) ----------
function makeDemoBackend() {
  const KEY = "ripen-demo-v2";
  const subs = new Set();
  let bc = null;
  try { bc = new BroadcastChannel("ripen-demo"); bc.onmessage = () => emit(); } catch {}
  window.addEventListener("storage", (e) => { if (e.key === KEY || e.key === "harvest-demo-v1") emit(); });
  const load = () => { const s = store.get(KEY, null) || { cfg: {}, fruits: [] }; s.care ||= []; return s; };
  const g1 = () => (store.get("harvest-demo-v1", null) || {}).game;
  const save = (s) => { store.set(KEY, s); try { bc?.postMessage(1); } catch {} emit(); };
  function emit() { subs.forEach((f) => f()); }
  const sub = (f) => { subs.add(f); f(); return () => subs.delete(f); };
  return {
    mode: "demo", live: true,
    async init() {},
    onAuth(cb) { cb({ email: "Demo host" }); },
    async signIn() {}, async signOut() {},
    async addFruit(f) { const s = load(); const id = Math.random().toString(36).slice(2, 10); s.fruits.push({ ...f, id, ts: Date.now() }); save(s); return id; },
    async deleteFruit(id) { const s = load(); s.fruits = s.fruits.filter((f) => f.id !== id); save(s); },
    async resetAll() { const s = load(); s.fruits = []; s.care = []; save(s); },
    async addCare(c) { const s = load(); s.care.push({ ...c, id: Math.random().toString(36).slice(2, 10), ts: Date.now() }); s.care = s.care.slice(-CARE_MAX); save(s); },
    watchCare(cb) { return sub(() => cb([...load().care].sort((a, b) => b.ts - a.ts))); },
    watchPublic(cb) { return sub(() => { const s = load(); cb({ game: normalizeGame(g1(), s.cfg), stats: computeStats(s.fruits) }); }); },
    watchGame(cb) { return sub(() => cb(normalizeGame(g1(), load().cfg))); },
    watchFruits(cb) { return sub(() => cb([...load().fruits])); },
    async saveCfg(c) { const s = load(); s.cfg = c; save(s); },
    async writeSummary() {},
  };
}

// ---------- data: Firebase (same project as the bucket game) ----------
function makeFirebaseBackend(conf) {
  let fs, au, db, auth;
  const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
  return {
    mode: "firebase", live: false,
    async init() {
      const [appM, fsM, auM] = await Promise.all([import(base + "firebase-app.js"), import(base + "firebase-firestore.js"), import(base + "firebase-auth.js")]);
      fs = fsM; au = auM;
      const app = appM.initializeApp(conf);
      db = fs.getFirestore(app); auth = au.getAuth(app);
    },
    onAuth(cb) { au.onAuthStateChanged(auth, (u) => cb(u ? { email: u.email } : null)); },
    async signIn() { await au.signInWithPopup(auth, new au.GoogleAuthProvider()); },
    async signOut() { await au.signOut(auth); },
    async addFruit(f) { const ref = await fs.addDoc(fs.collection(db, "redfruits"), { ...f, ts: fs.serverTimestamp() }); return ref.id; },
    async deleteFruit(id) { await fs.deleteDoc(fs.doc(db, "redfruits", id)); },
    async addCare(c) { await fs.addDoc(fs.collection(db, "care2"), { ...c, ts: fs.serverTimestamp() }); },
    watchCare(cb, err) {
      const q = fs.query(fs.collection(db, "care2"), fs.orderBy("ts", "desc"), fs.limit(CARE_MAX));
      return fs.onSnapshot(q, (snap) => cb(snap.docs.map((d) => {
        const x = d.data({ serverTimestamps: "estimate" });
        return { id: d.id, team: x.team, zone: x.zone, harvester: x.harvester, fruit: x.fruit, kind: x.kind, ts: x.ts?.toMillis ? x.ts.toMillis() : Date.now() };
      })), err);
    },
    async fetchPublic() {
      const s = await fs.getDoc(fs.doc(db, "public", "summary2"));
      if (s.exists()) { const d = s.data(); return { game: d.game, stats: d.stats || null }; }
      const [a, b] = await Promise.all([fs.getDoc(fs.doc(db, "public", "config")), fs.getDoc(fs.doc(db, "public", "config2"))]);
      return { game: normalizeGame(a.exists() ? a.data() : null, b.exists() ? b.data() : null), stats: null };
    },
    watchGame(cb, err) {
      let g1 = null, g2 = null;
      fs.onSnapshot(fs.doc(db, "public", "config"), (s) => { g1 = s.exists() ? s.data() : null; cb(normalizeGame(g1, g2)); }, err);
      fs.onSnapshot(fs.doc(db, "public", "config2"), (s) => { g2 = s.exists() ? s.data() : null; cb(normalizeGame(g1, g2)); }, err);
    },
    watchFruits(cb, err) {
      return fs.onSnapshot(fs.collection(db, "redfruits"), (snap) => cb(snap.docs.map((d) => {
        const x = d.data({ serverTimestamps: "estimate" });
        return { id: d.id, team: x.team, zone: x.zone, harvester: x.harvester, fruit: x.fruit, ts: x.ts?.toMillis ? x.ts.toMillis() : Date.now() };
      })), err);
    },
    async saveCfg(c) { await fs.setDoc(fs.doc(db, "public", "config2"), c); },
    async writeSummary(sum) { await fs.setDoc(fs.doc(db, "public", "summary2"), { ...sum, updatedAt: fs.serverTimestamp() }); },
    async resetAll() {
      const snap = { docs: [...(await fs.getDocs(fs.collection(db, "redfruits"))).docs, ...(await fs.getDocs(fs.collection(db, "care2"))).docs] };
      for (let i = 0; i < snap.docs.length; i += 400) {
        const batch = fs.writeBatch(db);
        snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    },
  };
}

const backend = CFG.firebase ? makeFirebaseBackend(CFG.firebase) : makeDemoBackend();

function makeSummaryWriter() {
  let last = "", timer = null, pending = null;
  return (game, stats) => {
    if (backend.mode !== "firebase") return;
    pending = { game, stats: { ...stats, recent: stats.recent.slice(0, 10).map(({ id, ...r }) => r) } };
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const json = JSON.stringify(pending);
      if (json === last) return;
      try { await backend.writeSummary(pending); last = json; } catch (e) { console.warn("summary2", e); }
    }, 1500);
  };
}

// ======================================================================
// Participant view
// ======================================================================
function startJoin() {
  $("#view-join").hidden = false;
  let game = normalizeGame(null, null), stats = null;
  let profile = store.get("harvest-profile", null); // same as the bucket game on this site
  let mine = store.get("ripen-mine", []);           // red fruits this phone made: [{id, team, zone, name, fruit, ts}]
  const buckets = store.get("harvest-mine", []);    // names from the bucket game, used as suggestions
  let draft = { team: profile?.team, zone: profile?.zone };
  let cur = null; // { fruit, done: Set }

  const myLocal = () => mine.filter((m) => profile && m.team === profile.team && m.zone === profile.zone && clean(m.name) === clean(profile.name));

  // ---- setup ----
  function renderSetup() {
    $("#j-teams").innerHTML = game.teams.map((t) => `<button type="button" data-team="${t.id}" aria-pressed="${draft.team === t.id}">${esc(t.name)}</button>`).join("");
    const team = teamOf(game, draft.team);
    const zones = team ? team.zones : [];
    if (team && !(ZONE_IDS.indexOf(draft.zone) >= 0 && ZONE_IDS.indexOf(draft.zone) < zones.length)) draft.zone = zones.length === 1 ? ZONE_IDS[0] : undefined;
    $("#j-zone-step").hidden = !team;
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
  function showMain() { $("#j-setup").hidden = true; $("#j-main").hidden = false; render(); }

  // ---- main ----
  function render() {
    if (!profile || $("#j-main").hidden) return;
    const team = teamOf(game, profile.team) || game.teams[0];
    document.title = game.title;
    $("#j-title").textContent = game.title;
    $("#j-who").textContent = profile.name;
    $("#j-where").textContent = `${team.name} · ${zoneName(game, team.id, profile.zone)}`;

    const tn = stats?.teams?.[team.id]?.total || 0;
    $("#j-team-label").textContent = `${team.name} red fruits`;
    $("#j-team-n").textContent = tn;
    $("#j-team-q").textContent = team.goal;
    setBar("#j-team-bar", tn / team.goal);
    $("#j-team-left").textContent = tn >= team.goal ? `Goal reached! +${tn - team.goal} extra` : `${team.goal - tn} more to the goal`;

    const my = Math.max(stats?.people?.[personKey(profile.team, profile.zone, profile.name)] || 0, myLocal().length);
    $("#j-mycount").textContent = my;

    // step 1 or step 2
    $("#j-pick").hidden = !!cur;
    $("#j-grow").hidden = !cur;
    if (!cur) {
      const done = new Set(myLocal().map((m) => clean(m.fruit).toLowerCase()));
      const sugg = [...new Set(buckets.filter((b) => profile && b.team === profile.team && clean(b.name) === clean(profile.name)).map((b) => clean(b.basket)))]
        .filter((n) => n && !done.has(n.toLowerCase())).slice(0, 12);
      $("#j-sugg-wrap").hidden = !sugg.length;
      $("#j-sugg").innerHTML = sugg.map((n) => `<button type="button" data-name="${esc(n)}">${esc(n)}</button>`).join("");
    } else {
      const n = cur.done.size;
      $("#j-grow-name").textContent = cur.fruit;
      $("#j-big-apple path.body").setAttribute("fill", STEP_COLORS[n]);
      $("#j-grow-hint").textContent = n === 0 ? "Tap all three to make it red" : n === 1 ? "Two more!" : "One more and it's red!";
      $("#j-steps").innerHTML = STEPS.map((s) => `<button type="button" class="step-btn ${s.id}" data-step="${s.id}" ${cur.done.has(s.id) ? "disabled" : ""}>
        ${svg(s.icon, "step-ic")}<span>${s.name}</span>${cur.done.has(s.id) ? `<b class="ok">✓</b>` : ""}</button>`).join("");
    }

    const list = myLocal().slice().reverse();
    $("#j-mine").innerHTML = list.map((m) => `<li>${svg("i-apple-red", "mi")}<span class="mb">${esc(m.fruit)}</span>${m.id ? `<button type="button" class="mine-del" data-del="${esc(m.id)}">Delete</button>` : ""}</li>`).join("");
    $("#j-mine-empty").hidden = list.length > 0;
  }

  function startFruit(name) {
    const n = clean(name);
    if (!n) { toast("Type a name first", true); return; }
    if (myLocal().some((m) => clean(m.fruit).toLowerCase() === n.toLowerCase())) { toast(`${n} is already a red fruit`, true); return; }
    cur = { fruit: n, done: new Set() };
    $("#j-fruit-name").value = "";
    render();
  }
  $("#j-pick-form").addEventListener("submit", (e) => { e.preventDefault(); startFruit($("#j-fruit-name").value); });
  $("#j-sugg").addEventListener("click", (e) => { const b = e.target.closest("[data-name]"); if (b) startFruit(b.dataset.name); });
  $("#j-cancel").addEventListener("click", () => { cur = null; render(); });

  $("#j-steps").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-step]");
    if (!b || b.disabled || !cur) return;
    cur.done.add(b.dataset.step);
    backend.addCare({ team: profile.team, zone: profile.zone, harvester: profile.name, fruit: cur.fruit, kind: b.dataset.step }).catch((e) => console.warn("care", e));
    render();
    const ap = $("#j-big-apple");
    ap.animate([{ transform: "scale(1)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }], { duration: 450, easing: "ease-out" });
    if (cur.done.size < STEPS.length) return;

    // all three done: it's red -> save it for the team
    const f = cur;
    $("#j-steps").querySelectorAll("button").forEach((x) => (x.disabled = true));
    try {
      const id = await backend.addFruit({ team: profile.team, zone: profile.zone, harvester: profile.name, fruit: f.fruit });
      mine.push({ id, team: profile.team, zone: profile.zone, name: profile.name, fruit: f.fruit, ts: Date.now() });
      store.set("ripen-mine", mine);
      if (stats && !backend.live) { stats.total++; const T = stats.teams[profile.team]; if (T) { T.total++; T.zones[profile.zone]++; } }
      burst(ap);
      toast(`${f.fruit} is red! +1 for ${teamOf(game, profile.team)?.name || "your team"}`);
      setTimeout(() => { cur = null; render(); }, 1100);
    } catch (err) {
      console.error(err);
      cur.done.delete(b.dataset.step);
      render();
      toast("Couldn't save. Check your internet connection and tap again.", true);
    }
  });

  function burst(el) {
    const r = el.getBoundingClientRect();
    for (let i = 0; i < 14; i++) {
      const d = document.createElement("div");
      d.className = "spark";
      document.body.appendChild(d);
      const a = (i / 14) * Math.PI * 2, dist = 70 + Math.random() * 40, x = r.left + r.width / 2, y = r.top + r.height / 2;
      d.animate([{ transform: `translate(${x}px,${y}px)`, opacity: 1 }, { transform: `translate(${x + Math.cos(a) * dist}px,${y + Math.sin(a) * dist}px) scale(.3)`, opacity: 0 }], { duration: 900, easing: "ease-out" }).onfinish = () => d.remove();
    }
  }

  $("#j-mine").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-del]");
    if (!b || b.disabled) return;
    if (b.dataset.armed !== "1") {
      b.dataset.armed = "1"; b.textContent = "Confirm"; b.classList.add("armed");
      setTimeout(() => { if (b.isConnected) { b.dataset.armed = ""; b.textContent = "Delete"; b.classList.remove("armed"); } }, 3000);
      return;
    }
    const id = b.dataset.del, m = mine.find((x) => x.id === id);
    b.disabled = true;
    try {
      await backend.deleteFruit(id);
      mine = mine.filter((x) => x.id !== id);
      store.set("ripen-mine", mine);
      if (stats && m && !backend.live) { const dec = (o, k) => { if (o && o[k] > 0) o[k]--; }; dec(stats, "total"); const T = stats.teams?.[m.team]; dec(T, "total"); dec(T?.zones, m.zone); dec(stats.people, personKey(m.team, m.zone, m.name)); }
      toast("Removed");
      render();
    } catch (err) { console.error(err); b.disabled = false; toast("Couldn't delete. Try again.", true); }
  });

  function apply(pub) {
    game = pub.game?.teams ? pub.game : normalizeGame(null, null);
    if (pub.stats) stats = pub.stats;
    $("#j-sync").textContent = backend.live ? "Live" : "Just updated";
    if (!profile) { $("#j-setup").hidden = false; renderSetup(); }
    else if (!$("#j-setup").hidden) renderSetup();
    else if ($("#j-main").hidden) showMain();
    else render();
  }
  if (backend.live) backend.watchPublic(apply);
  else {
    const poll = async () => { if (document.hidden) return; try { apply(await backend.fetchPublic()); } catch { $("#j-sync").textContent = "Reconnecting…"; } };
    poll();
    setInterval(poll, Math.max(10, CFG.pollSeconds || 30) * 1000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });
  }
  if (profile) $("#j-setup").hidden = true;
}

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
  let game = normalizeGame(null, null), fruits = [], care = [], stats = computeStats([]), prev = null;
  let loaded = false; // the first list of red fruits is history: no pop-ups for it
  const showing = {}; // team id -> number shown while it counts up
  const feedSeen = new Set();
  const writeSummary = makeSummaryWriter();
  $("#s-signin").onclick = () => backend.signIn().catch((e) => toast("Sign-in failed: " + (e.code || e.message), true));

  // Background film: rests on its last frame (the ripe tree) and replays from the start for every new red fruit
  const vid = $("#s-video");
  const toEnd = () => { if (vid.duration) { vid.pause(); vid.currentTime = Math.max(0, vid.duration - 0.05); } };
  vid.addEventListener("loadedmetadata", toEnd);
  vid.addEventListener("ended", toEnd);
  function replay() {
    try { vid.currentTime = 0; const p = vid.play(); if (p) p.catch(() => {}); } catch {}
  }

  withAdmin({
    loginBox: $("#s-login"),
    onReady() {
      const deny = (e) => adminDenied($("#s-login"), $("#s-login-msg"), e);
      backend.watchGame((g) => { game = g; drawTeams(); drawFeed(); }, deny);
      backend.watchFruits((list) => { fruits = list; stats = computeStats(list); drawTeams(); if (!loaded) { loaded = true; drawTeams(); } drawFeed(); }, deny);
      backend.watchCare((list) => { care = list; drawFeed(); }, deny);
    },
  });

  function drawTeams() {
    writeSummary(game, stats);
    document.title = game.title;
    $("#s-title").textContent = game.title;
    $("#s-total").textContent = stats.total;
    $("#s-goal").textContent = game.teams.reduce((s, t) => s + t.goal, 0);

    const ranked = [...game.teams].sort((a, b) => stats.teams[b.id].total / b.goal - stats.teams[a.id].total / a.goal);
    const rankOf = Object.fromEntries(ranked.map((t, i) => [t.id, i + 1]));
    const box = $("#s-teams");
    if (box.children.length !== game.teams.length) box.innerHTML = game.teams.map((t) => `<article class="team glass" data-id="${t.id}"><div class="tc"></div></article>`).join("");

    let grew = false;
    game.teams.forEach((t) => {
      const el = box.querySelector(`[data-id="${t.id}"]`);
      const T = stats.teams[t.id], n = T.total, q = t.goal;
      const before = prev ? prev[t.id] : n;
      const up = n > before;
      if (up) grew = true;
      const cols = Math.max(6, Math.ceil(Math.sqrt(q * 1.4)));
      const filled = Math.min(n, q);
      const slots = Array.from({ length: q }, (_, i) =>
        `<div class="slot${i < filled ? " red" : ""}${up && i < filled && i >= before ? " new" : ""}">${svg(i < filled ? "i-apple-red" : "i-apple-green")}</div>`).join("");
      const zones = t.zones.map((z, i) => {
        const v = T.zones[ZONE_IDS[i]];
        const max = Math.max(1, ...ZONE_IDS.slice(0, t.zones.length).map((k) => T.zones[k]));
        return `<div class="zone"><span>${esc(z)}</span><div class="bar"><i style="width:${(v / max) * 100}%"></i></div><span class="num">${v}</span></div>`;
      }).join("");
      el.classList.toggle("done", n >= q);
      if (up) showing[t.id] = Math.min(showing[t.id] ?? before, before);
      el.querySelector(".tc").innerHTML = `
        ${n >= q ? `<div class="done-badge">Goal reached</div>` : ""}
        <div class="team-head"><h2>${esc(t.name)}</h2><span class="rank">#${rankOf[t.id]}</span></div>
        <div class="team-count num"><span class="cnt">${showing[t.id] ?? n}</span><small> / ${q}</small></div>
        <div class="slots" style="grid-template-columns:repeat(${cols},1fr)">${slots}</div>
        ${n > q ? `<div class="over">+${n - q} extra</div>` : ""}
        <div class="zones">${zones}</div>`;
      if (up) ripenPop(el, before, n);
      if (prev && before < q && n >= q) setTimeout(() => celebrate(t.name), 1800);
    });
    if (grew) replay();
    if (loaded) prev = Object.fromEntries(game.teams.map((t) => [t.id, stats.teams[t.id].total]));
  }

  // "Fruit is ripened!" pops above the team name, then the team's number counts up
  function ripenPop(card, from, to) {
    const pop = document.createElement("div");
    pop.className = "ripe-pop";
    pop.innerHTML = `${svg("i-apple-red")}<span>Fruit is ripened!</span>${to - from > 1 ? `<b>+${to - from}</b>` : ""}`;
    card.appendChild(pop);
    setTimeout(() => pop.remove(), 4200);
    const id = card.dataset.id;
    clearTimeout(ripenPop[id]);
    ripenPop[id] = setTimeout(function step() {
      const target = stats.teams[id]?.total ?? to;
      const v = Math.min((showing[id] ?? target) + 1, target);
      showing[id] = v;
      const cnt = card.querySelector(".cnt");
      cnt.textContent = v;
      cnt.animate([{ transform: "scale(1.6)", color: "#ffd23f" }, { transform: "scale(1)", color: "#fff" }], { duration: 600, easing: "cubic-bezier(.2,1.4,.4,1)" });
      if (v < target) ripenPop[id] = setTimeout(step, 250);
      else delete showing[id];
    }, 700);
    card.animate([{ boxShadow: "0 0 0 3px #ffd23f, 0 0 46px rgba(255,210,63,.85)" }, { boxShadow: "0 8px 30px rgba(0,0,0,.18)" }], { duration: 2400, easing: "ease-out" });
  }

  // Feed: every Water / Nourish / Sunlight tap, plus each fruit that turns red
  function drawFeed() {
    const nameOf = Object.fromEntries(game.teams.map((t) => [t.id, t.name]));
    const items = [
      ...care.map((c) => ({ ...c, type: "care" })),
      ...stats.recent.slice(0, CARE_MAX).map((r) => ({ ...r, type: "ripe", ts: (r.ts || 0) + 1 })),
    ].sort((a, b) => b.ts - a.ts).slice(0, CARE_MAX);
    const feed = $("#s-feed"), keepTop = feed.scrollTop, first = !feedSeen.size;
    feed.innerHTML = items.map((r) => {
      const key = r.type + r.id;
      const isNew = !first && !feedSeen.has(key);
      const where = `${esc(nameOf[r.team] || "")} · ${esc(zoneName(game, r.team, r.zone))}`;
      if (r.type === "ripe") return `<div class="feed-item glass ripe${isNew ? " new" : ""}">${svg("i-apple-red")}
        <div><div><span class="who">${esc(r.harvester)}</span>'s fruit is ripened! <span class="fr">${esc(r.masked)}</span></div><div class="meta">${where}</div></div></div>`;
      const st = STEP_OF[r.kind] || STEPS[0];
      return `<div class="feed-item glass${isNew ? " new" : ""}">${svg(st.icon, r.kind)}
        <div><div><span class="who">${esc(r.harvester)}</span> ${st.did} <span class="fr">${esc(maskName(r.fruit))}</span></div><div class="meta">${where}</div></div></div>`;
    }).join("");
    items.forEach((r) => feedSeen.add(r.type + r.id));
    feed.scrollTop = keepTop;
  }

  function celebrate(name) {
    const cel = $("#s-cel");
    cel.innerHTML = `<div class="msg">${esc(name)} reached the goal!<small>Every fruit is red and ready for harvest</small></div>`;
    for (let i = 0; i < 40; i++) {
      const c = document.createElement("div");
      c.className = "confetti"; c.innerHTML = svg("i-apple-red");
      c.style.left = Math.random() * 100 + "%";
      c.style.animationDuration = 2.5 + Math.random() * 2.5 + "s";
      c.style.animationDelay = Math.random() * 0.8 + "s";
      cel.appendChild(c);
    }
    clearTimeout(celebrate.t); celebrate.t = setTimeout(() => (cel.innerHTML = ""), 5500);
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
  let game = normalizeGame(null, null), fruits = [], dirty = false;
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
      backend.watchGame((g) => { game = g; if (!dirty) fillForm(); renderRows(); writeSummary(game, computeStats(fruits)); }, deny);
      backend.watchFruits((l) => { fruits = l; renderRows(); writeSummary(game, computeStats(fruits)); }, deny);
    },
  });

  function fillForm() {
    $("#a-title").value = game.title;
    $("#a-goals").innerHTML = game.teams.map((t) => `<label class="goal-edit"><span>${esc(t.name)}</span><input id="a-g-${t.id}" type="number" min="1" max="999" value="${t.goal}"></label>`).join("");
  }
  $("#a-form").addEventListener("input", () => (dirty = true));
  $("#a-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const c = { title: String($("#a-title").value).trim().slice(0, 40), goals: Object.fromEntries(TEAM_IDS.map((id) => [id, Math.round(Number($(`#a-g-${id}`).value)) || 0])) };
    try { await backend.saveCfg(c); dirty = false; toast("Settings saved"); }
    catch (err) { console.error(err); toast("Couldn't save. Check that you're signed in as the host.", true); }
  });

  function renderRows() {
    const tn = Object.fromEntries(game.teams.map((t) => [t.id, t.name]));
    const list = [...fruits].sort((a, b) => b.ts - a.ts);
    $("#a-count").textContent = list.length;
    $("#a-rows").innerHTML = list.map((f) => `<tr><td class="num">${new Date(f.ts).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
      <td>${esc(tn[f.team] || f.team)}</td><td>${esc(zoneName(game, f.team, f.zone) || f.zone)}</td><td>${esc(f.harvester)}</td><td>${esc(f.fruit)}</td>
      <td><button data-del="${esc(f.id)}">Delete</button></td></tr>`).join("") || `<tr><td colspan="6" class="muted">No red fruits yet.</td></tr>`;
  }
  $("#a-rows").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-del]");
    if (!b) return;
    if (b.dataset.armed !== "1") { b.dataset.armed = "1"; b.textContent = "Confirm"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "Delete"; }, 3000); return; }
    try { await backend.deleteFruit(b.dataset.del); toast("Deleted"); } catch { toast("Couldn't delete", true); }
  });

  $("#a-csv").onclick = () => {
    const tn = Object.fromEntries(game.teams.map((t) => [t.id, t.name]));
    const rows = [["Time", "Team", "Cell", "Gardener", "Red fruit (name)"], ...[...fruits].sort((a, b) => a.ts - b.ts).map((f) => [new Date(f.ts).toLocaleString("en-GB"), tn[f.team], zoneName(game, f.team, f.zone), f.harvester, f.fruit])];
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `ripening-quest_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  $("#a-reset-text").addEventListener("input", (e) => ($("#a-reset").disabled = e.target.value.trim().toUpperCase() !== "RESET"));
  $("#a-reset").onclick = async () => {
    $("#a-reset").disabled = true;
    try { await backend.resetAll(); $("#a-reset-text").value = ""; toast("All red fruits deleted"); } catch { toast("Couldn't reset", true); }
  };

  $("#a-demo").onclick = async () => {
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const names = ["Anna", "Luca", "Mia", "Noah", "Lea", "Elias"], fams = ["Ben", "Clara", "Daniel", "Emma", "Felix", "Hanna"], gives = ["Meier", "Keller", "Huber", "Weber"];
    for (let i = 0; i < 30; i++) {
      const t = pick(game.teams);
      await backend.addFruit({ team: t.id, zone: ZONE_IDS[Math.floor(Math.random() * t.zones.length)], harvester: "Sample " + pick(names), fruit: pick(fams) + " " + pick(gives) });
    }
    toast("Added 30 sample red fruits");
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
