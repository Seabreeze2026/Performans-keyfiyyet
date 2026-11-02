"use strict";
/* ---------- KONFİQURASİYA VƏ MƏLUMAT ---------- */
const API = window.SBP_API || "";
const SECTIONS = [
  { key: "umumi", title: "Ümumi fərdi keyfiyyətlər", short: "Ümumi fərdi", criteria: [
    "Məsuliyyətlilik",
    "Təşəbbüskarlıq və özünü ruhlandırma qabiliyyəti",
    "Şəxsi intizam və məhsuldarlıq",
    "Komandada işləmək qabiliyyəti",
    "Obyektivlik və tərəfkeşsizliyi qoruyub saxlama. Vicdanla yanaşmaq.",
    "Öz bilik və təcrübəsini işinə tətbiq etmək və özünü inkişaf etdirmək bacarığı",
    "İşə pozitiv yanaşma və adaptasiya qabiliyyəti",
    "Effektiv ünsiyyət və münasibət qurma qabiliyyəti" ] },
  { key: "sahe", title: "Sahə üzrə tələb olunan keyfiyyətlər", short: "Sahə üzrə", criteria: [
    "Dəqiqlik, punktuallıq",
    "Dəyişikliklərə uyğunlaşmaq",
    "Etiraz və narazılıqlarla işləmək bacarığı, konfliktləri idarə edə bilmək",
    "Təhlil aparmaq, araşdırmaq və qərar vermək bacarığı, plan, tədqiqat bacarığı",
    "Təbliğ etmək və təsir etmək bacarığı",
    "İnnovasiya bacarığı və kreativlik, təşəbbüskar",
    "Fədakarlıq. Şirkətin mənafeyini şəxsi mənafeyindən üstün tuta bilmə",
    "Obyektivlik və tərəfkeşsizliyi qoruyub saxlama. Vicdanla yanaşmaq." ] },
  { key: "rehber", title: "Rəhbərlik bacarıqları üzrə fərdi keyfiyyətlər", short: "Rəhbərlik", criteria: [
    "Konflikt həll etmək bacarığı",
    "Səlahiyyətlərini vəkalət (ötürmə) etmə",
    "Strateji düşünmə və davranma",
    "Kollektiv daxilində nüfuz və ruhlandırmaq bacarığı",
    "Hədəflərin düzgün müəyyən edilməsi və düzgün iş bölgüsünün aparılması",
    "Liderlik və komanda ilə işləmə bacarığı" ] }
];
const TOTAL_CRIT = SECTIONS.reduce((a, s) => a + s.criteria.length, 0);
let EVS = [], EMPS = [];
const EV = id => EVS.find(e => e.id === id);
const EMP = id => EMPS.find(e => e.id === id);

/* ---------- STATE ---------- */
const S = { ev: null, pin: "", admin: false, hrPin: "", dept: "", unit: "all", emp: null, view: "form", atab: "progress", rdept: "all",
  loginErr: "", hrErr: "", syncMsg: "", confirm: "", rconf: "", showAll: true, det: null, busy: false, loading: true, loadErr: "", syncing: false, hrAt: null };
let PEER = {}, LOC = { ratings: {} }, RAT = {}, APPR = {}, pollT = null;
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const ssGet = k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
const ssSet = (k, v) => { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) {} };
function loadLoc() { try { LOC = JSON.parse(lsGet("sbp3_" + S.ev) || "null") || { ratings: {} }; } catch (e) { LOC = { ratings: {} }; } }
function saveLoc() { lsSet("sbp3_" + S.ev, JSON.stringify(LOC)); }

/* ---------- SERVER ---------- */
async function api(action, payload) {
  if (!API) throw new Error("Server ünvanı təyin olunmayıb (config.js).");
  let r;
  try { r = await fetch(API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(Object.assign({ action }, payload || {})) }); }
  catch (e) { throw new Error("Serverə qoşulmaq mümkün olmadı. İnternet bağlantısını yoxlayın."); }
  let j; try { j = await r.json(); } catch (e) { throw new Error("Serverdən düzgün cavab gəlmədi."); }
  if (!j.ok) throw new Error(j.error || "Xəta baş verdi.");
  return j;
}
async function loadEvs() {
  S.loading = true; S.loadErr = "";
  try {
    if (!API) throw new Error("Server ünvanı təyin olunmayıb (config.js).");
    const r = await fetch(API + "?a=evs"), j = await r.json();
    if (!j.ok) throw new Error(j.error);
    EVS = j.evs.map(a => ({ id: a[0], name: a[1] }));
  } catch (e) { S.loadErr = "Rəhbərlərin siyahısı yüklənmədi. " + (e.message || ""); }
  S.loading = false; render();
}
const flat = s => s.flat();
function unflat(f) { let k = 0; return SECTIONS.map(sec => sec.criteria.map(() => Number(f[k++]))); }

/* ---------- HESABLAMA ---------- */
const avg = a => { const v = a.filter(x => x != null); return v.length ? v.reduce((p, c) => p + c, 0) / v.length : null; };
const blank = () => ({ s: SECTIONS.map(s => s.criteria.map(() => null)), notes: ["", "", ""], done: false });
function rec(id) { if (!LOC.ratings[id]) LOC.ratings[id] = blank(); return LOC.ratings[id]; }
const filled = r => r.s.reduce((a, sec) => a + sec.filter(x => x != null).length, 0);
const secAvgs = r => r.s.map(avg);
const W = [0.4, 0.4, 0.2], EVW = [0.6, 0.4]; // istiqamət çəkiləri: 40/40/20; qiymətləndirən çəkiləri: 60/40
function total(r) { const a = secAvgs(r); return a.some(x => x == null) ? null : a.reduce((t, v, i) => t + v * W[i], 0) * 10; }
const tone = v => v >= 80 ? "good" : v >= 65 ? "mid" : "low";
const fmt = (v, d = 1) => v == null ? "–" : v.toFixed(d).replace(".", ",");
const n1 = v => Number.isInteger(v) ? String(v) : fmt(v);
function band(t) {
  if (t >= 90) return { name: "İdeal işçi", tone: "good" };
  if (t >= 80) return { name: "Yüksək nəticə", tone: "good" };
  if (t >= 70) return { name: "Yaxşı nəticə", tone: "mid" };
  if (t >= 60) return { name: "Qənaətbəxş, inkişaf tələb olunur", tone: "mid" };
  return { name: "Diqqət və dəstək tələb edir", tone: "low" };
}
function recommend(r) {
  const t = total(r), a = secAvgs(r), out = [], b = band(t), weakCrit = [];
  r.s.forEach((sec, i) => sec.forEach((v, j) => { if (v <= 6) weakCrit.push({ text: SECTIONS[i].criteria[j], v }); }));
  if (r.s.every(sec => sec.every(v => v >= 9))) {
    out.push("Bütün istiqamətlər üzrə qiymətlər yüksəkdir (9 və 10). İşçi nümunəvi nəticə göstərir. Təltif, mentorluq rolu və karyera inkişafı üçün namizəd kimi nəzərdən keçirilə bilər.");
    return { band: b, items: out, t, a };
  }
  const order = a.map((v, i) => ({ v, i })).sort((x, y) => x.v - y.v), lowest = order[0], highest = order[order.length - 1];
  const weakSecs = order.filter(o => o.v < 7.5);
  if (weakSecs.length === 0 && lowest.v >= 8) out.push("Nəticələr bütün istiqamətlərdə sabit və yüksəkdir. Mövcud səviyyəni qorumaq və növbəti dövr üçün daha iddialı hədəf qoymaq tövsiyə olunur.");
  weakSecs.forEach(o => {
    const msg = {
      umumi: "Ümumi fərdi keyfiyyətlər artırılmalıdır: məsuliyyət, intizam və komanda davranışı üzrə rəhbərlə mütəmadi geri bildirim görüşləri keçirilməlidir.",
      sahe: "Sahə üzrə tələb olunan bacarıqlar artırılmalıdır: peşə təlimi, təcrübə mübadiləsi və praktiki tapşırıqlarla dəstək planı hazırlanmalıdır.",
      rehber: "Rəhbərlik bacarıqları inkişaf etdirilməlidir: liderlik və səlahiyyət ötürmə üzrə təlim və mentor dəstəyi tövsiyə olunur."
    }[SECTIONS[o.i].key];
    out.push(msg + " (orta: " + fmt(o.v) + "/10)");
  });
  if (weakSecs.length === 0 && lowest.v < 8) out.push(SECTIONS[lowest.i].short + " istiqaməti digərlərindən geri qalır (" + fmt(lowest.v) + "/10). Bu sahədə məqsədli inkişaf tədbiri planlaşdırılsa, ümumi nəticə yüksələ bilər.");
  if (weakCrit.length) out.push("Prioritet meyarlar (6 və aşağı): " + weakCrit.map(w => "«" + w.text.replace(/\.$/, "") + "» (" + n1(w.v) + ")").join("; ") + ".");
  if (highest.v >= 9 && lowest.v < 8) out.push("Güclü tərəf: " + SECTIONS[highest.i].short.toLowerCase() + " istiqaməti (" + fmt(highest.v) + "/10). İnkişaf planında bu üstünlüyə əsaslanmaq olar.");
  if (t < 60) out.push("Yekun bal 60-dan aşağıdır. Fərdi inkişaf planı hazırlanmalı və 3 ay sonra təkrar qiymətləndirmə aparılmalıdır.");
  return { band: b, items: out, t, a };
}
const combine = (list, ws) => { const w = ws || list.map(() => 1); return { s: SECTIONS.map((sec, i) => sec.criteria.map((_, j) => { let t = 0, sw = 0; list.forEach((r, k) => { t += r.s[i][j] * w[k]; sw += w[k]; }); return sw ? t / sw : null; })) }; };
const validR = r => r && r.done && Array.isArray(r.s) && r.s.length === 3 && r.s.every((x, i) => Array.isArray(x) && x.length === SECTIONS[i].criteria.length && x.every(v => Number.isInteger(v) && v >= 1 && v <= 10));

/* ---------- RƏHBƏR: giriş və sinxronlaşma ---------- */
async function doLogin(id, pin, silent) {
  S.busy = true; S.loginErr = ""; render();
  try {
    const j = await api("login", { ev: id, pin });
    S.ev = id; S.pin = pin; S.admin = false;
    EMPS = j.emps.map(a => ({ id: a[0], dept: a[1], unit: a[2], name: a[3], pos: a[4], evs: [id] }));
    loadLoc(); setPeers(j);
    const srv = {}; j.ratings.forEach(r => { srv[r.e] = r; });
    Object.keys(LOC.ratings).forEach(k => { const r = LOC.ratings[k]; if (r.done && r.synced && !srv[k]) LOC.ratings[k] = blank(); });
    Object.keys(srv).forEach(k => { const r = srv[k]; LOC.ratings[k] = { s: unflat(r.s), notes: r.n || ["", "", ""], done: true, synced: true, at: r.at }; });
    saveLoc(); lsSet("sbp3_last", id); ssSet("sbp3_sess", JSON.stringify({ ev: id, pin }));
    S.view = "form"; S.dept = ""; S.unit = "all"; S.emp = null; S.busy = false; render(); syncAll(); return;
  } catch (e) { if (!silent) S.loginErr = e.message; ssSet("sbp3_sess", null); }
  S.busy = false; render();
}
function setPeers(j) { PEER = {}; (j.peers || []).forEach(r => { PEER[r.e] = { s: unflat(r.s), n: r.n, vn: r.vn, at: r.at, done: true }; }); }
async function refreshPeers() { try { setPeers(await api("login", { ev: S.ev, pin: S.pin })); } catch (e) {} }
async function syncAll() {
  if (!S.ev || S.syncing) return;
  const pend = Object.entries(LOC.ratings).filter(([, r]) => validR(r) && !r.synced);
  if (!pend.length) return;
  S.syncing = true; S.syncMsg = ""; if (S.view !== "form") renderSheet();
  for (const [eid, r] of pend) {
    try { const j = await api("save", { ev: S.ev, pin: S.pin, emp: eid, s: flat(r.s), n: r.notes }); r.synced = true; r.at = j.at || r.at; saveLoc(); }
    catch (e) { S.syncMsg = "Mərkəzə göndərmək alınmadı: " + e.message; break; }
  }
  S.syncing = false; if (S.view !== "form") render(); else render_queueOnly();
}
function render_queueOnly() { const q = document.querySelector(".queue"); if (!q) return; const tmp = document.createElement("div"); tmp.innerHTML = queueHTML(); q.replaceWith(tmp.firstElementChild); }
async function doReset(id) {
  const ids = id === "all" ? EMPS.map(e => e.id) : [id];
  ids.forEach(x => { LOC.ratings[x] = blank(); }); saveLoc(); S.confirm = ""; if (id !== "all") S.view = "form";
  render();
  try { await api("reset", { ev: S.ev, pin: S.pin, emp: id }); } catch (e) { S.syncMsg = "Sıfırlama mərkəzə çatmadı: " + e.message; render(); }
}

/* ---------- RENDER (rəhbər) ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const myDepts = () => [...new Set(EMPS.map(e => e.dept))];
function scoped() { return EMPS.filter(e => e.dept === S.dept && (S.unit === "all" || (S.unit === "_none" ? !e.unit : e.unit === S.unit))); }
const curEmp = () => { const l = scoped(); return l.find(e => e.id === S.emp) || l[0]; };
const head = right => '<div class="band"><div class="band-in"><div class="brand"><small>Seabreeze · Performansın idarə edilməsi</small><h1>Keyfiyyətlərin qiymətləndirilməsi</h1></div>' + (right || "") + "</div></div>";
function gauge(t) {
  const R = 62, C = 2 * Math.PI * R, tn = tone(t);
  return '<div class="gauge"><svg viewBox="0 0 150 150"><circle cx="75" cy="75" r="' + R + '" fill="none" stroke="var(--line)" stroke-width="12"/><circle cx="75" cy="75" r="' + R + '" fill="none" stroke="var(--' + tn + ')" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + (C * t / 100).toFixed(1) + " " + C.toFixed(1) + '"/></svg><div class="num"><b>' + fmt(t) + "</b><span>/ 100</span></div></div>";
}
function render() {
  $("dock").hidden = true;
  if (S.admin) return renderAdmin();
  if (!S.ev) return renderLogin();
  const depts = myDepts();
  if (!depts.includes(S.dept)) { S.dept = depts[0]; S.unit = "all"; }
  const units = [...new Set(EMPS.filter(e => e.dept === S.dept).map(e => e.unit).filter(Boolean))];
  const hasNone = EMPS.some(e => e.dept === S.dept && !e.unit);
  const list = scoped();
  if (!list.find(e => e.id === S.emp)) S.emp = list[0] ? list[0].id : null;
  const doneAll = EMPS.filter(e => validR(rec(e.id))).length;
  let h = head('<div class="who-bar"><span>Qiymətləndirən: <span class="nm">' + esc(EV(S.ev) ? EV(S.ev).name : "") + '</span></span><button class="btn small" data-act="mine">Nəticələrim (' + doneAll + "/" + EMPS.length + ')</button><button class="btn small" data-act="logout">Çıxış</button></div>');
  h += '<div class="wrap"><div class="card filters"><div class="field"><label for="f-dept">Departament</label><select id="f-dept">' + depts.map(d => '<option value="' + esc(d) + '"' + (d === S.dept ? " selected" : "") + ">" + esc(d) + "</option>").join("") + "</select></div>";
  if (units.length) h += '<div class="field"><label for="f-unit">Şöbə</label><select id="f-unit"><option value="all">Bütün şöbələr</option>' + units.map(u => '<option value="' + esc(u) + '"' + (u === S.unit ? " selected" : "") + ">" + esc(u) + "</option>").join("") + (hasNone ? '<option value="_none"' + (S.unit === "_none" ? " selected" : "") + ">Şöbəsiz işçilər</option>" : "") + "</select></div>";
  h += '</div><div class="main">' + queueHTML() + '<section class="sheet" id="sheet"></section></div></div>';
  $("app").innerHTML = h; renderSheet();
}
function queueHTML() {
  const list = scoped(), doneN = list.filter(e => validR(rec(e.id))).length, pct = list.length ? Math.round(doneN / list.length * 100) : 0;
  let h = '<aside class="card queue"><div class="queue-head"><div class="row"><span>Qiymətləndirilib</span><b>' + doneN + " / " + list.length + '</b></div><div class="bar"><i style="width:' + pct + '%"></i></div></div><ul class="emp-list">';
  list.forEach(e => {
    const r = rec(e.id), ok = validR(r), t = ok ? total(r) : null, n = filled(r);
    h += '<li><button class="emp" data-emp="' + e.id + '"' + (e.id === S.emp && S.view !== "mine" ? ' aria-current="true"' : "") + '><span class="n">' + esc(e.name) + '</span><span class="p">' + esc(e.pos) + (e.unit && S.unit === "all" ? " · " + esc(e.unit) : "") + '</span><span class="st ' + (ok ? tone(t) : "") + '">' + (ok ? fmt(t, 0) + (r.synced ? "" : " •") : n ? n + "/" + TOTAL_CRIT : "gözləyir") + "</span></button></li>";
  });
  return h + "</ul></aside>";
}
function renderLogin() {
  const sorted = EVS.slice().sort((a, b) => a.name.localeCompare(b.name, "az"));
  let h = head("") + '<div class="wrap">';
  if (S.loading) h += '<div class="card login"><p style="margin:0">Yüklənir…</p></div>';
  else {
    h += '<form class="card login" id="loginForm"><h2>Daxil olun</h2><p class="hint" style="margin:0">Adınızı seçin və sizə verilmiş 4 rəqəmli PIN kodu yazın. Yalnız sizə təyin olunmuş işçilər göstəriləcək.</p>' +
      (S.loadErr ? '<div class="err" role="alert">' + esc(S.loadErr) + "</div>" : "") +
      '<div class="field"><label for="sel-ev">Qiymətləndirən</label><select id="sel-ev"><option value="">Adınızı seçin</option>' + sorted.map(e => '<option value="' + e.id + '"' + (lsGet("sbp3_last") === e.id ? " selected" : "") + ">" + esc(e.name) + "</option>").join("") + "</select></div>" +
      '<div class="field"><label for="pin">PIN kod</label><input id="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="4" placeholder="••••"></div>' +
      (S.loginErr ? '<div class="err" role="alert">' + esc(S.loginErr) + "</div>" : "") +
      '<button class="btn primary block" type="submit"' + (S.busy ? " disabled" : "") + ">" + (S.busy ? "Yoxlanılır…" : "Daxil ol") + "</button></form>" +
      '<form class="card login" id="hrForm" style="margin-top:14px"><h2 style="font-size:17px">İdarə paneli (HR)</h2><div class="field"><label for="hrpin">HR PIN</label><input id="hrpin" type="password" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="••••••"></div>' +
      (S.hrErr ? '<div class="err" role="alert">' + esc(S.hrErr) + "</div>" : "") +
      '<button class="btn block" type="submit"' + (S.busy ? " disabled" : "") + ">Panelə daxil ol</button></form>";
  }
  $("app").innerHTML = h + "</div>";
}
function renderSheet() {
  const el = $("sheet"), dock = $("dock"); if (!el) return;
  if (S.view === "mine") { dock.hidden = true; el.innerHTML = mineHTML(); return; }
  const e = curEmp();
  if (!e) { dock.hidden = true; el.innerHTML = '<div class="card empty">Seçilmiş bölmədə işçi yoxdur.</div>'; return; }
  const r = rec(e.id);
  if (S.view === "result" && !validR(r)) S.view = "form";
  if (S.view === "result") { dock.hidden = true; el.innerHTML = resultHTML(e, r); return; }
  let h = '<div class="card who"><h2>' + esc(e.name) + "</h2>" + cell("Vəzifə", e.pos) + cell("Struktur bölmə", e.dept + (e.unit ? " · " + e.unit : "")) + (filled(r) ? resetCtl(e.id, "Bu işçinin qiymətlərini sıfırla") : "") + "</div>";
  SECTIONS.forEach((s, i) => {
    h += '<div class="card sx s' + i + '"><div class="sec-head"><h3>' + esc(s.title) + '</h3><span class="sec-avg" data-avg="' + i + '">Orta: ' + fmt(avg(r.s[i])) + "</span></div>";
    s.criteria.forEach((c, j) => {
      h += '<div class="crit"><div class="t">' + esc(c) + '</div><fieldset class="scale"><legend>' + esc(c) + " (10 üzərindən)</legend>";
      for (let v = 1; v <= 10; v++) { const id = "r" + i + "-" + j + "-" + v; h += '<input type="radio" name="r' + i + "-" + j + '" id="' + id + '" data-s="' + i + '" data-c="' + j + '" value="' + v + '"' + (r.s[i][j] === v ? " checked" : "") + '><label for="' + id + '">' + v + "</label>"; }
      h += "</fieldset></div>";
    });
    h += '<div class="note"><div class="field"><label for="n' + i + '">Əlavə varsa qeyd edin</label><textarea id="n' + i + '" data-note="' + i + '">' + esc(r.notes[i]) + "</textarea></div></div></div>";
  });
  el.innerHTML = h; updateDock();
}
const cell = (k, v) => "<dl><dt>" + esc(k) + "</dt><dd>" + esc(v) + "</dd></dl>";
function resetCtl(id, label) {
  if (S.confirm === id) return '<div class="resetbar"><span>' + (id === "all" ? "Bütün qiymətləriniz silinəcək." : "Bu işçinin qiymətləri silinəcək.") + '</span><button class="btn warn primary small" data-act="reset-yes" data-id="' + id + '">Bəli, sıfırla</button><button class="btn small" data-act="reset-no">Ləğv et</button></div>';
  return '<div class="resetbar"><button class="btn small warn" data-act="reset-ask" data-id="' + id + '">' + label + "</button></div>";
}
function updateDock() {
  const e = curEmp(); if (!e || S.view !== "form") return;
  const r = rec(e.id), n = filled(r), list = scoped(), last = list.findIndex(x => x.id === e.id) === list.length - 1;
  const a = secAvgs(r), t = a.every(x => x != null) ? total(r) : null, dock = $("dock");
  dock.hidden = false;
  dock.innerHTML = '<div class="dock-in"><div class="live"><span>Dolduruldu <b>' + n + " / " + TOTAL_CRIT + "</b></span><span>Cari bal <b>" + (t == null ? "–" : fmt(t)) + '</b> / 100</span></div><button class="btn primary" data-act="' + (n < TOTAL_CRIT ? "gap" : "save") + '">' + (n < TOTAL_CRIT ? "Boş qalan meyara keç (" + (TOTAL_CRIT - n) + ")" : last ? "Saxla və nəticəyə bax" : "Saxla və növbəti işçiyə keç") + "</button></div>";
  SECTIONS.forEach((s, i) => { const x = document.querySelector('[data-avg="' + i + '"]'); if (x) x.textContent = "Orta: " + fmt(a[i]); });
}
function resultBlock(r) {
  const x = recommend(r);
  let h = '<div class="card result">' + gauge(x.t) + '<div class="result-body"><div><span class="verdict ' + x.band.tone + '">' + esc(x.band.name) + '</span></div><div class="secbars">';
  SECTIONS.forEach((s, i) => { h += '<div class="r s' + i + '"><span>' + esc(s.title) + "</span><b>" + fmt(x.a[i]) + '</b><div class="bar"><i style="width:' + x.a[i] * 10 + '%"></i></div></div>'; });
  return h + '</div></div></div><div class="card"><div class="sec-head"><h3>Tövsiyələr</h3></div><div class="pad"><ul class="recs">' + x.items.map(i => "<li>" + esc(i) + "</li>").join("") + "</ul></div></div>";
}
function syncBadge(r) {
  if (r.synced) return '<span class="verdict good" style="align-self:flex-start">Mərkəzə göndərilib</span>';
  return '<span class="verdict mid" style="align-self:flex-start">' + (S.syncing ? "Göndərilir…" : "Hələ göndərilməyib") + "</span>" + (S.syncing ? "" : ' <button class="btn small" data-act="resync">Yenidən göndər</button>') + (S.syncMsg ? '<div class="err">' + esc(S.syncMsg) + "</div>" : "");
}
function resultHTML(e, r) {
  const list = scoped(), next = list.slice(list.findIndex(y => y.id === e.id) + 1).find(y => !validR(rec(y.id))) || list.find(y => !validR(rec(y.id)));
  let h = '<div class="card who"><h2>' + esc(e.name) + "</h2>" + cell("Vəzifə", e.pos) + cell("Struktur bölmə", e.dept + (e.unit ? " · " + e.unit : "")) + '<div class="resetbar">' + syncBadge(r) + "</div></div>" + resultBlock(r);
  r.notes.forEach((n, i) => { if (n && n.trim()) h += '<div class="card pad"><div class="hint">' + esc(SECTIONS[i].short) + " üzrə qeyd</div>" + esc(n) + "</div>"; });
  return h + peerCard(e) + '<div class="actions"><button class="btn" data-act="edit">Qiymətləri düzəlt</button>' + (next ? '<button class="btn primary" data-act="next" data-to="' + next.id + '">Növbəti işçi: ' + esc(next.name) + "</button>" : '<button class="btn primary" data-act="mine">Bütün nəticələrim</button>') + "</div>" + resetCtl(e.id, "Bu işçinin qiymətlərini sıfırla");
}
function peerCard(e) {
  const p = PEER[e.id]; if (!p || !validR(p)) return "";
  let h = '<div class="card"><div class="sec-head"><h3>Qiymətləndirən 2-nin qiymətləndirməsi</h3></div><div class="pad"><div class="hint">' + esc(p.vn) + '</div><div class="secbars">';
  SECTIONS.forEach((sec, i) => { const a = avg(p.s[i]); h += '<div class="r s' + i + '"><span>' + esc(sec.title) + "</span><b>" + fmt(a) + '</b><div class="bar"><i style="width:' + a * 10 + '%"></i></div></div>'; });
  h += "</div><p><b>Bal: " + fmt(total(p)) + " / 100</b></p>";
  p.n.forEach((t, i) => { if (t && String(t).trim()) h += '<div class="hint">' + esc(SECTIONS[i].short) + " üzrə qeyd</div>" + esc(t); });
  return h + "</div></div>";
}
function mineHTML() {
  const done = EMPS.filter(e => validR(rec(e.id))), synced = done.filter(e => rec(e.id).synced).length;
  let h = '<div class="card pad"><h3>Mərkəzə göndərmə</h3><p style="margin:0">Tamamlanıb: <b>' + done.length + " / " + EMPS.length + "</b>. Mərkəzə çatıb: <b>" + synced + "</b>.</p>";
  if (done.length && synced < done.length) h += '<div class="actions"><button class="btn primary" data-act="resync"' + (S.syncing ? " disabled" : "") + ">" + (S.syncing ? "Göndərilir…" : "Mərkəzə göndər") + "</button></div>" + (S.syncMsg ? '<div class="err">' + esc(S.syncMsg) + "</div>" : "");
  else if (done.length) h += '<span class="verdict good" style="align-self:flex-start">Bütün nəticələr mərkəzə çatıb</span>';
  else h += '<p class="hint" style="margin:0">Hələ heç bir işçi qiymətləndirilməyib.</p>';
  h += (done.length ? resetCtl("all", "Bütün qiymətlərimi sıfırla") : "") + '</div><div class="card tablebox"><table><thead><tr><th>İşçi</th><th>Struktur bölmə</th>' + SECTIONS.map(s => '<th class="num">' + esc(s.short) + "</th>").join("") + '<th class="num">Bal / 100</th>' + (Object.keys(PEER).length ? '<th class="num">Qiymətləndirən 2-nin balı</th>' : "") + "</tr></thead><tbody>";
  EMPS.forEach(e => {
    const r = rec(e.id);
    if (!validR(r)) { h += '<tr><td><a href="#" data-emp="' + e.id + '" data-go="1">' + esc(e.name) + "</a></td><td>" + esc(e.unit || e.dept) + '</td><td colspan="4" class="hint">Qiymətləndirilməyib</td>' + (Object.keys(PEER).length ? '<td class="num">' + (PEER[e.id] ? fmt(total(PEER[e.id])) + '<div class="hint">' + esc(PEER[e.id].vn) + "</div>" : "–") + "</td>" : "") + "</tr>"; return; }
    h += "<tr><td>" + esc(e.name) + "</td><td>" + esc(e.unit || e.dept) + "</td>" + secAvgs(r).map(v => '<td class="num">' + fmt(v) + "</td>").join("") + '<td class="num"><b>' + fmt(total(r)) + "</b></td>" + (Object.keys(PEER).length ? '<td class="num">' + (PEER[e.id] ? fmt(total(PEER[e.id])) + '<div class="hint">' + esc(PEER[e.id].vn) + "</div>" : "–") + "</td>" : "") + "</tr>";
  });
  return h + "</tbody></table></div>";
}

/* ---------- HR PANELİ ---------- */
async function loadHr(pin) {
  const j = await api("hr_data", { pin: pin || S.hrPin });
  EVS = j.evs.map(a => ({ id: a[0], name: a[1] }));
  EMPS = j.emps.map(a => ({ id: a[0], dept: a[1], unit: a[2], name: a[3], pos: a[4], evs: [a[5], a[6]].filter(Boolean) }));
  RAT = {}; j.ratings.forEach(r => { RAT[r.e + "__" + r.v] = { e: r.e, v: r.v, s: unflat(r.s), n: r.n, at: r.at, done: true }; });
  APPR = {}; Object.keys(j.approvals).forEach(k => { APPR[k] = { at: j.approvals[k] }; });
  S.hrAt = new Date();
}
async function hrLogin(pin, silent) {
  S.busy = true; S.hrErr = ""; render();
  try { await loadHr(pin); S.admin = true; S.hrPin = pin; ssSet("sbp3_hr", pin); startPoll(); }
  catch (e) { if (!silent) S.hrErr = e.message; ssSet("sbp3_hr", null); }
  S.busy = false; render();
}
function startPoll() { clearInterval(pollT); pollT = setInterval(async () => { if (!S.admin || document.hidden) return; try { await loadHr(); refreshAdmin(); } catch (e) {} }, 20000); }
const evAll = v => EMPS.filter(e => e.evs.includes(v));
const evLast = v => evAll(v).map(e => RAT[e.id + "__" + v]).filter(Boolean).map(r => String(r.at || "")).sort().pop() || "";
function evStatus(v) {
  const n = evAll(v).length, d = evAll(v).filter(e => validR(RAT[e.id + "__" + v])).length;
  if (!d) return "none";
  if (d < n) return "going";
  return APPR[v] && String(APPR[v].at) >= evLast(v) ? "approved" : "pending";
}
function stats() {
  return EMPS.map(e => {
    const all = e.evs.filter(v => validR(RAT[e.id + "__" + v])), use = all.filter(v => S.showAll || evStatus(v) === "approved");
    return { e, all, rs: use.map(v => RAT[e.id + "__" + v]), ws: use.map(v => e.evs.length > 1 ? EVW[e.evs.indexOf(v)] : 1), n: e.evs.length, dAll: all.length, d: use.length };
  });
}
const pendingCount = () => EVS.filter(v => evStatus(v.id) === "pending").length;
const tabLabel = () => "Prosesin gedişi" + (pendingCount() ? " · təsdiq gözləyir (" + pendingCount() + ")" : "");
function renderAdmin() {
  let h = head('<div class="who-bar"><span class="nm">İdarə paneli</span><span class="hint" id="hrAt"></span><button class="btn small" data-act="hr-refresh">Yenilə</button><button class="btn small" data-act="logout">Çıxış</button></div>');
  h += '<div class="wrap"><div class="tabs" role="tablist">' + [["progress", tabLabel()], ["results", "Nəticələr"]].map(t => '<button class="tab" role="tab" aria-selected="' + (S.atab === t[0]) + '" data-atab="' + t[0] + '">' + t[1] + "</button>").join("") + '</div><div id="adminBody"></div></div>';
  $("app").innerHTML = h; adminBody();
}
function refreshAdmin() {
  if (!S.admin) return;
  const tb = document.querySelector('[data-atab="progress"]'); if (tb) tb.textContent = tabLabel();
  const at = $("hrAt"); if (at && S.hrAt) at.textContent = "Yenilənib: " + S.hrAt.toLocaleTimeString("az-AZ", { hour: "2-digit", minute: "2-digit" });
  adminBody();
}
function stBadge(s) { return { none: '<span class="hint">başlamayıb</span>', going: '<span class="verdict mid">davam edir</span>', pending: '<span class="verdict low">təsdiq gözləyir</span>', approved: '<span class="verdict good">təsdiqlənib</span>' }[s]; }
function adminBody() {
  const el = $("adminBody"); if (!el) return;
  const at = $("hrAt"); if (at && S.hrAt) at.textContent = "Yenilənib: " + S.hrAt.toLocaleTimeString("az-AZ", { hour: "2-digit", minute: "2-digit" });
  const per = stats();
  if (S.atab === "results") { el.innerHTML = resultsHTML(per); return; }
  const expected = per.reduce((a, p) => a + p.n, 0), done = per.reduce((a, p) => a + p.dAll, 0);
  const full = per.filter(p => p.dAll === p.n).length, part = per.filter(p => p.dAll > 0 && p.dAll < p.n).length;
  const pend = EVS.filter(v => evStatus(v.id) === "pending");
  let h = (pend.length ? '<div class="card pad"><h3>Təsdiq gözləyir (' + pend.length + ')</h3><p class="hint" style="margin:0">Bu rəhbərlər bütün işçiləri qiymətləndirib. Təsdiqlədikdən sonra nəticələri yekun cədvələ daxil olur.</p>' + pend.map(v => '<div class="actions"><b style="flex:1;min-width:200px">' + esc(v.name) + '</b><span class="hint">' + evAll(v.id).length + ' işçi</span><button class="btn primary small" data-appr="' + v.id + '">Təsdiqlə</button></div>').join("") + "</div>" : "") +
    '<div class="kpis"><div class="card kpi"><b>' + (expected ? Math.round(done / expected * 100) : 0) + "%</b><span>Ümumi irəliləyiş (" + done + " / " + expected + " qiymətləndirmə)</span></div>" +
    '<div class="card kpi"><b>' + full + " / " + EMPS.length + "</b><span>Tam qiymətləndirilmiş işçi</span></div>" +
    '<div class="card kpi"><b>' + part + "</b><span>Yarımçıq (bir qiymətləndirən qalıb)</span></div>" +
    '<div class="card kpi"><b>' + (EMPS.length - full - part) + "</b><span>Heç qiymətləndirilməyib</span></div></div>";
  const evRows = EVS.map(v => { const mine = evAll(v.id), d = mine.filter(e => validR(RAT[e.id + "__" + v.id])).length; return { v, n: mine.length, d, last: evLast(v.id), depts: [...new Set(mine.map(e => e.dept))] }; }).filter(r => r.n).sort((a, b) => a.d / a.n - b.d / b.n);
  h += '<div class="card"><div class="sec-head"><h3>Qiymətləndirənlər üzrə</h3></div><div class="tablebox"><table><thead><tr><th>Qiymətləndirən</th><th>Departament</th><th class="num">Təyin olunub</th><th class="num">Tamamlayıb</th><th>İrəliləyiş</th><th>Status</th><th>Son fəaliyyət</th><th></th></tr></thead><tbody>' +
    evRows.map(r => "<tr><td>" + esc(r.v.name) + "</td><td>" + esc(r.depts.join(", ")) + '</td><td class="num">' + r.n + '</td><td class="num">' + r.d + '</td><td><div class="mini"><div class="bar"><i style="width:' + Math.round(r.d / r.n * 100) + '%"></i></div><b>' + Math.round(r.d / r.n * 100) + "%</b></div></td><td>" + stBadge(evStatus(r.v.id)) + "</td><td>" + (r.last ? esc(new Date(r.last).toLocaleString("az-AZ", { dateStyle: "short", timeStyle: "short" })) : '<span class="hint">başlamayıb</span>') + "</td><td>" +
      (r.d ? (S.rconf === r.v.id ? '<span class="hint">Bütün qiymətləri silinsin?</span> <button class="btn warn primary small" data-ryes="' + r.v.id + '">Bəli</button> <button class="btn small" data-rno="1">Yox</button>' : '<button class="btn small warn" data-rask="' + r.v.id + '">Sıfırla</button>') : "") + "</td></tr>").join("") + "</tbody></table></div></div>";
  const depts = [...new Set(EMPS.map(e => e.dept))];
  h += '<div class="card"><div class="sec-head"><h3>Departamentlər üzrə</h3></div><div class="tablebox"><table><thead><tr><th>Departament</th><th class="num">İşçi</th><th class="num">Tam</th><th class="num">Yarımçıq</th><th>İrəliləyiş</th></tr></thead><tbody>' +
    depts.map(d => { const p = per.filter(x => x.e.dept === d), f = p.filter(x => x.dAll === x.n).length, y = p.filter(x => x.dAll > 0 && x.dAll < x.n).length, ex = p.reduce((a, x) => a + x.n, 0), dn = p.reduce((a, x) => a + x.dAll, 0);
      return "<tr><td>" + esc(d) + '</td><td class="num">' + p.length + '</td><td class="num">' + f + '</td><td class="num">' + y + '</td><td><div class="mini"><div class="bar"><i style="width:' + Math.round(dn / ex * 100) + '%"></i></div><b>' + Math.round(dn / ex * 100) + "%</b></div></td></tr>"; }).join("") + "</tbody></table></div></div>";
  el.innerHTML = h;
}
function finalOf(p) { if (!p.rs.length) return null; const c = combine(p.rs, p.ws); return { c, t: total(c), x: recommend(c) }; }
function resultsHTML(per) {
  const depts = [...new Set(EMPS.map(e => e.dept))], rows = per.filter(p => S.rdept === "all" || p.e.dept === S.rdept);
  let h = '<div class="actions"><div class="field" style="min-width:260px"><label for="r-dept">Departament</label><select id="r-dept"><option value="all">Hamısı</option>' + depts.map(d => '<option value="' + esc(d) + '"' + (d === S.rdept ? " selected" : "") + ">" + esc(d) + "</option>").join("") + '</select></div><label style="display:flex;gap:8px;align-items:center;align-self:flex-end"><input type="checkbox" id="r-all"' + (S.showAll ? " checked" : "") + '> Təsdiqlənməmiş qiymətləri də göstər</label><button class="btn primary" data-act="csv" style="align-self:flex-end">Excel üçün yüklə (CSV)</button></div>';
  h += '<div class="card tablebox"><table><thead><tr><th>İşçi</th><th>Struktur bölmə</th><th class="num">1-ci qiymətləndirən</th><th class="num">2-ci qiymətləndirən</th><th class="num">Yekun bal</th><th>Nəticə</th><th></th></tr></thead><tbody>';
  rows.forEach(p => {
    const sc = p.e.evs.map(v => { const r = RAT[p.e.id + "__" + v]; return validR(r) ? (S.showAll || evStatus(v) === "approved" ? fmt(total(r)) : '<span class="hint">təsdiq gözlənir</span>') : "–"; });
    const f = finalOf(p);
    h += "<tr><td>" + esc(p.e.name) + '<div class="hint">' + esc(p.e.pos) + "</div></td><td>" + esc(p.e.unit || p.e.dept) + '</td><td class="num">' + sc[0] + '</td><td class="num">' + (p.e.evs.length > 1 ? sc[1] : '<span class="hint">yoxdur</span>') + '</td><td class="num"><b>' + (f ? fmt(f.t) : "–") + "</b>" + (f && p.d < p.n ? '<div class="hint">' + p.d + "/" + p.n + "</div>" : "") + "</td><td>" + (f ? '<span class="verdict ' + f.x.band.tone + '">' + esc(f.x.band.name) + "</span>" : '<span class="hint">gözlənilir</span>') + "</td><td>" + (f ? '<button class="btn small" data-det="' + p.e.id + '">' + (S.det === p.e.id ? "Bağla" : "Bax") + "</button>" : "") + "</td></tr>";
    if (f && S.det === p.e.id) h += '<tr><td colspan="7" style="background:var(--bg,#f6f8fb)">' + detailHTML(p, f) + "</td></tr>";
  });
  return h + "</tbody></table></div>";
}
function detailHTML(p, f) {
  const cols = p.e.evs.map((v, k) => { const r = RAT[p.e.id + "__" + v]; return { v, r, ok: !!r && p.rs.includes(r), w: p.e.evs.length > 1 ? EVW[k] : 1 }; });
  const nm = c => esc(EV(c.v).name) + '<div class="hint">çəki ' + Math.round(c.w * 100) + "%</div>";
  let h = '<div class="pad"><b>' + esc(p.e.name) + "</b> · " + esc(p.e.pos) + '<div class="hint">İstiqamət çəkiləri: ' + SECTIONS.map((s, i) => esc(s.short) + " " + Math.round(W[i] * 100) + "%").join(", ") + (p.d < p.n ? ". Diqqət: bütün qiymətləndirənlər tamamlamayıb, bal müvəqqətidir." : "") + "</div></div>";
  h += '<div class="tablebox"><table><thead><tr><th>Meyar</th>' + cols.map(c => '<th class="num">' + nm(c) + "</th>").join("") + '<th class="num">Yekun</th></tr></thead><tbody>';
  SECTIONS.forEach((sec, i) => {
    h += '<tr class="s' + i + '"><td colspan="' + (cols.length + 2) + '"><b>' + esc(sec.title) + " (" + Math.round(W[i] * 100) + "%)</b></td></tr>";
    sec.criteria.forEach((cr, j) => { h += "<tr><td>" + esc(cr) + "</td>" + cols.map(c => '<td class="num">' + (c.ok ? c.r.s[i][j] : "–") + "</td>").join("") + '<td class="num"><b>' + fmt(f.c.s[i][j]) + "</b></td></tr>"; });
    h += '<tr><td><i>Orta</i></td>' + cols.map(c => '<td class="num">' + (c.ok ? fmt(avg(c.r.s[i])) : "–") + "</td>").join("") + '<td class="num"><b>' + fmt(avg(f.c.s[i])) + "</b></td></tr>";
  });
  h += '<tr><td><b>Bal / 100</b></td>' + cols.map(c => '<td class="num"><b>' + (c.ok ? fmt(total(c.r)) : "–") + "</b></td>").join("") + '<td class="num"><b>' + fmt(f.t) + "</b></td></tr></tbody></table></div>";
  const notes = [];
  cols.forEach(c => { if (c.ok && c.r.n) c.r.n.forEach((t, i) => { if (t && String(t).trim()) notes.push("<li><b>" + esc(EV(c.v).name) + "</b> · " + esc(SECTIONS[i].short) + ": " + esc(t) + "</li>"); }); });
  if (notes.length) h += '<div class="pad"><b>Qeydlər</b><ul class="recs">' + notes.join("") + "</ul></div>";
  h += '<div class="pad"><b>Tövsiyələr</b><ul class="recs">' + f.x.items.map(t => "<li>" + esc(t) + "</li>").join("") + "</ul></div>";
  return h;
}
function exportCSV() {
  const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"', hd = ["Departament", "Şöbə", "İşçi", "Vəzifə", "1-ci qiymətləndirən", "1-ci bal", "2-ci qiymətləndirən", "2-ci bal"];
  SECTIONS.forEach(s => hd.push(s.short + " orta")); hd.push("Yekun bal (100)", "Nəticə", "Tövsiyələr");
  const rows = [hd.map(q).join(";")];
  stats().forEach(p => {
    const f = finalOf(p), sc = p.e.evs.map(v => { const r = RAT[p.e.id + "__" + v]; return validR(r) && (S.showAll || evStatus(v) === "approved") ? fmt(total(r), 2) : ""; });
    rows.push([p.e.dept, p.e.unit, p.e.name, p.e.pos, p.e.evs[0] ? EV(p.e.evs[0]).name : "", sc[0] || "", p.e.evs[1] ? EV(p.e.evs[1]).name : "", sc[1] || ""].concat(f ? f.x.a.map(v => fmt(v, 2)) : ["", "", ""], f ? [fmt(f.t, 1), f.x.band.name, f.x.items.join(" ")] : ["", "", ""]).map(q).join(";"));
  });
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + rows.join("\r\n")], { type: "text/csv;charset=utf-8" })); a.download = "performans-yekun.csv"; document.body.appendChild(a); a.click(); a.remove();
}
async function hrAct(action, ev) { try { await api(action, { pin: S.hrPin, ev }); await loadHr(); } catch (e) { alert(e.message); } S.rconf = ""; refreshAdmin(); }

/* ---------- HADİSƏLƏR ---------- */
document.addEventListener("submit", ev => {
  ev.preventDefault();
  if (ev.target.id === "hrForm") return hrLogin($("hrpin").value.trim());
  if (ev.target.id !== "loginForm") return;
  const id = $("sel-ev").value; if (id) lsSet("sbp3_last", id);
  if (!id) { S.loginErr = "Adınızı siyahıdan seçin."; return render(); }
  doLogin(id, $("pin").value.trim());
});
document.addEventListener("change", ev => {
  const t = ev.target;
  if (t.id === "f-dept") { S.dept = t.value; S.unit = "all"; S.emp = null; S.view = "form"; render(); }
  else if (t.id === "f-unit") { S.unit = t.value; S.emp = null; S.view = "form"; render(); }
  else if (t.id === "r-all") { S.showAll = t.checked; adminBody(); }
  else if (t.id === "r-dept") { S.rdept = t.value; adminBody(); }
  else if (t.type === "radio" && t.dataset.s != null) { const r = rec(curEmp().id); r.s[+t.dataset.s][+t.dataset.c] = +t.value; r.done = false; r.synced = false; saveLoc(); updateDock(); }
});
document.addEventListener("input", ev => { const t = ev.target; if (t.dataset && t.dataset.note != null) { rec(curEmp().id).notes[+t.dataset.note] = t.value; saveLoc(); } });
document.addEventListener("click", async ev => {
  const b = ev.target.closest("button, a[data-go]"); if (!b) return;
  const act = b.dataset.act;
  if (b.dataset.go) ev.preventDefault();
  if (b.dataset.det) { S.det = S.det === b.dataset.det ? null : b.dataset.det; return adminBody(); }
  if (b.dataset.rask) { S.rconf = b.dataset.rask; adminBody(); }
  else if (b.dataset.ryes) hrAct("hr_reset", b.dataset.ryes);
  else if (b.dataset.rno) { S.rconf = ""; adminBody(); }
  else if (b.dataset.appr) hrAct("hr_approve", b.dataset.appr);
  else if (b.dataset.atab) { S.atab = b.dataset.atab; renderAdmin(); }
  else if (act === "hr-refresh") { try { await loadHr(); } catch (e) {} refreshAdmin(); }
  else if (act === "reset-ask") { S.confirm = b.dataset.id; renderSheet(); }
  else if (act === "reset-no") { S.confirm = ""; renderSheet(); }
  else if (act === "reset-yes") doReset(b.dataset.id);
  else if (b.dataset.emp) { const e = EMP(b.dataset.emp); S.dept = e.dept; S.unit = "all"; S.emp = e.id; S.view = validR(rec(e.id)) ? "result" : "form"; render(); window.scrollTo({ top: 0 }); }
  else if (act === "gap") { const r = rec(curEmp().id); for (let i = 0; i < r.s.length; i++) for (let j = 0; j < r.s[i].length; j++) if (r.s[i][j] == null) { const c = document.querySelector('input[name="r' + i + "-" + j + '"]').closest(".crit"); document.querySelectorAll(".crit.gap").forEach(x => x.classList.remove("gap")); c.classList.add("gap"); c.scrollIntoView({ behavior: "smooth", block: "center" }); return; } }
  else if (act === "save") { setTimeout(() => refreshPeers().then(() => { if (S.view === "result") renderSheet(); }), 1500); const r = rec(curEmp().id); r.done = true; r.synced = false; r.at = new Date().toISOString(); saveLoc(); S.view = "result"; render(); window.scrollTo({ top: 0, behavior: "smooth" }); syncAll(); }
  else if (act === "edit") { S.view = "form"; render(); }
  else if (act === "next") { S.emp = b.dataset.to; S.view = "form"; render(); window.scrollTo({ top: 0 }); }
  else if (act === "mine") { S.view = "mine"; render(); refreshPeers().then(() => { if (S.view === "mine") renderSheet(); }); window.scrollTo({ top: 0 }); }
  else if (act === "resync") { S.syncMsg = ""; syncAll(); }
  else if (act === "logout") { S.ev = null; S.pin = ""; S.admin = false; S.hrPin = ""; clearInterval(pollT); ssSet("sbp3_sess", null); ssSet("sbp3_hr", null); EMPS = []; RAT = {}; APPR = {}; render(); loadEvs(); }
  else if (act === "csv") exportCSV();
});

/* ---------- BAŞLANĞIC ---------- */
(async function () {
  render();
  await loadEvs();
  const hr = ssGet("sbp3_hr"), sess = ssGet("sbp3_sess");
  if (hr) return hrLogin(hr, true);
  if (sess) { try { const o = JSON.parse(sess); if (o && o.ev) doLogin(o.ev, o.pin, true); } catch (e) {} }
})();
