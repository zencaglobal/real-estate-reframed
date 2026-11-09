/* ============================================================
   Property Decision Worksheet — interface
   Vanilla JS, no dependencies, no build step.
   One worksheet object drives every chapter and the summary.
   ============================================================ */

(function () {
  "use strict";

  const W = window.WSContent, K = window.WSCalc, H = window.WSHandoff;
  const app = document.getElementById("app");
  const STORE = "zenca.worksheet.v1";

  /* ---------- Utilities ------------------------------------------- */

  const esc = (s) => String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uid = () => "w" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const isBlank = (v) => v === null || v === undefined || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length);
  const val = (fnOrV, c) => (typeof fnOrV === "function" ? fnOrV(c) : fnOrV);

  function get(obj, path) { return path.split(".").reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj); }
  function set(obj, path, v) {
    const ks = path.split(".");
    let o = obj;
    ks.slice(0, -1).forEach((k) => { if (o[k] === undefined || o[k] === null || typeof o[k] !== "object") o[k] = {}; o = o[k]; });
    o[ks[ks.length - 1]] = v;
  }

  function parseMoney(s) {
    if (s === null || s === undefined) return "";
    s = String(s).trim().toLowerCase().replace(/[₹$€£¥,\s]/g, "").replace(/^(inr|usd|rs\.?)/, "");
    if (!s) return "";
    const m = s.match(/^(-?\d*\.?\d+)(cr|crore|crores|l|lac|lakh|lakhs|k|m|mn|b|bn)?$/);
    if (!m) return NaN;
    const mult = { cr: 1e7, crore: 1e7, crores: 1e7, l: 1e5, lac: 1e5, lakh: 1e5, lakhs: 1e5, k: 1e3, m: 1e6, mn: 1e6, b: 1e9, bn: 1e9 }[m[2]] || 1;
    return Math.round(parseFloat(m[1]) * mult);
  }

  const SYM = { INR: "₹", USD: "$", GBP: "£", EUR: "€", AED: "AED ", SGD: "S$", AUD: "A$", CAD: "C$", JPY: "¥", CNY: "CN¥" };
  const LOCALE = { INR: "en-IN", JPY: "ja-JP", CNY: "zh-CN", GBP: "en-GB", EUR: "en-IE" };
  const ccy = (c) => ((c && c.market) || {}).currency || "INR";
  const tidy = (x, d) => { const s = x.toFixed(d); return d ? s.replace(/\.?0+$/, "") : s; };

  function money(v, c, opts) {
    if (v === null || v === undefined || v === "" || isNaN(+v)) return "—";
    v = +v;
    const cur = ccy(c), sym = SYM[cur] || "", a = Math.abs(v), sg = v < 0 ? "−" : "";
    if (!(opts && opts.full)) {
      if (cur === "INR") {
        if (a >= 1e7) return sg + sym + tidy(a / 1e7, 2) + " Cr";
        if (a >= 1e5) return sg + sym + tidy(a / 1e5, 2) + " L";
      } else {
        if (a >= 1e9) return sg + sym + tidy(a / 1e9, 2) + "B";
        if (a >= 1e6) return sg + sym + tidy(a / 1e6, 2) + "M";
        if (a >= 1e5) return sg + sym + tidy(a / 1e3, 0) + "K";
      }
    }
    return sg + sym + Math.round(a).toLocaleString(LOCALE[cur] || "en-US");
  }
  const grouped = (v, c) => (v === "" || v === null || v === undefined || isNaN(+v) ? "" : (+v).toLocaleString(LOCALE[ccy(c)] || "en-US"));
  const pct = (x, d) => (x === null || x === undefined || isNaN(x) ? "—" : tidy(x * 100, d === undefined ? 1 : d) + "%");
  const optLabel = (opts, v) => { const o = (opts || []).find((x) => x[0] === v); return o ? o[1] : ""; };
  const today = () => new Date().toISOString().slice(0, 10);

  /* ---------- State ----------------------------------------------- */

  let state = load();
  function load() {
    try { const s = JSON.parse(localStorage.getItem(STORE)); if (s && s.cases) return s; } catch (e) { /* storage unavailable */ }
    return { cases: {}, current: null };
  }
  let saveT = null;
  function save() {
    const c = cur();
    if (c) c.meta.updated = new Date().toISOString();
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* ignore */ } }, 200);
  }
  const cur = () => state.cases[state.current];

  function blank() {
    return {
      meta: { name: "", created: new Date().toISOString(), date: today(), people: "", source: "worksheet", version: 1 },
      decision: {}, market: { country: "IN", currency: "INR", signals: {}, system: {} },
      property: { components: [], return_engine: [], comps: [{}, {}] }, uc: {},
      financing: {}, household: { options_lost: [] }, constraints: {},
      life: { zat_why: [], premium_buys: [], premium_costs: [], alt_compare: {} },
      dependency: {}, stress: {}, walkaway: ["", "", ""],
      water: {}, access: {}, thesis: {}, destinations: [{}, {}, {}],
      close: { profile: {}, open: [], gates: {} }, unknown: {},
    };
  }
  function normalise(c) {
    const b = blank();
    Object.keys(b).forEach((k) => {
      if (c[k] === undefined || c[k] === null) c[k] = b[k];
      else if (typeof b[k] === "object" && !Array.isArray(b[k])) Object.keys(b[k]).forEach((kk) => { if (c[k][kk] === undefined) c[k][kk] = b[k][kk]; });
    });
    while ((c.property.comps || []).length < 2) c.property.comps.push({});
    while (c.walkaway.length < 3) c.walkaway.push("");
    return c;
  }
  function openCase(c) {
    const id = uid();
    normalise(c);
    c.meta.created = c.meta.created || new Date().toISOString();
    c.meta.updated = new Date().toISOString();
    c.meta.id = id;
    state.cases[id] = c; state.current = id; save();
    return id;
  }
  const titleOf = (c) => (c.meta && c.meta.name) || (c.property && c.property.name) || "Untitled worksheet";

  /* ---------- Progress -------------------------------------------- */

  function visibleFields(ch, c) {
    const out = [];
    ch.groups.forEach((g) => {
      if (g.show && !g.show(c)) return;
      (g.fields || []).forEach((f) => { if (!f.show || f.show(c)) out.push(f); });
    });
    return out;
  }
  const answered = (c, f) => !isBlank(get(c, f.k)) || !!(c.unknown || {})[f.k];
  function progress(ch, c) {
    const req = visibleFields(ch, c).filter((f) => f.req);
    let extra = 0, extraDone = 0;
    if (ch.id === "stress") {
      const st = W.STRESSES.filter((s) => !(s.na && s.na(c)));
      extra += st.length; extraDone += st.filter((s) => !isBlank(get(c, "stress." + s.id + ".breaks"))).length;
      extra += 1; extraDone += c.walkaway.some((x) => !isBlank(x)) ? 1 : 0;
    }
    if (ch.id === "place") {
      extra += 1; extraDone += W.SIGNALS.filter((s) => !isBlank(((c.market.signals || {})[s.id] || {}).status)).length >= 3 ? 1 : 0;
    }
    if (ch.id === "read") {
      extra += 1; extraDone += Object.keys(c.close.profile || {}).length >= 4 ? 1 : 0;
      extra += 1; extraDone += W.GATES.every((g) => !isBlank((c.close.gates || {})[g.id])) ? 1 : 0;
    }
    return { done: req.filter((f) => answered(c, f)).length + extraDone, total: req.length + extra };
  }
  function overall(c) {
    let d = 0, t = 0;
    W.CHAPTERS.forEach((ch) => { const p = progress(ch, c); d += p.done; t += p.total; });
    return { done: d, total: t };
  }

  /* ---------- Field rendering ------------------------------------- */

  function fieldLabel(f, c) {
    const lab = val(f.label, c);
    const unk = f.unk ? '<button type="button" class="unk' + ((c.unknown || {})[f.k] ? " is-on" : "") + '" data-unk="' + f.k + '" aria-pressed="' + !!(c.unknown || {})[f.k] + '" title="Mark as not known yet — it will appear in your unresolved questions">' + ((c.unknown || {})[f.k] ? "Marked unknown" : "Not sure yet") + "</button>" : "";
    return '<div class="f-label"><label for="f-' + f.k + '">' + esc(lab) + "</label>" + unk + "</div>";
  }

  function input(f, c) {
    const v = get(c, f.k);
    const t = f.t, id = "f-" + f.k;
    if (t === "choice") {
      const opts = val(f.opts, c);
      return '<div class="ticks" role="group" aria-label="' + esc(val(f.label, c)) + '">' + opts.map((o) =>
        '<button type="button" class="tick' + (v === o[0] ? " is-on" : "") + (o[2] ? " has-desc" : "") + '" data-choice="' + f.k + '" data-v="' + esc(o[0]) + '" aria-pressed="' + (v === o[0]) + '"><span class="box" aria-hidden="true"></span><span class="tick-t">' + esc(o[1]) + (o[2] ? "<small>" + esc(o[2]) + "</small>" : "") + "</span></button>").join("") + "</div>";
    }
    if (t === "multi") {
      const arr = Array.isArray(v) ? v : [];
      return '<div class="ticks" role="group">' + val(f.opts, c).map((o) =>
        '<button type="button" class="tick tick-m' + (arr.indexOf(o[0]) >= 0 ? " is-on" : "") + '" data-multi="' + f.k + '" data-v="' + esc(o[0]) + '" aria-pressed="' + (arr.indexOf(o[0]) >= 0) + '"><span class="box" aria-hidden="true"></span><span class="tick-t">' + esc(o[1]) + "</span></button>").join("") + "</div>";
    }
    if (t === "select") {
      const opts = f.opts === "countries" ? Object.keys(W.COUNTRIES).map((k) => [k, W.COUNTRIES[k].name]) : val(f.opts, c);
      let s = '<select id="' + id + '" data-k="' + f.k + '" data-t="select">' + opts.map((o) => '<option value="' + esc(o[0]) + '"' + (v === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>").join("") + "</select>";
      if (f.k === "market.country") {
        s = '<div class="pair">' + s + '<select data-k="market.currency" data-t="select" aria-label="Currency">' + W.CURRENCIES.map((k) => '<option' + (ccy(c) === k ? " selected" : "") + ">" + k + "</option>").join("") + "</select></div>";
      }
      return s;
    }
    if (t === "area" || t === "lines") {
      return '<textarea id="' + id + '" class="lined" data-k="' + f.k + '" data-t="' + t + '" rows="' + (f.rows || 2) + '" placeholder="' + esc(f.ph || "") + '">' + esc(v || "") + "</textarea>";
    }
    if (t === "money" || t === "num" || t === "pct") {
      const shown = t === "money" ? grouped(v, c) : v === undefined || v === null ? "" : v;
      const pre = t === "money" ? '<span class="pre">' + esc((SYM[ccy(c)] || "").trim()) + "</span>" : "";
      const post = f.unit ? '<span class="post">' + esc(f.unit) + "</span>" : "";
      return '<div class="input-wrap">' + pre + '<input id="' + id + '" data-k="' + f.k + '" data-t="' + t + '" inputmode="decimal" autocomplete="off" value="' + esc(shown) + '" placeholder="' + esc(f.ph || "") + '" />' + post + "</div>" +
        (t === "money" ? '<span class="echo" data-echo="' + f.k + '">' + (v !== "" && v !== undefined && v !== null && +v >= 1e5 ? "≈ " + money(v, c) : "") + "</span>" : "");
    }
    const type = t === "date" ? "date" : t === "month" ? "month" : "text";
    return '<input id="' + id + '" class="txt" type="' + type + '" data-k="' + f.k + '" data-t="text" value="' + esc(v || "") + '" placeholder="' + esc(f.ph || "") + '" autocomplete="off" />';
  }

  function field(f, c) {
    if (f.show && !f.show(c)) return "";
    if (f.t === "sub") return '<h4 class="sub-h">' + esc(f.label) + "</h4>";
    if (f.t === "note") return '<p class="reminder">' + esc(f.text) + "</p>";
    return '<div class="field' + (f.wide ? " wide" : "") + (f.t === "area" || f.t === "lines" ? " field-note-area" : "") + '">' + fieldLabel(f, c) + input(f, c) +
      (f.help ? '<p class="help">' + esc(f.help) + "</p>" : "") + (f.hint ? hint(f.hint, c) : "") + "</div>";
  }

  function hint(kind, c) {
    if (kind === "evidence") {
      const h = K.priceEvidenceHint(c);
      const chosen = c.property.price_evidence;
      if (chosen === h.label) return "";
      return '<p class="suggest">Your comparables suggest <b>' + esc(optLabel(W.O.evidence, h.label)) + "</b> — " + esc(h.why) + ' <button type="button" class="link-btn" data-sethint="property.price_evidence" data-v="' + h.label + '">Use this</button></p>';
    }
    return "";
  }

  /* ---------- Custom blocks ---------------------------------------- */

  function spectrum(dimN, country) {
    const d = W.FP_DIMS[dimN];
    if (!d || d.pos[country] === undefined) return "";
    const p = d.pos[country];
    return '<div class="spec"><div class="spec-name">' + esc(d.name) + (d.flag && d.flag[country] ? ' <span class="flag" title="Placement carries a confidence flag in the Fingerprint">confidence flag</span>' : "") + '</div><div class="spec-row"><span class="spec-end">' + esc(d.left) + '</span><span class="spec-track" aria-label="Position ' + (p + 1) + ' of 5">' +
      [0, 1, 2, 3, 4].map((i) => '<i class="' + (i === p ? "on" : "") + '"></i>').join("") + '</span><span class="spec-end r">' + esc(d.right) + "</span></div></div>";
  }

  const CUSTOM = {
    countryContext(c) {
      const k = c.market.country, cc = W.COUNTRIES[k];
      if (!cc || !cc.fingerprint) return '<div class="context"><p class="muted">No bundled Fingerprint for this country. Use the notes below to record the system features that matter.</p></div>';
      const dims = [1, 7, 12, 19];
      return '<div class="context"><div class="context-head"><span class="eyebrow-sm">Housing System Fingerprint · ' + esc(cc.name) + '</span><strong>' + esc(cc.fingerprint) + '</strong><p>' + esc(cc.meaning) + "</p>" + (cc.note ? '<p class="context-note">' + esc(cc.note) + "</p>" : "") + '</div><div class="specs">' + dims.map((n) => spectrum(n, k)).join("") +
        '</div><p class="guard">The Fingerprint describes the machine. It does not tell you what one apartment will do.' +
        (toolUrl("fingerprint") ? ' <a href="' + toolUrl("fingerprint") + "#/country/" + esc(k) + '">Explore ' + esc(cc.name) + "'s full Fingerprint →</a>" : "") + "</p></div>";
    },
    systemNotes(c) {
      const k = c.market.country;
      return '<div class="sys-notes">' + W.SYSTEM_PROMPTS.map((sp) => {
        const key = "market.system." + sp.k;
        const dims = sp.dims.map((n) => spectrum(n, k)).filter(Boolean);
        return '<div class="sys-note"><div class="f-label"><label for="f-' + key + '">' + esc(sp.label) + '</label></div><p class="help">' + esc(sp.q) + "</p>" + (dims.length ? '<div class="specs specs-sm">' + dims.join("") + "</div>" : "") +
          '<textarea id="f-' + key + '" class="lined" rows="2" data-k="' + key + '" data-t="area">' + esc(get(c, key) || "") + "</textarea></div>";
      }).join("") + "</div>";
    },
    signals(c) {
      const sig = c.market.signals || {};
      return '<div class="signals">' + W.SIGNALS.map((s) => {
        const cur = sig[s.id] || {};
        return '<div class="signal"><span class="signal-name">' + esc(s.label) + '</span><span class="seg" role="group" aria-label="' + esc(s.label) + '">' + s.opts.map((o) =>
          '<button type="button" class="seg-btn' + (cur.status === o[0] ? " is-on" : "") + (s.warn.indexOf(o[0]) >= 0 ? " warnish" : "") + '" data-sig="' + s.id + '" data-v="' + o[0] + '" aria-pressed="' + (cur.status === o[0]) + '">' + esc(o[1]) + "</button>").join("") +
          '</span><input class="signal-note" data-signote="' + s.id + '" value="' + esc(cur.note || "") + '" placeholder="What I know" aria-label="' + esc(s.label) + ' — note" /></div>';
      }).join("") + "</div>";
    },
    comps(c) {
      const comps = c.property.comps;
      return '<div class="comps">' + comps.map((x, i) =>
        '<div class="comp"><span class="comp-n">' + (i === 0 ? "Best recent comparable" : i === 1 ? "Second-best comparable" : "Comparable " + (i + 1)) + '</span><div class="comp-grid">' +
        '<label>Price<span class="input-wrap sm"><input data-comp="' + i + '.price" data-t="money" inputmode="decimal" value="' + esc(grouped(x.price, c)) + '" /></span></label>' +
        '<label>Date<input type="month" class="txt sm" data-comp="' + i + '.date" value="' + esc(x.date || "") + '" /></label>' +
        '<label>Kind<select class="sm" data-comp="' + i + '.kind">' + W.O.compKind.map((o) => '<option value="' + o[0] + '"' + ((x.kind || "transaction") === o[0] ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select></label>" +
        '<label>Similarity<select class="sm" data-comp="' + i + '.similarity"><option value="">—</option>' + W.O.similarity.map((o) => '<option value="' + o[0] + '"' + (x.similarity === o[0] ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select></label>" +
        '<label class="comp-note">How similar?<input class="txt sm" data-comp="' + i + '.note" value="' + esc(x.note || "") + '" placeholder="Same building, floor, age, size…" /></label>' +
        "</div></div>").join("") + "</div>" +
        '<p class="field-note">Do not manufacture a point “fair value”. If comparable evidence is thin, write that down.</p>';
    },
    stress(c) {
      const d = K.derive(c);
      return '<div class="stress-list">' + W.STRESSES.map((s) => {
        const na = s.na && s.na(c);
        const st = (c.stress || {})[s.id] || {};
        if (na) return '<div class="st st-na"><div class="st-h"><b>' + esc(s.label) + '</b><span class="muted">Not applicable to this case</span></div></div>';
        const facts = stressFacts(s.id, c, d);
        return '<div class="st' + (st.breaks === "yes" ? " is-break" : st.breaks === "maybe" ? " is-maybe" : "") + '"><div class="st-h"><b>' + esc(s.label) + "</b>" +
          '<span class="seg seg-sm" role="group" aria-label="Does anything break?"><span class="seg-lab">Does anything break?</span>' + W.O.breaks.map((o) =>
            '<button type="button" class="seg-btn' + (st.breaks === o[0] ? " is-on" : "") + '" data-stress="' + s.id + '" data-v="' + o[0] + '" aria-pressed="' + (st.breaks === o[0]) + '">' + o[1] + "</button>").join("") + "</span></div>" +
          (facts ? '<p class="st-facts" data-calc="st-' + s.id + '">' + facts + "</p>" : '<p class="st-facts" data-calc="st-' + s.id + '"></p>') +
          '<textarea class="lined" rows="1" data-k="stress.' + s.id + '.note" data-t="area" placeholder="What happens to cash flow and liquidity?" aria-label="' + esc(s.label) + ' — what happens">' + esc(st.note || "") + "</textarea></div>";
      }).join("") + "</div>";
    },
    walkaway(c) {
      return '<ol class="walk">' + c.walkaway.map((w, i) =>
        '<li><span class="walk-if">If</span><input class="txt" data-wa="' + i + '" value="' + esc(w) + '" placeholder="' + esc(["the title or approvals are not clean before signing", "the all-in price goes above …", "post-purchase liquidity would fall below my floor"][i] || "…") + '" aria-label="Walk-away condition ' + (i + 1) + '" />' +
        (i >= 3 ? '<button type="button" class="row-del" data-wadel="' + i + '" aria-label="Remove">×</button>' : "") + "</li>").join("") + "</ol>" +
        (c.walkaway.length < 6 ? '<button type="button" class="btn-ghost small" data-waadd="1">+ Add a condition</button>' : "");
    },
    profile(c) {
      const sugg = profileHints(c);
      return '<div class="prof">' + W.PROFILE.map((p) => {
        const v = (c.close.profile || {})[p.id];
        const h = sugg[p.id];
        return '<div class="prof-row"><span class="prof-name">' + esc(p.label) + '</span><span class="seg" role="group" aria-label="' + esc(p.label) + '">' + p.opts.map((o) =>
          '<button type="button" class="seg-btn' + (v === o[0] ? " is-on" : "") + '" data-prof="' + p.id + '" data-v="' + o[0] + '" aria-pressed="' + (v === o[0]) + '">' + esc(o[1]) + "</button>").join("") + "</span>" +
          (h ? '<p class="prof-hint">' + (h.facts ? esc(h.facts) + " " : "") + (h.label && h.label !== v ? "Your answers point to <b>" + esc(optLabel(p.opts, h.label)) + '</b>. <button type="button" class="link-btn" data-useprof="' + p.id + '" data-v="' + h.label + '">Use this</button>' : "") + "</p>" : "") + "</div>";
      }).join("") + "</div>";
    },
    openQuestions(c) {
      const unk = unknownList(c);
      const promoted = (c.close.open || []).map((q) => q.from).filter(Boolean);
      const pending = unk.filter((u) => promoted.indexOf(u.k) < 0);
      return (pending.length ? '<div class="unk-list"><span class="eyebrow-sm">Marked “not sure yet”</span><ul>' + pending.map((u) =>
        '<li><span>' + esc(u.label) + ' <small class="muted">· ' + esc(u.chapter) + '</small></span><button type="button" class="link-btn" data-promote="' + u.k + '">Make it a question →</button></li>').join("") + "</ul></div>" : "") +
        '<div class="oq-rows">' + (c.close.open || []).map((q, i) =>
          '<div class="oq-row"><span class="oq-n">' + (i + 1) + '</span><label>Question still unresolved<input class="txt" data-oq="' + i + '.q" value="' + esc(q.q || "") + '" /></label><label>Who / what resolves it?<input class="txt" data-oq="' + i + '.who" value="' + esc(q.who || "") + '" /></label><button type="button" class="row-del" data-oqdel="' + i + '" aria-label="Remove question">×</button></div>').join("") +
        "</div>" + '<button type="button" class="btn-ghost small" data-oqadd="1">+ Add a question</button>';
    },
    destinations(c) {
      const rows = c.destinations;
      const used = rows.map((r) => (r.dest || "").toLowerCase());
      const suggest = W.DESTINATIONS.filter((x) => used.indexOf(x.toLowerCase()) < 0);
      const cell = (i, f, ph, lab) => '<label><span>' + lab + '</span><input class="txt sm" data-dest="' + i + "." + f + '" value="' + esc(rows[i][f] || "") + '" placeholder="' + esc(ph) + '" /></label>';
      return '<div class="dest-head" aria-hidden="true"><span>Destination</span><span>Distance</span><span>Normal time</span><span>Peak-hour time</span><span>Last mile / route quality</span><span>Alternate route?</span><span></span></div>' +
        '<div class="dests">' + rows.map((r, i) =>
          '<div class="dest">' + cell(i, "dest", W.DESTINATIONS[i] || "Destination", "Destination") + cell(i, "distance", "km", "Distance") + cell(i, "normal", "min", "Normal time") + cell(i, "peak", "min", "Peak-hour time") +
          cell(i, "lastmile", "e.g. narrow lane, floods", "Last mile / route quality") +
          '<label><span>Alternate route?</span><select class="sm" data-dest="' + i + '.alt"><option value="">—</option>' + W.O.altRoute.map((o) => '<option value="' + o[0] + '"' + (r.alt === o[0] ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select></label>" +
          '<button type="button" class="row-del" data-destdel="' + i + '" aria-label="Remove destination">×</button></div>').join("") + "</div>" +
        '<div class="dest-add">' + (rows.length < 8 ? '<button type="button" class="btn-ghost small" data-destadd="">+ Add a destination</button>' : "") +
        (suggest.length && rows.length < 8 ? '<span class="dest-sugg"><span class="muted">Suggestions:</span> ' + suggest.map((x) => '<button type="button" class="chip chip-sm" data-destadd="' + esc(x) + '">' + esc(x) + "</button>").join("") + "</span>" : "") + "</div>";
    },
    scenarios(c) {
      return '<div class="scen">' + W.SCENARIOS.map((s) => '<div class="scen-c scen-' + s.id + '"><span class="scen-k">Scenario ' + s.id + "</span><b>" + esc(s.title) + "</b><p>" + esc(s.text) + "</p></div>").join("") + "</div>";
    },
    gates(c) {
      const g = c.close.gates || {};
      const rows = gateRows(c);
      const failing = rows.filter((r) => g[r.id] === "fails");
      return (failing.length ? '<p class="gate-alert"><b>Failing: ' + esc(failing.map((r) => r.label).join("; ")) + ".</b> Under your own rules, strengths elsewhere don't offset this. It has to be resolved — or it is a reason to walk away.</p>" : "") +
        '<div class="gates">' + rows.map((r) =>
          '<div class="gate' + (g[r.id] === "fails" ? " is-fail" : "") + '"><div class="gate-name">' + esc(r.label) + (r.household ? ' <span class="s-tag">Walk-away condition</span>' : "") + (r.facts ? "<small>" + esc(r.facts) + "</small>" : "") + "</div>" +
          '<span class="seg" role="group" aria-label="' + esc(r.label) + '">' + W.O.gate.map((o) =>
            '<button type="button" class="seg-btn' + (g[r.id] === o[0] ? " is-on" : "") + (o[0] === "fails" ? " warnish" : "") + '" data-gate="' + r.id + '" data-v="' + o[0] + '" aria-pressed="' + (g[r.id] === o[0]) + '">' + o[1] + "</button>").join("") + "</span></div>").join("") + "</div>" +
        (c.walkaway.every(isBlank) ? '<p class="help">Walk-away conditions you set in Chapter 7 appear here as household-specific gates.</p>' : "");
    },
    statementPreview(c) {
      return '<div class="statement" data-calc="statement">' + statementHTML(c, true) + "</div>";
    },
  };

  // The standard potential non-negotiables, plus each walk-away condition.
  function gateRows(c) {
    return W.GATES.map((x) => ({ id: x.id, label: x.label, facts: gateFacts(c, x.id) }))
      .concat(c.walkaway.map((w, i) => (isBlank(w) ? null : { id: "wa" + i, label: "If " + sentence(w).replace(/^if\s+/i, ""), household: true })).filter(Boolean));
  }

  // What the worksheet already knows about each potential non-negotiable.
  function gateFacts(c, id) {
    const O = W.O, lab = optLabel;
    if (id === "title") return [c.property.title_status ? "Title: " + lab(O.resolved, c.property.title_status).toLowerCase() : "", W.helpers.isUC(c) && c.uc.registration ? "registration: " + lab(O.resolved, c.uc.registration).toLowerCase() : "", c.property.title_note || ""].filter(Boolean).join(" · ");
    if (id === "access") return [c.access.legal ? "Access " + lab(O.legalAccess, c.access.legal).toLowerCase() : "", c.access.road ? "road: " + lab(O.road, c.access.road).toLowerCase() : "", c.access.year_round ? "year-round: " + lab(O.yearRound, c.access.year_round).toLowerCase() : ""].filter(Boolean).join(" · ");
    if (id === "water") return [c.water.source ? lab(W.waterSourceOpts(c), c.water.source) : "", c.water.reliability ? lab(O.waterReliability, c.water.reliability).toLowerCase() : "", c.water.tanker && c.water.tanker !== "none" ? "tanker: " + lab(O.tanker, c.water.tanker).toLowerCase() : "", c.water.future_connection === "yes" ? "counting on a future connection" : ""].filter(Boolean).join(" · ");
    if (id === "financing") {
      const d = K.derive(c);
      const breaks = W.STRESSES.filter((s) => !(s.na && s.na(c)) && ((c.stress || {})[s.id] || {}).breaks === "yes").map((s) => s.short.toLowerCase());
      return [breaks.length ? "Breaks under: " + breaks.join(", ") : "", c.thesis.survive_c ? "survives Scenario C: " + lab(O.scenario, c.thesis.survive_c).toLowerCase() : "", d.belowFloor ? "liquidity below your floor" : ""].filter(Boolean).join(" · ");
    }
    return "";
  }

  function frictionLabel(c, d) {
    const parts = ["Acquisition"];
    if (+c.property.initial_work) parts.push("initial work");
    if (d.exitCost) parts.push("selling");
    return (parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1] : parts[0]) + " costs";
  }

  function stressFacts(id, c, d) {
    const m = (v) => money(v, c);
    const hold = +c.decision.holding_years || 0;
    if (id === "flat") {
      if (d.frictionTotal === null) return "Add the price and acquisition costs to see what a flat market costs you.";
      let s = frictionLabel(c, d) + " ≈ " + m(d.frictionTotal) + " (" + pct(d.frictionShare) + " of price) are lost if prices simply stand still.";
      if (d.isLoan && d.emi && d.rent !== null && c.decision.occupancy === "rent") {
        const gap = d.emi + (+c.property.owner_annual || 0) / 12 - d.rent;
        if (gap > 0) s += " Monthly top-up while you wait: ≈ " + m(gap) + " (EMI + owner costs − rent).";
      }
      return s;
    }
    if (id === "fall") {
      if (d.price === null) return "";
      if (!d.isLoan) return "Value falls to ≈ " + m(d.valueAfterFall) + ". With no loan, nothing has to be refinanced or sold.";
      return "Value ≈ " + m(d.valueAfterFall) + " against a loan of " + m(d.loan) + ": your equity goes from " + m(d.equityAtStart) + " to " + m(d.equityAfterFall) + (d.equityAfterFall < 0 ? " — less than the loan." : ".");
    }
    if (id === "rate") {
      if (!d.rateShockApplies) return "Fixed rate: the reset only matters at the end of the fixed period. Note when that is.";
      if (d.emiPlus2 === null) return "Add the loan, rate and tenure to see the new EMI.";
      return "EMI ≈ " + m(d.emiCalc) + " → " + m(d.emiPlus2) + " (+" + m(d.emiPlus2Delta) + " a month)" + (d.emiPlus2Ratio !== null ? "; all debt payments ≈ " + pct(d.emiPlus2Ratio, 0) + " of income." : ".") + " Some lenders extend the tenure instead of raising the EMI.";
    }
    if (id === "income") {
      if (d.monthsCovered === null) return "Add liquid assets and monthly living costs to see how long liquidity lasts.";
      return "Post-purchase liquidity covers ≈ " + tidy(d.monthsCovered, 1) + " months of outgoings (living costs + debt payments + owner costs)" + (d.incomeGap12 > 0 ? "; a 12-month stop leaves a gap of ≈ " + m(d.incomeGap12) + "." : ", more than the full twelve.");
    }
    if (id === "vacancy") {
      if (d.vacancy6 === null) return "Add the expected rent to see the vacancy cost.";
      return "Six months without rent ≈ " + m(d.vacancy6) + " of lost income, while ≈ " + m(d.vacancy6Carry) + " of EMI and owner costs continue.";
    }
    if (id === "delay") {
      if (d.delayCarry24 === null || d.delayCarry24 === undefined) return "Add the rent you'd keep paying (Financing) and the loan to estimate the delay cost.";
      const pts = d.delayParts, parts = [];
      if (pts.housing) parts.push("rent " + m(pts.housing));
      if (pts.interest) parts.push("interest " + m(pts.interest));
      if (pts.lostRent) parts.push("lost rent " + m(pts.lostRent));
      return "Rough 24-month carry ≈ " + m(d.delayCarry24) + " (" + parts.join(" + ") + "; interest assumes full disbursement — an upper bound).";
    }
    return "";
  }

  function profileHints(c) {
    const d = K.derive(c), out = {};
    const ev = c.property.price_evidence || K.priceEvidenceHint(c).label;
    out.price_evidence = { label: ev, facts: "" };
    const z = c.dependency.zero_ok;
    if (z) out.appr_dependency = { label: { yes: "low", partly: "moderate", no: "high" }[z], facts: "At zero appreciation the job is done: " + optLabel(W.O.yesPartlyNo, z).toLowerCase() + "." };
    if (!d.isLoan && c.financing.mode === "cash") out.leverage = { label: "low", facts: "No loan." };
    else if (d.isLoan) {
      const s = c.stress || {}, b = [s.rate && s.rate.breaks, s.income && s.income.breaks];
      const lab = b.indexOf("yes") >= 0 ? "high" : b.indexOf("maybe") >= 0 ? "moderate" : b[0] === "no" && b[1] === "no" ? "low" : null;
      const facts = [d.ltv !== null ? "Loan " + pct(d.ltv, 0) + " of price" : "", d.debtServiceRatio !== null ? "debt payments " + pct(d.debtServiceRatio, 0) + " of income" : ""].filter(Boolean).join("; ");
      out.leverage = { label: lab, facts: facts ? facts + "." : "" };
    }
    if (d.postLiquid !== null) {
      const lab = d.belowFloor ? "breach" : d.minLiquid !== null && (d.postLiquid < 2 * d.minLiquid || (d.monthsCovered !== null && d.monthsCovered < 6)) ? "tension" : d.minLiquid !== null ? "manageable" : null;
      out.liquidity = { label: lab, facts: "Liquid after purchase ≈ " + money(d.postLiquid, c) + (d.minLiquid !== null ? " against your floor of " + money(d.minLiquid, c) : "") + "." };
    }
    if (d.reShareNet !== null) out.concentration = { label: null, facts: "≈ " + pct(d.reShareNet, 0) + " of net worth would be in real estate." };
    if (c.life.zat) out.utility = W.helpers.homeish(c) ? { label: c.life.zat === "yes" ? "strong" : c.life.zat === "no" ? "weak" : "mixed", facts: "Zero-Appreciation Test: " + optLabel(W.O.zat, c.life.zat) + "." } : { label: "na", facts: "" };
    const ex = [c.property.title_status, W.helpers.isUC(c) ? c.uc.registration : null].filter(Boolean);
    if (ex.length) {
      const order = ["unresolved", "unknown", "partly", "resolved"];
      out.execution = { label: order.find((o) => ex.indexOf(o) >= 0), facts: "" };
    }
    return out;
  }

  function unknownList(c) {
    const out = [];
    W.CHAPTERS.forEach((ch) => ch.groups.forEach((g) => (g.fields || []).concat((g.more && g.more.fields) || []).forEach((f) => {
      if (f.k && (c.unknown || {})[f.k]) out.push({ k: f.k, label: val(f.label, c), chapter: ch.title });
    })));
    return out;
  }

  /* ---------- Calc boxes (hand checks) ----------------------------- */

  function kv(rows) {
    rows = rows.filter((r) => r && r[1] !== null && r[1] !== undefined && r[1] !== "—");
    if (!rows.length) return "";
    return '<dl class="checks">' + rows.map((r) => '<div class="chk' + (r[3] ? " chk-" + r[3] : "") + '"><dt>' + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>" + (r[2] ? "<small>" + esc(r[2]) + "</small>" : "") + "</div>").join("") + "</dl>";
  }

  const CALC = {
    economics(c) {
      const d = K.derive(c), m = (v) => money(v, c);
      return kv([
        d.allIn !== null && d.acqAll ? ["All-in cost", m(d.allIn), "Price + acquisition + initial work"] : null,
        d.grossYield !== null ? ["Gross rental yield", pct(d.grossYield), "12 × monthly rent ÷ price"] : null,
        d.netYield !== null && c.property.owner_annual ? ["After owner costs", pct(d.netYield), "Before vacancy, management and tax"] : null,
        d.cashNeeded !== null ? ["Cash needed now", m(d.cashNeeded), "Price + acquisition + work − loan"] : null,
      ]);
    },
    uc(c) {
      const d = K.derive(c), m = (v) => money(v, c);
      return kv([
        d.ucDiscount !== null && d.ucDiscount !== undefined ? ["Discount vs ready", m(d.ucDiscount), "Ready all-in − this all-in", d.ucDiscount < 0 ? "warn" : ""] : null,
        d.delayCarry24 ? ["Rough 24-month delay carry", m(d.delayCarry24), "Upper bound; see the stress test"] : null,
        d.ucDiscountAfterDelay !== null && d.ucDiscountAfterDelay !== undefined ? ["Discount left after a 24-month delay", m(d.ucDiscountAfterDelay), "", d.ucDiscountAfterDelay < 0 ? "warn" : ""] : null,
      ]);
    },
    financing(c) {
      const d = K.derive(c), m = (v) => money(v, c);
      if (!d.isLoan) return c.financing.mode === "cash" ? kv([d.cashNeeded !== null ? ["Cash needed now", m(d.cashNeeded), "Price + acquisition + work"] : null]) : "";
      return kv([
        d.downPayment !== null ? ["Down payment", m(d.downPayment), d.ltv !== null ? "Loan is " + pct(d.ltv, 0) + " of price" : ""] : null,
        d.emi ? ["EMI", m(d.emi), d.emiSource === "calculated" ? "Calculated from loan, rate and tenure" : "As entered"] : null,
        d.debtServiceRatio !== null && d.emi ? ["All debt payments", pct(d.debtServiceRatio, 0) + " of income", ""] : null,
        d.emiPlus2 !== null && d.rateShockApplies ? ["If the rate rises 2 points", m(d.emiPlus2), "+" + m(d.emiPlus2Delta) + " a month"] : null,
      ]);
    },
    balance(c) {
      const d = K.derive(c), m = (v) => money(v, c);
      return kv([
        d.cashNeeded !== null ? ["Cash needed at acquisition", m(d.cashNeeded), d.fromLongTerm ? m(d.fromLongTerm) + " of it from long-term assets" : ""] : null,
        d.postLiquid !== null ? ["Liquid assets after purchase", m(d.postLiquid), d.minLiquid !== null ? (d.belowFloor ? "Below your floor of " + m(d.minLiquid) : "Floor " + m(d.minLiquid)) : "Current liquid − cash required", d.belowFloor ? "warn" : ""] : null,
        d.reShareNet !== null ? ["Net worth in real estate", pct(d.reShareNet, 0), "After purchase; " + pct(d.reShareGross, 0) + " of gross assets"] : null,
        d.monthsCovered !== null ? ["Months of outgoings covered", tidy(d.monthsCovered, 1), "If income stopped tomorrow"] : null,
      ]);
    },
    premium(c) {
      const d = K.derive(c), m = (v) => money(v, c);
      if (d.premium === null) return "";
      return kv([
        ["Housing-Consumption Premium", m(d.premium), pct(d.premiumShare, 0) + " of the price"],
        d.premiumCarry ? ["Carrying it at your loan rate", m(d.premiumCarry) + " a year", "Interest on the premium alone"] : null,
      ]);
    },
    friction(c) {
      const d = K.derive(c);
      if (d.frictionAppr === null) return '<p class="help">Add the price, acquisition costs and holding period to see how much appreciation is needed just to stand still.</p>';
      const implied = +c.dependency.implied_appr;
      return kv([
        ["Appreciation needed just to recover costs", pct(d.frictionAppr) + " a year", frictionLabel(c, d) + " over " + c.decision.holding_years + " years" + (d.exitCost ? "" : " · add selling costs on Property for a fuller picture")],
        c.dependency.implied_appr !== undefined && c.dependency.implied_appr !== "" ? ["Share of your " + tidy(implied, 1) + "% that only recovers costs", implied > 0 ? pct(Math.min(1, d.frictionAppr * 100 / implied), 0) : "—", "The rest is the actual gain"] : null,
      ]);
    },
  };

  /* ---------- Chapter view ----------------------------------------- */

  function groupHTML(g, c, ch) {
    if (g.show && !g.show(c)) return "";
    const fields = (g.fields || []).map((f) => field(f, c)).join("");
    let more = "";
    if (g.more && (!g.more.show || g.more.show(c))) {
      const inner = g.more.custom ? CUSTOM[g.more.custom](c) : '<div class="grid">' + g.more.fields.map((f) => field(f, c)).join("") + "</div>";
      const filled = g.more.custom ? W.SYSTEM_PROMPTS.some((sp) => !isBlank(get(c, "market.system." + sp.k))) : g.more.fields.some((f) => !isBlank(get(c, f.k)));
      more = '<details class="more"' + (filled ? " open" : "") + "><summary>" + esc(g.more.label) + "</summary>" + inner + "</details>";
    }
    const why = g.why ? '<details class="why"><summary>Why this matters</summary><p>' + esc(g.why) + "</p></details>" : "";
    const custom = g.custom ? CUSTOM[g.custom](c) : "";
    const calc = g.calc ? '<div class="calc" data-calc="' + g.calc + '">' + CALC[g.calc](c) + "</div>" : "";
    const body = (g.custom && g.custom !== "statementPreview" ? custom : "") + (fields ? '<div class="grid">' + fields + "</div>" : "") + calc + (g.custom === "statementPreview" ? custom : "") + more;
    if (g.collapsed) {
      const filled = (g.fields || []).some((f) => !isBlank(get(c, f.k)) && f.k !== "meta.date");
      return '<details class="card group group-quiet"' + (filled ? " open" : "") + '><summary><h3>' + esc(g.title) + '</h3><span class="muted">Optional</span></summary>' + body + "</details>";
    }
    const lead = g.lead ? '<p class="lead">' + esc(g.lead) + "</p>" : "";
    return '<section class="card group" id="g-' + g.id + '"><div class="group-head"><h3>' + esc(g.title) + "</h3>" + why + "</div>" + lead + body + "</section>";
  }

  function stepper(c, active) {
    return '<nav class="stepper" aria-label="Worksheet chapters">' + W.CHAPTERS.map((ch) => {
      const p = progress(ch, c);
      const done = p.total && p.done >= p.total;
      return '<a class="step' + (ch.id === active ? " is-active" : "") + (done ? " is-done" : "") + '" href="#/w/' + ch.id + '"' + (ch.id === active ? ' aria-current="step"' : "") + '><span class="step-i">' + (done ? "✓" : ch.n) + '</span><span class="step-t">' + esc(ch.short) + '</span><span class="step-p">' + p.done + "/" + p.total + "</span></a>";
    }).join("") + '<a class="step step-sum' + (active === "summary" ? " is-active" : "") + '" href="#/summary"><span class="step-i">≡</span><span class="step-t">Summary</span></a></nav>';
  }

  function caseHead(c) {
    return '<div class="case-head"><div class="case-name"><span class="eyebrow-sm">Worksheet</span><input data-k="meta.name" data-t="text" value="' + esc(c.meta.name || "") + '" placeholder="' + esc(c.property.name || "Name this worksheet") + '" aria-label="Worksheet name" /></div>' +
      '<div class="case-actions"><a class="btn-ghost small" href="#/">All worksheets</a><button class="btn-ghost small" data-act="export">Save a copy (file)</button>' + (toolUrl("xray") ? '<button class="btn-ghost small" data-act="toxray">Open in the X-Ray</button>' : "") + '<a class="btn small" href="#/summary">Summary</a></div></div>';
  }

  function chapterView(id) {
    const c = cur();
    if (!c) { location.hash = "#/"; return ""; }
    const i = W.CHAPTERS.findIndex((x) => x.id === id);
    const ch = W.CHAPTERS[i] || W.CHAPTERS[0];
    const prev = W.CHAPTERS[i - 1], next = W.CHAPTERS[i + 1];
    return '<main class="wrap workspace">' + caseHead(c) + '<div class="ws-grid">' + stepper(c, ch.id) + '<div class="ws-main">' +
      '<header class="ch-head"><span class="ch-num">' + ch.n + '</span><div><span class="eyebrow-sm">Chapter ' + ch.n + " of " + W.CHAPTERS.length + '</span><h1>' + esc(ch.title) + '</h1><p class="ch-ask">' + esc(ch.ask) + '</p><p class="ch-intro">' + esc(ch.intro) + "</p></div></header>" +
      ch.groups.map((g) => groupHTML(g, c, ch)).join("") +
      '<div class="step-foot">' + (prev ? '<a class="btn-ghost" href="#/w/' + prev.id + '">← ' + esc(prev.title) + "</a>" : "<span></span>") +
      (next ? '<a class="btn btn-gold" href="#/w/' + next.id + '">' + esc(next.title) + " →</a>" : '<a class="btn btn-gold" href="#/summary">See the summary →</a>') + "</div></div></div></main>";
  }

  /* ---------- Landing ---------------------------------------------- */

  function xrayCases() {
    const c = readXRay().cases;
    return Object.keys(c).length ? c : null;
  }

  function landing() {
    const saved = Object.keys(state.cases).map((id) => [id, state.cases[id]]).sort((a, b) => (b[1].meta.updated || "").localeCompare(a[1].meta.updated || ""));
    const xr = xrayCases();
    const xrList = xr ? Object.keys(xr).filter((k) => !(xr[k].meta || {}).example) : [];
    return '<main><section class="wrap hero"><p class="eyebrow">Real Estate Reframed · Companion to Article ' + W.ARTICLE.n + '</p>' +
      '<h1>Should this property fit into <em>your</em> financial life?</h1>' +
      '<p class="lede">A guided conversation to have before you emotionally commit — on your own, with a partner, or with an adviser. Eight short chapters, from the housing system down to your household, ending in a one-page summary you can print and keep.</p>' +
      journeyHTML() +
      '<div class="start-grid"><button class="start-card start-primary" data-act="new"><span class="start-k">Start</span><strong>A new worksheet</strong><span>About 30–40 minutes. Save as you go; come back any time.</span></button>' +
      '<button class="start-card" data-act="example" data-v="A"><span class="start-k">Example · Article 14</span><strong>Household A</strong><span>The long-stay family: ₹3 Cr apartment, 30% loan, twenty-year horizon.</span></button>' +
      '<button class="start-card" data-act="example" data-v="B"><span class="start-k">Example · Article 14</span><strong>Household B</strong><span>Same apartment: 80% loan, four-year appreciation bet.</span></button></div>' +
      '<p class="hero-note">Not a score. Not a BUY / DON’T BUY verdict. The point is to make the uncertainty visible before you choose it.</p></section>' +
      (saved.length ? '<section class="wrap part part-tight"><div class="part-head"><h2>Your worksheets</h2></div><div class="saved">' + saved.map(([id, c]) => {
        const o = overall(c);
        return '<div class="saved-row"><a href="#/open/' + id + '"><strong>' + esc(titleOf(c)) + "</strong><span>" + esc([c.market.city, c.property.purchase_price ? money(c.property.purchase_price, c) : ""].filter(Boolean).join(" · ")) + (c.meta.updated ? " · edited " + new Date(c.meta.updated).toLocaleDateString() : "") + '</span></a><span class="saved-p"><span class="meter"><i style="width:' + (o.total ? Math.round((100 * o.done) / o.total) : 0) + '%"></i></span>' + o.done + "/" + o.total + '</span><span class="saved-act"><a class="btn-ghost small" href="#/summary/' + id + '">Summary</a><button class="btn-ghost small" data-act="del" data-v="' + id + '" aria-label="Delete ' + esc(titleOf(c)) + '">Delete</button></span></div>';
      }).join("") + "</div></section>" : "") +
      '<section class="wrap part"><div class="part-head"><span class="part-num">The tests</span><h2>Fourteen questions worth answering before you sign</h2><p class="part-sub">Grouped along the series’ hierarchy — <b>Country → City → Property → Financing → Person</b> — so each question is asked where the evidence for it lives.</p></div>' +
      '<ol class="tests">' + W.TESTS.map((t, i) => '<li><span class="tests-n">' + String(i + 1).padStart(2, "0") + "</span>" + esc(t[0]) + "</li>").join("") + "</ol></section>" +
      '<section class="wrap part"><div class="two"><div class="card soft"><h3>How to use it</h3><ul class="plain-list"><li><b>Short answers are enough.</b> A sentence beats a paragraph.</li><li><b>Unknown is an answer.</b> Mark anything you can’t answer yet — it becomes your diligence list.</li><li><b>Set walk-away conditions early</b>, before the emotional case gets stronger.</li><li><b>Do it together.</b> The disagreements are usually the most useful part.</li></ul></div>' +
      '<div class="card soft"><h3>The worksheet and the X-Ray</h3><p class="muted-p">The worksheet is the human decision conversation. The ' + (toolUrl("xray") ? '<a href="' + toolUrl("xray") + '">Property Decision X-Ray</a>' : "Property Decision X-Ray") + ' is the deeper diagnostic: full return reconstruction, rent-versus-own, mortgage schedules, combined stresses and FIRE-usable wealth. They share the same vocabulary, so a case can move between them: start here, go deeper there, and bring the answers back.</p>' +
      (xrList.length ? '<p class="muted-p"><b>Bring in an X-Ray case</b> from this browser:</p><div class="chips">' + xrList.map((k) => '<button class="chip" data-act="fromxray" data-v="' + esc(k) + '">' + esc((xr[k].meta || {}).name || "X-Ray case") + "</button>").join("") + "</div>" : "") +
      '<p class="muted-p"><a href="#/blank">Print a blank worksheet</a> to work through on paper · <button class="link-btn" data-act="import">Open a saved worksheet file…</button><input type="file" id="importFile" accept="application/json,.json" hidden /></p></div></div></section></main>';
  }

  /* ---------- Summary ---------------------------------------------- */

  const BL = '<span class="blank">Not yet answered</span>';
  const ans = (v) => (isBlank(v) ? BL : esc(v));
  const linesOf = (s) => String(s || "").split(/\n+/).map((x) => x.trim().replace(/^[-•*]\s*/, "")).filter(Boolean);
  const sentence = (s) => { s = String(s || "").trim(); return s ? s.replace(/[.\s]+$/, "") : s; };

  // Unanswered choices print as tick boxes, like the paper worksheet.
  const boxes = (opts) => '<span class="bxs">' + opts.map((o) => '<span class="bx">' + esc(o[1]) + "</span>").join("") + "</span>";
  const article = (w) => (/^[aeiou]/i.test(String(w || "").trim()) ? "an" : "a");

  function statementHTML(c, live) {
    const k = c.close;
    const slot = (v, ph) => (isBlank(v) ? '<span class="slot">' + esc(ph) + "</span>" : "<b>" + esc(sentence(v)) + "</b>");
    return '<p class="stmt">This is primarily ' + (isBlank(k.primarily) ? "a" : article(k.primarily)) + " " + slot(k.primarily, "__________") + " purchase. It works if " + slot(k.works_if, "__________") + ". It struggles if " + slot(k.struggles_if, "__________") + ". The key trade-off is " + slot(k.tradeoff, "__________") + ".</p>" +
      (live ? "" : !isBlank(k.still_need) ? '<p class="stmt-need"><span>What I still need to know before deciding:</span> ' + esc(k.still_need) + "</p>" : "");
  }

  // Things the purchase relies on that the owner does not control.
  function outsideDeps(c) {
    const O = W.O, w = c.water || {}, a = c.access || {}, out = [];
    if (w.future_connection === "yes") out.push("a future piped water connection");
    if (w.tanker === "seasonal" || w.tanker === "regular") out.push(W.waterTerms(c).truckNoun + " (" + optLabel(O.tanker, w.tanker).toLowerCase() + ")");
    if (a.road === "dependent") out.push("access over another landowner's road");
    else if (a.road === "shared") out.push("a shared access road");
    if (a.third_party === "some" || a.third_party === "material") out.push(a.dependency_note ? sentence(a.dependency_note) : "neighbours or third parties for normal use");
    return out.map((x) => x.charAt(0).toUpperCase() + x.slice(1));
  }

  function mainRisks(c) {
    const out = linesOf(c.close.risks).map((t) => ({ t: t }));
    W.STRESSES.forEach((s) => {
      const st = (c.stress || {})[s.id] || {};
      if (s.na && s.na(c)) return;
      if (st.breaks === "yes") out.push({ t: s.short + " — something breaks", auto: "Stress test" });
    });
    const maybes = W.STRESSES.filter((s) => !(s.na && s.na(c)) && ((c.stress || {})[s.id] || {}).breaks === "maybe").map((s) => s.short.toLowerCase());
    if (maybes.length) out.push({ t: "Might break under: " + maybes.join(", "), auto: "Stress test" });
    W.SIGNALS.forEach((s) => { const v = ((c.market.signals || {})[s.id] || {}).status; if (s.warn.indexOf(v) >= 0) out.push({ t: s.label + ": " + optLabel(s.opts, v).toLowerCase(), auto: "City" }); });
    if (["unresolved", "unknown"].indexOf(c.property.title_status) >= 0) out.push({ t: "Title / documentation " + c.property.title_status + (c.property.title_note ? ": " + sentence(c.property.title_note) : ""), auto: "Legal" });
    const O = W.O, w = c.water || {}, a = c.access || {}, th = c.thesis || {};
    if (w.reliability === "seasonal" || w.reliability === "frequent") out.push({ t: "Water supply: " + optLabel(O.waterReliability, w.reliability).toLowerCase(), auto: "Water" });
    if (w.tanker === "seasonal" || w.tanker === "regular") out.push({ t: "Depends on " + W.waterTerms(c).truckNoun + ": " + optLabel(O.tanker, w.tanker).toLowerCase(), auto: "Water" });
    if (w.future_connection === "yes") out.push({ t: "Relies on a piped water connection that doesn't exist today", auto: "Water" });
    if (a.legal === "partly" || a.legal === "unclear") out.push({ t: "Legal access " + optLabel(O.legalAccess, a.legal).toLowerCase(), auto: "Access" });
    if (a.road === "dependent") out.push({ t: "Access road depends on another landowner", auto: "Access" });
    if (a.year_round === "no" || a.year_round === "seasonal") out.push({ t: "Final approach: " + optLabel(O.yearRound, a.year_round).toLowerCase(), auto: "Access" });
    if (a.third_party === "material") out.push({ t: "Normal use depends materially on third parties" + (a.dependency_note ? ": " + sentence(a.dependency_note) : ""), auto: "Access" });
    if (th.happy_b === "no") out.push({ t: "Would not be happy owning it if new supply absorbs the upside (Scenario B)", auto: "Scenario" });
    if (th.survive_c === "no" || th.survive_c === "unsure") out.push({ t: (th.survive_c === "no" ? "May not survive" : "Unsure it survives") + " a disappointing location thesis (Scenario C)", auto: "Scenario" });
    // A failing non-negotiable leads the list.
    const g = (c.close || {}).gates || {};
    gateRows(c).filter((r) => g[r.id] === "fails").reverse().forEach((r) => out.unshift({ t: "Non-negotiable failing: " + r.label, auto: "Gate" }));
    return out;
  }

  function nextActions(c) {
    const out = (c.close.open || []).filter((q) => !isBlank(q.q)).map((q) => ({ q: q.q, who: q.who }));
    const ev = c.property.price_evidence;
    if (ev === "weak" || ev === "insufficient") out.push({ q: "Find two recent, genuinely comparable registered transactions", who: "Registration records, lender valuation, local brokers", auto: true });
    if (["partly", "unresolved", "unknown"].indexOf(c.property.title_status) >= 0 && !(c.close.open || []).some((q) => /title|noc|encumbr|approval/i.test(q.q || ""))) out.push({ q: "Resolve title, documentation and approvals" + (c.property.title_note ? " — " + sentence(c.property.title_note) : ""), who: "A property lawyer, before any payment", auto: true });
    if (W.helpers.isUC(c) && ["partly", "unresolved", "unknown"].indexOf(c.uc.registration) >= 0) out.push({ q: "Confirm project registration, land title and approvals", who: "Regulator's project page; your lawyer", auto: true });
    const w = c.water || {}, a = c.access || {}, u = c.unknown || {};
    if (["partly", "unclear", "unknown"].indexOf(a.legal) >= 0 || u["access.legal"]) out.push({ q: "Confirm documented, legal access to the property", who: "Your property lawyer — title deed, layout plan and any easement", auto: true });
    if (["shared", "dependent"].indexOf(a.road) >= 0 || ["some", "material", "unknown"].indexOf(a.third_party) >= 0) out.push({ q: "Get the shared arrangements (road, water, services) in writing", who: "Your lawyer; the other owners or association", auto: true });
    if (w.reliability === "unknown" || u["water.reliability"] || u["water.tanker"] || u["water.failure"]) out.push({ q: "Ask how supply held up in the last two dry seasons, and what water deliveries cost", who: "Neighbours, the society or association, local tanker suppliers", auto: true });
    if (w.future_connection === "yes" || w.future_connection === "unsure") out.push({ q: "Confirm whether a piped connection is sanctioned, funded and scheduled", who: "The water utility — in writing", auto: true });
    if (w.treatment === "unknown" || w.treatment === "significant" || !isBlank(w.quality) || u["water.quality"]) out.push({ q: "Get a water-quality test done", who: "An accredited water-testing laboratory", auto: true });
    return out;
  }

  function sumSection(title, inner, cls) {
    return '<section class="s-sec' + (cls ? " " + cls : "") + '"><h2 class="s-h">' + esc(title) + "</h2>" + inner + "</section>";
  }
  function sumRows(rows) {
    return '<dl class="s-kv">' + rows.filter(Boolean).map((r) => "<div><dt>" + esc(r[0]) + "</dt><dd>" + (r[2] ? r[1] : ans(r[1])) + "</dd></div>").join("") + "</dl>";
  }
  const WL = '<span class="wl"></span>';
  const list = (items, empty) => (items.length ? "<ul class=\"s-list\">" + items.map((x) => "<li>" + x + "</li>").join("") + "</ul>"
    : '<div class="s-empty"><p class="s-empty-t">' + (empty || "Not yet answered") + "</p>" + WL + WL + WL + "</div>");

  function summaryView(id, transient) {
    if (id && state.cases[id]) { state.current = id; save(); }
    const c = transient || cur();
    if (!c) { location.hash = "#/"; return ""; }
    const d = K.derive(c), m = (v) => money(v, c), O = W.O;
    const cc = W.COUNTRIES[c.market.country] || {};
    const place = [c.market.micro_market, c.market.city, cc.name].filter((x) => !isBlank(x)).join(", ");
    const tags = [optLabel(O.purpose, c.decision.purpose), optLabel(O.status, c.decision.status), optLabel(O.occupancy, c.decision.occupancy), c.decision.holding_years ? c.decision.holding_years + "-year hold" : ""].filter(Boolean);
    const o = overall(c);
    const B = !!transient;
    // Frame fields that are still open print as the spec's tick-box rows.
    const frameRows = [
      !c.decision.purpose ? ["Purpose", boxes(O.purpose)] : null,
      !c.decision.status ? ["Ready?", boxes(O.status)] : null,
      !c.decision.occupancy ? ["Occupancy", boxes(O.occupancy)] : null,
      !c.decision.holding_years ? ["Expected hold", '<span class="blank blank-s">years</span> years'] : null,
      B ? ["Price", BL] : null,
    ].filter(Boolean);

    // Core thesis
    const engines = (c.property.return_engine || []).map((e) => optLabel(O.engines, e)).filter(Boolean);
    const thesis = sumRows([
      ["The job it has to do", c.decision.job],
      ["What creates the return", engines.join(" · ") + (c.dependency.engine_note ? (engines.length ? " — " : "") + c.dependency.engine_note : "")],
      ["Works if", c.close.works_if], ["Struggles if", c.close.struggles_if],
    ]);

    // Reasons & risks
    const reasons = linesOf(c.close.reasons).map(esc);
    const risks = mainRisks(c).map((r) => esc(r.t) + (r.auto ? ' <span class="s-tag">' + esc(r.auto) + "</span>" : ""));

    // Dependencies
    const deps = sumRows([
      ["The assumption it depends on most", c.dependency.key_assumption],
      ["Appreciation being relied on", c.dependency.implied_appr !== undefined && c.dependency.implied_appr !== "" ? tidy(+c.dependency.implied_appr, 1) + "% a year" : (c.unknown["dependency.implied_appr"] ? "Not known yet" : "")],
      d.frictionAppr !== null ? ["Needed just to recover costs", pct(d.frictionAppr) + " a year over " + c.decision.holding_years + " years"] : null,
      ["Already in today's price?", c.market.priced_in],
      ["The system feature that matters most", c.market.system.key_feature],
      outsideDeps(c).length || B ? ["Depends on outside arrangements", outsideDeps(c).join(" · ")] : null,
      B || W.helpers.letting(c) ? ["Rental business without appreciation", c.property.rental_without_appr] : null,
    ]);

    // Choice answers: the label, or tick boxes when still open.
    const pick = (opts, v) => [v ? esc(optLabel(opts, v)) : boxes(opts), 1];
    const row = (label, opts, v) => [label].concat(pick(opts, v));

    // Non-negotiables and preferences
    const gv = c.close.gates || {};
    const gRows = gateRows(c);
    if (B) for (let i = 0; i < 3; i++) gRows.push({ id: "blank" + i, label: "If", household: true, blank: true });
    const gates = '<table class="s-table s-gates"><thead><tr><th>Potential non-negotiable</th><th>Status</th></tr></thead><tbody>' + gRows.map((r) =>
      '<tr class="' + (gv[r.id] === "fails" ? "r-yes" : "") + '"><td>' + (r.blank ? "If " + BL : esc(r.label)) + (r.household ? ' <span class="s-tag">Walk-away</span>' : "") + "</td>" +
      '<td class="' + (gv[r.id] ? "" : "td-bx") + '">' + (gv[r.id] ? esc(optLabel(O.gate, gv[r.id])) : boxes(O.gate)) + "</td></tr>").join("") + "</tbody></table>" +
      (gRows.some((r) => gv[r.id] === "fails") ? '<p class="s-note s-gate-note"><b>A non-negotiable is failing.</b> Strengths elsewhere do not offset it: it has to be resolved, or it is a reason to walk away.</p>' : '<p class="s-note muted">Non-negotiables are pass / fail. They are not traded off against lifestyle positives.</p>') +
      '<h3 class="s-sub">Preferences and trade-offs</h3>' + list(linesOf(c.close.preferences).map(esc));

    // Location, water and access
    const dests = c.destinations.filter((r) => Object.keys(r).some((k) => !isBlank(r[k])));
    const dRows = dests.length ? dests : B ? W.DESTINATIONS.map((x) => ({ dest: x, _blank: true })) : [];
    const cellv = (r, f) => (r._blank ? (f === "dest" ? '<span class="muted">' + esc(r.dest) + "</span>" : BL) : isBlank(r[f]) ? '<span class="muted">—</span>' : esc(f === "alt" ? optLabel(O.altRoute, r[f]) : r[f]));
    const destTable = dRows.length ? '<div class="table-wrap"><table class="s-table s-dest"><thead><tr><th>Destination</th><th>Distance</th><th>Normal</th><th>Peak hour</th><th>Last mile / route</th><th>Alternate?</th></tr></thead><tbody>' +
      dRows.map((r) => "<tr>" + ["dest", "distance", "normal", "peak", "lastmile", "alt"].map((f) => "<td>" + cellv(r, f) + "</td>").join("") + "</tr>").join("") + "</tbody></table></div>"
      : '<p class="s-empty-t muted">No destinations entered.</p>';
    const w = c.water, a = c.access;
    const waterRows = sumRows([
      row("Primary source", W.waterSourceOpts(c), w.source),
      row("Reliability, incl. dry season", O.waterReliability, w.reliability),
      row("Reliance on " + W.waterTerms(c).truckNoun, O.tanker, w.tanker),
      ["Water cost now", isBlank(w.monthly_cost) ? "" : m(w.monthly_cost) + " a month"],
      ["If the primary source fails", w.failure],
      row("Assuming a future connection?", O.futureConn, w.future_connection),
      B || w.treatment || !isBlank(w.quality) ? ["Treatment / quality", [w.treatment ? esc(optLabel(O.treatment, w.treatment)) : "", esc(w.quality || "")].filter(Boolean).join(" — ") || (B ? boxes(O.treatment) : BL), 1] : null,
    ]);
    const accessRows = sumRows([
      row("Legal access", O.legalAccess, a.legal),
      row("Access road", O.road, a.road),
      row("Final approach year-round", O.yearRound, a.year_round),
      row("Depends on third parties", O.thirdParty, a.third_party),
      !isBlank(a.dependency_note) ? ["What depends on someone else", a.dependency_note] : null,
    ]);
    const location = '<h3 class="s-sub">Effective access</h3>' + destTable +
      '<p class="s-reminder">Straight-line distance, map distance and real accessibility are different metrics.</p>' +
      '<div class="s-two s-two-tight"><div><h3 class="s-sub">Water security</h3>' + waterRows + '<p class="s-reminder">Low water cost today does not prove long-term water security.</p></div>' +
      '<div><h3 class="s-sub">Access and dependencies</h3>' + accessRows + '<p class="s-reminder">Ownership rights and functional control are not always the same thing.</p></div></div>';

    // Scenario vulnerability: the location thesis first, then the stress tests.
    const th = c.thesis;
    const scen = '<ul class="s-scen">' + W.SCENARIOS.map((x) => "<li><b>" + x.id + "</b> " + esc(x.title) + ' <span class="muted">— ' + esc(x.text) + "</span></li>").join("") + "</ul>" +
      sumRows([
        row(W.helpers.homeish(c) || B ? "Happy owning this home under Scenario B?" : "Happy owning this property under Scenario B?", O.scenario, th.happy_b),
        row("Finances and life plans survive Scenario C?", O.scenario, th.survive_c),
        B || !isBlank(th.note) ? ["Why", th.note] : null,
      ]);

    // Financing
    const fin = c.financing.mode === "cash" ? sumRows([["Funding", "Cash — no loan"], ["Cash needed now", d.cashNeeded !== null ? m(d.cashNeeded) : ""]]) : sumRows([
      ["Funding", c.financing.mode ? "Loan " + (d.loan ? m(d.loan) : "") + (d.ltv !== null ? " · " + pct(d.ltv, 0) + " of price" : "") : ""],
      ["Rate", c.financing.rate ? c.financing.rate + "% · " + (optLabel(O.rateType, c.financing.rate_type) || "type not stated") + (c.financing.tenure_years ? " · " + c.financing.tenure_years + " years" : "") : ""],
      ["EMI", d.emi ? m(d.emi) + " a month" + (d.debtServiceRatio !== null ? " · all debt payments " + pct(d.debtServiceRatio, 0) + " of income" : "") : ""],
      d.rateShockApplies && d.emiPlus2 !== null ? ["If rates rise 2 points", m(d.emiPlus2) + " a month (+" + m(d.emiPlus2Delta) + ")"] : null,
      ["Can it stay invested through a flat market?", c.financing.stay_invested],
    ]);

    // Liquidity & concentration
    const optsLost = (c.household.options_lost || []).map((x) => (x === "other" ? c.household.options_other || "Other" : optLabel(O.optionsLost, x))).filter(Boolean);
    const liq = sumRows([
      ["Cash needed at acquisition", d.cashNeeded !== null ? m(d.cashNeeded) : ""],
      ["Liquid assets after purchase", d.postLiquid !== null ? m(d.postLiquid) + (d.minLiquid !== null ? (d.belowFloor ? " — below my floor of " + m(d.minLiquid) : " · my floor is " + m(d.minLiquid)) : "") : ""],
      d.monthsCovered !== null ? ["If income stopped", "≈ " + tidy(d.monthsCovered, 1) + " months of outgoings covered"] : null,
      ["Net worth in real estate", d.reShareNet !== null ? "≈ " + pct(d.reShareNet, 0) : ""],
      ["Dependence on one city", c.household.city_exposure],
      ["Options that disappear", optsLost.join(" · ")],
      ["Could we need this capital?", optLabel(O.likelihood, c.household.need_capital) + (c.household.need_capital_why ? " — " + c.household.need_capital_why : "")],
    ]);

    // Zero-Appreciation
    const why = (c.life.zat_why || []).map((x) => optLabel(O.utility, x)).filter(Boolean);
    const zq = B || W.helpers.homeish(c) ? "If this home never appreciated in real terms, would we still want it?" : "If this property never appreciated in real terms, would we still want to own it?";
    const zat = (c.life.zat ? '<p class="s-zat"><span class="s-zat-a s-zat-' + esc(c.life.zat) + '">' + esc(optLabel(O.zat, c.life.zat)) + "</span><span>" + zq + "</span></p>"
      : '<p class="s-zat"><span>' + zq + "</span>" + boxes(O.zat) + "</p>") +
      sumRows([
        why.length ? ["Because of", why.join(" · ")] : B ? ["Because of", boxes(O.utility), 1] : null,
        B || W.helpers.homeish(c) ? ["The life problem it solves", c.life.life_problem] : null,
        c.dependency.zero_ok ? ["At zero appreciation, the job is done", optLabel(O.yesPartlyNo, c.dependency.zero_ok)] : ["At zero appreciation, the job is done", boxes(O.yesPartlyNo), 1],
        d.premium !== null ? ["Housing-Consumption Premium", m(d.premium) + " over the least expensive home that would satisfy us (" + pct(d.premiumShare, 0) + " of price)"] : null,
        ["The realistic alternative", [optLabel(O.alt, c.life.alt_type), c.life.alt_note].filter((x) => !isBlank(x)).join(" — ")],
      ]);

    // Stress table
    const stress = '<table class="s-table"><thead><tr><th>Scenario</th><th>What happens</th><th>Breaks?</th></tr></thead><tbody>' + W.STRESSES.map((s) => {
      const st = (c.stress || {})[s.id] || {};
      if (!B && s.na && s.na(c)) return "";
      const facts = B ? "" : stressFacts(s.id, c, d);
      const opts = B && s.na ? [["na", "N/A"]].concat(O.breaks) : O.breaks;
      return '<tr class="' + (st.breaks === "yes" ? "r-yes" : st.breaks === "maybe" ? "r-maybe" : "") + '"><td>' + esc(s.short) + "</td><td>" + (st.note ? esc(st.note) : facts && !/^Add /.test(facts) ? '<span class="muted">' + esc(facts) + "</span>" : BL) + '</td><td class="' + (st.breaks ? "" : "td-bx") + '">' + (st.breaks ? esc(optLabel(O.breaks, st.breaks)) : boxes(opts)) + "</td></tr>";
    }).join("") + "</tbody></table>" + '<p class="s-note"><b>What would force a sale, new debt or selling long-term assets:</b> ' + ans(c.stress.forcing) + "</p>";

    // Profile
    const prof = '<div class="s-prof">' + W.PROFILE.map((p) => {
      const v = (c.close.profile || {})[p.id];
      return '<div class="s-prof-c' + (p.warn.indexOf(v) >= 0 ? " is-warn" : "") + '"><span>' + esc(p.label) + "</span>" + (v ? "<b>" + esc(optLabel(p.opts, v)) + "</b>" : boxes(p.opts)) + "</div>";
    }).join("") + "</div>";

    // Unresolved
    const unresolved = (c.close.open || []).filter((q) => !isBlank(q.q)).map((q) => esc(q.q));
    unknownList(c).forEach((u) => { if (!(c.close.open || []).some((q) => q.from === u.k)) unresolved.push(esc(u.label) + ' <span class="s-tag">Marked unknown</span>'); });
    if (!isBlank(c.close.still_need)) unresolved.push(esc(c.close.still_need) + ' <span class="s-tag">Still need to know</span>');

    const walks = c.walkaway.filter((w) => !isBlank(w)).map((w) => "If " + esc(sentence(w).replace(/^if\s+/i, "")) + ".");
    const actions = nextActions(c).map((a) => "<b>" + esc(a.q) + "</b>" + (a.who ? '<span class="s-who">' + esc(a.who) + "</span>" : ""));

    const bar = transient
      ? '<a class="btn-ghost small" href="#/">← Home</a><span class="sum-bar-note">A blank worksheet: every prompt prints as a write-in line, for working through it on paper.</span><span class="sum-actions">'
      : '<a class="btn-ghost small" href="#/w/read">← Back to the worksheet</a><span class="sum-bar-note">' + o.done + " of " + o.total + ' key prompts answered. Blanks print as write-in lines.</span><span class="sum-actions"><button class="btn-ghost small" data-act="export">Save a copy (file)</button>';
    return '<main class="wrap summary-wrap"><div class="sum-bar">' + bar + '<button class="btn btn-gold small" data-act="print">Print / save as PDF</button></span></div>' +
      '<article class="sheet">' +
      '<header class="s-head"><div class="s-brand"><img src="favicon.png" alt="" width="20" height="20" /><span>Zenca · Real Estate Reframed</span><span class="s-doc">Property Decision Worksheet</span></div>' +
      (B ? '<p class="s-lab s-lab-top">Property / project</p>' : "") +
      '<h1 class="s-title">' + ans(c.property.name) + "</h1>" +
      '<p class="s-place">' + (B ? '<span class="s-lab">City / micro-market</span> ' + BL : (place ? esc(place) : BL) + (c.property.purchase_price ? ' <span class="s-price">' + esc(m(c.property.purchase_price)) + "</span>" : "")) + "</p>" +
      (tags.length ? '<p class="s-tags">' + tags.map((t) => "<span>" + esc(t) + "</span>").join("") + "</p>" : "") +
      (frameRows.length ? sumRows(frameRows.map((r) => [r[0], r[1], 1])) : "") +
      '<p class="s-meta">' + (B ? '<span class="s-lab">Working through this</span> ' + BL + ' <span class="s-lab">Date</span> <span class="blank blank-s">date</span>' : esc([c.meta.people, c.meta.date ? new Date(c.meta.date + "T00:00").toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : ""].filter(Boolean).join(" · "))) + "</p></header>" +
      '<section class="s-statement">' + statementHTML(c, false) + "</section>" +
      sumSection("Core thesis", thesis) +
      '<div class="s-two">' + sumSection("Strongest reasons to buy", list(reasons)) + sumSection("Main risks and concerns", list(risks)) + "</div>" +
      sumSection("Non-negotiables and preferences", gates, "s-gatesec") +
      sumSection("Critical dependencies", deps) +
      sumSection("Location, water and access", location) +
      '<div class="s-two">' + sumSection("Financing exposure", fin) + sumSection("Liquidity and concentration", liq) + "</div>" +
      sumSection("Zero-Appreciation response", zat) +
      sumSection("Scenario vulnerability", '<h3 class="s-sub">The location thesis</h3>' + scen + '<h3 class="s-sub">Stress tests</h3>' + stress, "s-break") +
      sumSection("Decision profile — no score, no verdict", prof) +
      '<div class="s-two">' + sumSection("Unresolved questions", list(unresolved, "Nothing marked unresolved.")) + sumSection("Walk-away conditions", list(walks)) + "</div>" +
      sumSection("Next diligence actions", list(actions, "Add open questions with an owner in Chapter 8."), "s-actions") +
      '<footer class="s-foot"><p>The point is not to make uncertainty disappear. It is to make the uncertainty visible before you choose it.</p><p class="s-fine">A good property is not automatically a good purchase. The asset is only half the decision; the buyer is the other half. Educational content — not financial, investment, tax or legal advice. Hand checks are rough and exclude tax.</p>' +
      '<p class="s-fine s-cite">Companion to ' + esc(W.ARTICLE.series) + ', Article ' + W.ARTICLE.n + ': “' + esc(W.ARTICLE.title) + '” — the full framework behind every question on this sheet.</p></footer>' +
      "</article>" +
      '<div class="sum-onward">' +
      '<div class="sum-next card soft"><div><h3>The framework behind it</h3><p class="muted-p">Every question here comes from Article ' + W.ARTICLE.n + ', <i>' + esc(W.ARTICLE.title) + '</i>, which explains why the asset is only half the decision and the buyer is the other half.</p></div>' + articleLinkHTML("btn-ghost", "Read Article " + W.ARTICLE.n + " →") + "</div>" +
      '<div class="sum-next card soft"><div><h3>Want the deeper diagnostic?</h3><p class="muted-p">The <b>Property Decision X-Ray</b> reconstructs the return, separates asset and equity returns, runs combined stresses and shows the balance sheet path year by year — using the same Country → City → Property → Person structure.' + (toolUrl("xray") ? " Your answers here travel with you." : TOOLS.xray ? xrayOpensNote() : "") + '</p></div>' + (toolUrl("xray") && !transient ? '<button class="btn" data-act="toxray">Open this in the X-Ray →</button>' : "") + "</div>" +
      "</div></main>";
  }

  /* ---------- Hand-off with the other tools ----------------------- */
  // Translation lives in handoff.js; this is the transport. Tools that share
  // an origin pass cases through each other's localStorage.

  const fromXRay = (x) => H.fromXRay(x, blank);
  const TOOLS = { xray: null, fingerprint: null };

  // Find sibling tools. On the deployed site, window.ZencaSite (the site's
  // shared script) knows where they are; otherwise probe the candidate
  // folders. Links and buttons to a tool appear only once it is found.
  const site = () => window.ZencaSite || null;

  // Article 14 link: the site script owns article URLs. Falls back to the
  // series page, and to plain text when neither is known yet.
  function articleUrl() {
    const l = (site() && site().links) || {};
    return l.article14 || l.series || null;
  }
  function articleLinkHTML(cls, label) {
    const u = articleUrl();
    return u ? '<a class="' + cls + '" href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(label) + "</a>" : "";
  }
  // Article -> worksheet -> X-Ray, shown on the landing page.
  function journeyHTML() {
    const a = articleUrl(), x = toolUrl("xray");
    const step = (k, title, text, href, ext) => '<li class="jr-step"><span class="jr-k">' + k + "</span>" +
      (href ? '<a href="' + esc(href) + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + "><b>" + title + "</b></a>" : "<b>" + title + "</b>") + "<span>" + text + "</span></li>";
    return '<ol class="journey" aria-label="Where this fits">' +
      step("Read", "Article " + W.ARTICLE.n + " · " + esc(W.ARTICLE.title), "The full framework: the asset is only half the decision.", a, true) +
      step("Work through", "This worksheet", "The lighter, hands-on version: your property, your household, your answers.", null) +
      step("Go deeper", "Property Decision X-Ray", "The full diagnostic, when you want the numbers worked out.", x, false) +
      "</ol>";
  }
  // "Opens on 7 December 2026" when the site knows the date.
  function xrayOpensNote() {
    const d = site() && typeof site().opensAt === "function" ? site().opensAt("xray") : null;
    const when = d && typeof d.getTime === "function" && !isNaN(d.getTime()) ? " on " + d.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : " soon";
    return " It opens" + when + " — this worksheet will be ready to send across when it does.";
  }
  function discoverTools() {
    const links = (site() && site().links) || {};
    Object.keys(H.TOOL_CANDIDATES).forEach((tool) => { if (links[tool]) TOOLS[tool] = links[tool]; });
    if (!window.fetch || location.protocol === "file:") return;
    Object.keys(H.TOOL_CANDIDATES).filter((tool) => !TOOLS[tool]).forEach((tool) => {
      const tryNext = (i) => {
        const base = H.TOOL_CANDIDATES[tool][i];
        if (!base) return;
        fetch(base + "index.html", { method: "HEAD", cache: "no-store" })
          .then((r) => { if (r.ok) { TOOLS[tool] = base; applyToolLinks(); rerender(); } else tryNext(i + 1); })
          .catch(() => tryNext(i + 1));
      };
      tryNext(0);
    });
  }
  // A tool that exists but is still before its unlock date counts as closed.
  const toolOpen = (tool) => !!TOOLS[tool] && !(site() && typeof site().isOpen === "function" && site().isOpen(tool) === false);
  const toolUrl = (tool) => (toolOpen(tool) ? TOOLS[tool] : null);

  function applyToolLinks() {
    document.querySelectorAll("[data-tool]").forEach((a) => {
      const base = toolUrl(a.dataset.tool);
      a.hidden = !base;
      if (base) a.href = base;
    });
  }

  function readXRay() {
    try { const s = JSON.parse(localStorage.getItem(H.XRAY_STORE)); if (s && s.cases) return s; } catch (e) { /* none */ }
    return { cases: {}, current: null };
  }

  // Worksheet -> X-Ray: refresh the X-Ray's copy of this worksheet (or create
  // one), make it current there, and open the X-Ray on its review step.
  function sendToXRay(c) {
    if (!toolOpen("xray")) return;
    const xs = readXRay();
    const incoming = H.toXRay(c);
    let id = Object.keys(xs.cases).find((k) => ((xs.cases[k] || {}).meta || {}).worksheet_id === c.meta.id);
    if (id) H.mergeInto(xs.cases[id], incoming);
    else { id = "w" + Date.now().toString(36); xs.cases[id] = incoming; }
    xs.cases[id].meta.updated = new Date().toISOString();
    xs.cases[id].meta.created = xs.cases[id].meta.created || xs.cases[id].meta.updated;
    xs.current = id;
    try { localStorage.setItem(H.XRAY_STORE, JSON.stringify(xs)); } catch (e) { alert("This browser blocked saving the case for the X-Ray."); return; }
    track("event/open-in-xray", true);
    location.href = TOOLS.xray + "#/case/review";
  }

  // X-Ray -> worksheet (#/from-xray/<case id>): the first time, a new
  // worksheet; after that, the same worksheet refreshed with the X-Ray's
  // values, keeping everything only the worksheet holds.
  function receiveFromXRay(xid) {
    const x = readXRay().cases[xid];
    if (!x) return false;
    const incoming = normalise(fromXRay(x));
    const existing = Object.keys(state.cases).find((k) => (state.cases[k].meta || {}).xray_id === xid)
      || (x.meta && x.meta.worksheet_id && state.cases[x.meta.worksheet_id] ? x.meta.worksheet_id : null);
    if (existing) {
      delete incoming.meta;
      H.mergeInto(state.cases[existing], incoming);
      state.cases[existing].meta.xray_id = xid;
      state.current = existing; save();
    } else {
      incoming.meta.xray_id = xid;
      openCase(incoming);
    }
    track("event/from-xray", true);
    return true;
  }

  /* ---------- Analytics hook ------------------------------------------ */
  // Counts anonymous page views only when the GoatCounter script is on the
  // page (added at deployment). Paths carry the tool prefix and never a
  // worksheet id or anything the user typed.
  // Prefers the site's ZencaSite.track (which adds the /worksheet prefix and
  // waits for GoatCounter itself); otherwise counts directly, retrying briefly
  // while the async GoatCounter script is still loading.
  const ANALYTICS_PREFIX = "/worksheet";
  function track(path, isEvent, attempt) {
    path = String(path).replace(/^\//, "");
    try {
      if (site() && typeof site().track === "function") return site().track(path, !!isEvent);
      const gc = window.goatcounter;
      if (gc && typeof gc.count === "function") return gc.count({ path: ANALYTICS_PREFIX + "/" + path, title: isEvent ? path : document.title.split(" — ")[0], event: !!isEvent });
      if (!document.querySelector || !document.querySelector("script[data-goatcounter]")) return; // no analytics on this page
      if ((attempt || 0) < 20) setTimeout(() => track(path, isEvent, (attempt || 0) + 1), 500);
    } catch (e) { /* analytics never breaks the worksheet */ }
  }
  function trackRoute() {
    const parts = location.hash.replace(/^#\/?/, "").split("/");
    const map = { "": "", w: "w/" + (parts[1] || "frame"), summary: "summary", blank: "blank", example: "example/" + (parts[1] || "") };
    if (map[parts[0]] !== undefined) track(map[parts[0]]);
  }

  /* ---------- Router ----------------------------------------------- */

  function route() {
    const h = location.hash.replace(/^#\/?/, "");
    const parts = h.split("/");
    let html;
    document.body.classList.remove("is-summary");
    if (parts[0] === "open" && state.cases[parts[1]]) { state.current = parts[1]; save(); location.replace("#/w/frame"); return; }
    if (parts[0] === "example" && W.EXAMPLES[parts[1]]) { openExample(parts[1]); location.replace("#/summary"); return; }
    if (parts[0] === "from-xray") { location.replace(receiveFromXRay(decodeURIComponent(parts[1] || "")) ? "#/w/frame" : "#/"); return; }
    if (parts[0] === "w") html = chapterView(parts[1]);
    else if (parts[0] === "blank") { html = summaryView(null, normalise(blank())); document.body.classList.add("is-summary"); }
    else if (parts[0] === "summary") { html = summaryView(parts[1]); document.body.classList.add("is-summary"); }
    else html = landing();
    if (!html) return;
    app.innerHTML = html;
    app.querySelectorAll("textarea.lined").forEach(grow);
    const c = cur();
    document.title = (parts[0] === "w" || parts[0] === "summary") && c ? titleOf(c) + " — Property Decision Worksheet" : "Property Decision Worksheet — Real Estate Reframed";
  }

  // Lined notes grow with what is written, so an answer is never hidden.
  function grow(t) {
    if (!t.offsetWidth) { t.style.height = ""; return; } // not laid out yet (hidden tab, closed section)
    t.style.height = "auto";
    t.style.height = Math.max(t.scrollHeight + 2, 42) + "px";
  }

  function rerender() {
    const y = window.scrollY;
    const ae = document.activeElement;
    const key = ae && (ae.dataset.choice || ae.dataset.multi || ae.dataset.sig || ae.dataset.prof || ae.dataset.stress) ? ae.dataset : null;
    route();
    window.scrollTo(0, y);
    if (key) {
      const sel = Object.keys(key).map((k) => "[data-" + k.replace(/[A-Z]/g, (ch) => "-" + ch.toLowerCase()) + '="' + key[k] + '"]').join("");
      const el = app.querySelector(sel);
      if (el) el.focus({ preventScroll: true });
    }
  }

  function refreshCalcs() {
    const c = cur();
    if (!c) return;
    app.querySelectorAll("[data-calc]").forEach((el) => {
      const k = el.dataset.calc;
      if (CALC[k]) el.innerHTML = CALC[k](c);
      else if (k === "statement") el.innerHTML = statementHTML(c, true);
      else if (k.indexOf("st-") === 0) el.innerHTML = stressFacts(k.slice(3), c, K.derive(c));
    });
    const active = (location.hash.match(/#\/w\/(\w+)/) || [])[1];
    const st = app.querySelector(".stepper");
    if (st && active) st.outerHTML = stepper(c, active);
  }

  /* ---------- Events ----------------------------------------------- */

  app.addEventListener("input", (e) => {
    const t = e.target, c = cur();
    if (!c) return;
    if (t.tagName === "TEXTAREA") grow(t);
    if (t.dataset.k && t.dataset.t !== "select") {
      const k = t.dataset.k, ty = t.dataset.t;
      if (ty === "money") {
        const v = parseMoney(t.value);
        t.classList.toggle("bad-input", Number.isNaN(v));
        if (Number.isNaN(v)) return;
        set(c, k, v);
        const echo = app.querySelector('[data-echo="' + k + '"]');
        if (echo) echo.textContent = v !== "" && v >= 1e5 ? "≈ " + money(v, c) : "";
      } else if (ty === "num" || ty === "pct") {
        const s = t.value.trim().replace(/[%,\s]/g, "");
        const v = s === "" ? "" : +s;
        t.classList.toggle("bad-input", s !== "" && isNaN(v));
        if (s !== "" && isNaN(v)) return;
        set(c, k, v);
      } else set(c, k, t.value);
      save(); refreshCalcs();
      return;
    }
    if (t.dataset.signote) { c.market.signals[t.dataset.signote] = Object.assign({}, c.market.signals[t.dataset.signote], { note: t.value }); save(); return; }
    if (t.dataset.comp) {
      const [i, f] = t.dataset.comp.split(".");
      let v = t.value;
      if (f === "price") { v = parseMoney(v); t.classList.toggle("bad-input", Number.isNaN(v)); if (Number.isNaN(v)) return; }
      c.property.comps[+i][f] = v; save(); refreshHint(); return;
    }
    if (t.dataset.wa !== undefined) { c.walkaway[+t.dataset.wa] = t.value; save(); return; }
    if (t.dataset.dest) { const [i, f] = t.dataset.dest.split("."); c.destinations[+i][f] = t.value; save(); return; }
    if (t.dataset.oq) { const [i, f] = t.dataset.oq.split("."); c.close.open[+i][f] = t.value; save(); return; }
  });

  function refreshHint() {
    const c = cur();
    const f = app.querySelector('[data-choice="property.price_evidence"]');
    if (!f) return;
    const wrap = f.closest(".field");
    const old = wrap.querySelector(".suggest");
    if (old) old.remove();
    wrap.insertAdjacentHTML("beforeend", hint("evidence", c));
  }

  app.addEventListener("change", (e) => {
    const t = e.target, c = cur();
    if (t.id === "importFile") return importFile(t.files[0]);
    if (!c) return;
    if (t.dataset.t === "select") {
      set(c, t.dataset.k, t.value);
      if (t.dataset.k === "market.country") { const cc = W.COUNTRIES[t.value]; if (cc && cc.currency) c.market.currency = cc.currency; }
      save(); rerender(); return;
    }
    if (t.dataset.dest && t.tagName === "SELECT") { const [i, f] = t.dataset.dest.split("."); c.destinations[+i][f] = t.value; save(); return; }
    if (t.dataset.comp && t.tagName === "SELECT") { const [i, f] = t.dataset.comp.split("."); c.property.comps[+i][f] = t.value; save(); refreshHint(); return; }
    if (t.dataset.comp && t.type === "month") { const [i, f] = t.dataset.comp.split("."); c.property.comps[+i][f] = t.value; save(); refreshHint(); return; }
    // Re-format money with digit grouping once the reader leaves the field.
    if (t.dataset.t === "money") {
      const v = t.dataset.k ? get(c, t.dataset.k) : t.dataset.comp ? c.property.comps[+t.dataset.comp.split(".")[0]].price : "";
      if (v !== "" && v !== undefined && !isNaN(v)) t.value = grouped(v, c);
    }
  });

  app.addEventListener("click", (e) => {
    const b = e.target.closest("button, a[data-act]");
    if (!b) return;
    const c = cur(), ds = b.dataset;
    if (ds.act) return act(ds.act, ds.v, b);
    if (!c) return;
    if (ds.choice) { set(c, ds.choice, get(c, ds.choice) === ds.v ? "" : ds.v); if (c.unknown[ds.choice]) delete c.unknown[ds.choice]; save(); return rerender(); }
    if (ds.multi) {
      const arr = (get(c, ds.multi) || []).slice(), i = arr.indexOf(ds.v);
      if (i >= 0) arr.splice(i, 1); else arr.push(ds.v);
      set(c, ds.multi, arr); save(); return rerender();
    }
    if (ds.unk) { if (c.unknown[ds.unk]) delete c.unknown[ds.unk]; else c.unknown[ds.unk] = true; save(); return rerender(); }
    if (ds.sig) { const s = c.market.signals[ds.sig] || {}; c.market.signals[ds.sig] = Object.assign({}, s, { status: s.status === ds.v ? "" : ds.v }); save(); return rerender(); }
    if (ds.stress) { const s = c.stress[ds.stress] || {}; c.stress[ds.stress] = Object.assign({}, s, { breaks: s.breaks === ds.v ? "" : ds.v }); save(); return rerender(); }
    if (ds.prof) { c.close.profile[ds.prof] = c.close.profile[ds.prof] === ds.v ? "" : ds.v; save(); return rerender(); }
    if (ds.useprof) { c.close.profile[ds.useprof] = ds.v; save(); return rerender(); }
    if (ds.sethint) { set(c, ds.sethint, ds.v); save(); return rerender(); }
    if (ds.waadd) { c.walkaway.push(""); save(); rerender(); const els = app.querySelectorAll("[data-wa]"); if (els.length) els[els.length - 1].focus(); return; }
    if (ds.wadel !== undefined) { c.walkaway.splice(+ds.wadel, 1); save(); return rerender(); }
    if (ds.gate) { c.close.gates[ds.gate] = c.close.gates[ds.gate] === ds.v ? "" : ds.v; save(); return rerender(); }
    if (ds.destadd !== undefined) {
      const empty = ds.destadd ? c.destinations.findIndex((r) => Object.keys(r).every((k) => isBlank(r[k]))) : -1;
      if (empty >= 0) c.destinations[empty].dest = ds.destadd; else c.destinations.push(ds.destadd ? { dest: ds.destadd } : {});
      save(); rerender(); return;
    }
    if (ds.destdel !== undefined) { c.destinations.splice(+ds.destdel, 1); save(); return rerender(); }
    if (ds.oqadd) { c.close.open.push({ q: "", who: "" }); save(); rerender(); const els = app.querySelectorAll('[data-oq$=".q"]'); if (els.length) els[els.length - 1].focus(); return; }
    if (ds.oqdel !== undefined) { c.close.open.splice(+ds.oqdel, 1); save(); return rerender(); }
    if (ds.promote) {
      const u = unknownList(c).find((x) => x.k === ds.promote);
      c.close.open.push({ q: u ? u.label : "", who: "", from: ds.promote }); save(); rerender();
      const els = app.querySelectorAll('[data-oq$=".who"]'); if (els.length) els[els.length - 1].focus();
    }
  });

  // Reopen this browser's copy of an example if there is one; otherwise start it fresh.
  function openExample(v) {
    const existing = Object.keys(state.cases).find((id) => (state.cases[id].meta || {}).example === v);
    if (existing) { state.current = existing; save(); return; }
    const ex = clone(W.EXAMPLES[v]);
    ex.meta.date = today();
    openCase(ex);
  }

  function act(a, v) {
    if (a === "new") { openCase(blank()); location.hash = "#/w/frame"; return; }
    if (a === "example") { openExample(v); location.hash = "#/summary"; return; }
    if (a === "del") {
      if (!confirm("Delete this worksheet from this browser? This cannot be undone.")) return;
      delete state.cases[v]; if (state.current === v) state.current = null; save(); return rerender();
    }
    if (a === "print") { track("event/print", true); return window.print(); }
    if (a === "export") {
      const c = cur(); if (!c) return;
      track("event/export-file", true);
      const blob = new Blob([JSON.stringify({ kind: "zenca.property-decision-worksheet", version: 1, worksheet: c }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob), aEl = document.createElement("a");
      aEl.href = url; aEl.download = (titleOf(c).replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "worksheet") + ".json";
      document.body.appendChild(aEl); aEl.click(); aEl.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    if (a === "import") { const f = document.getElementById("importFile"); if (f) f.click(); return; }
    if (a === "fromxray") { if (receiveFromXRay(v)) location.hash = "#/w/frame"; return; }
    if (a === "toxray") { const c = cur(); if (c) sendToXRay(c); return; }
  }

  function importFile(file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        const xcase = data && data.kind === H.FILE_KIND_XRAY ? data.case : data && data.decision && data.market && data.scenarios ? data : null;
        const ws = data && data.kind === H.FILE_KIND_WORKSHEET ? data.worksheet : xcase ? fromXRay(xcase) : null;
        if (!ws) throw new Error("not a worksheet");
        openCase(ws); location.hash = "#/w/frame";
      } catch (err) { alert("That file isn't a Property Decision Worksheet."); }
    };
    r.readAsText(file);
  }

  // Notes inside a collapsed section can only be measured once it opens.
  app.addEventListener("toggle", (e) => { if (e.target.open) e.target.querySelectorAll("textarea.lined").forEach(grow); }, true);

  // Wrapping changes with width, so re-measure the notes when it changes.
  let growT = null;
  window.addEventListener("resize", () => { clearTimeout(growT); growT = setTimeout(() => app.querySelectorAll("textarea.lined").forEach(grow), 120); });

  window.addEventListener("hashchange", () => { route(); trackRoute(); window.scrollTo(0, 0); });
  // Sibling links first (synchronous when the site script provides them),
  // so the first render already shows them; probing re-renders later.
  discoverTools();
  route();
  applyToolLinks();
  trackRoute();

  // Exposed for the validation harness.
  window.WSApp = { fromXRay, receiveFromXRay, sendToXRay, TOOLS, toolOpen, track, blank, normalise, mainRisks, nextActions, profileHints, unknownList, gateRows, outsideDeps };
})();
