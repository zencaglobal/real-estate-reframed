/* ============================================================
   Housing System Fingerprint — interface
   One page, hash-routed, no build step.

   Routes
     #/                  Start here: context and overview (v2.0)
     #/compare?c=IN,CN   Compare: steps 1-3 (buying in, what it depends on, why)
     #/explore?v=glance  6 questions (one per group); #/explore?v=dims all 24 features,
                         1 to 4 countries, largest-differences control
     #/why-prices-move   Same price move, different causes (rise, fall, leverage)
     #/country/JP        single-country profile
     #/method            methodology, sources, change log

   Query state (shareable): c=IN,CN,JP,US · v=glance|dims ·
   f=all|A..F · diff=1 · gap=3 · d=d07 · m=rise|fall|leverage
   No derived score is ever encoded, because none exists.
   ============================================================ */

(function () {
  "use strict";
  const H = window.HSF;
  const $app = document.getElementById("app");
  const $drawer = document.getElementById("drawer");
  const $scrim = document.getElementById("drawer-scrim");
  const $announce = document.getElementById("announce");

  const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
  const COUNTRIES = H.countries.slice().sort((a, b) => a.order - b.order);
  const C = byId(COUNTRIES);
  const DIM = byId(H.dimensions);
  const FAM = byId(H.families);
  const LENS = byId(H.lenses);
  const SRC = Object.fromEntries(H.sources.map((s) => [s.source_id, s]));
  const ALL = COUNTRIES.map((c) => c.id);
  const MOBILE = window.matchMedia("(max-width: 720px)");

  /* ---------------- state ---------------- */
  const S = { route: "home", c: ALL.slice(), pick: [], v: "glance", f: "A", s: "m-what", sg: "IN", diff: false, gap: 4, d: null, m: "rise", country: null, with: null };
  const METHOD_SECTIONS = [["m-what", "What it is"], ["m-place", "Placement method"], ["m-conf", "Confidence"], ["m-evidence", "Evidence standards"], ["m-limits", "Comparability & uncertainty"], ["m-design", "Framework decisions"], ["m-update", "Update policy"], ["m-not", "What it does not do"], ["m-sources", "Sources"]];
  const HOME_DEFAULT = ["IN", "CN"]; // default home comparison; the reader can change it
  const HOME_MAX = 2;
  const open = new Set(); // expanded feature rows
  let drawerState = null; // { cid, did, returnTo }

  /* ---------------- helpers ---------------- */
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const cnames = (ids) => {
    const n = ids.map((id) => C[id].name);
    return n.length <= 1 ? n.join("") : n.slice(0, -1).join(", ") + " and " + n[n.length - 1];
  };
  const announce = (msg) => { $announce.textContent = ""; setTimeout(() => ($announce.textContent = msg), 30); };

  /* Site integration (output/_shared/site.js). Optional: absent in single-tool
     previews, so every call degrades to nothing. */
  const siteLink = (key) => { const z = window.ZencaSite; return (z && z.links && z.links[key]) || null; };
  const track = (name) => { try { const z = window.ZencaSite; if (z && z.track) z.track(name, true); } catch (e) { /* analytics never breaks the tool */ } };
  const EXTERNAL = { series: true, article3: true, article13: true, article14: true };
  // Staged unlock (F-12): sibling tools are linked only once open. Without site.js, treat them as open.
  const TOOL_OF = { xray: "xray", worksheet: "worksheet" };
  const isOpen = (tool) => { try { const z = window.ZencaSite; return !(z && z.isOpen) || z.isOpen(tool) !== false; } catch (e) { return true; } };
  function opensNote(key) {
    const tool = TOOL_OF[key];
    if (!tool || isOpen(tool)) return "";
    let d = null;
    try { const z = window.ZencaSite; d = z && z.opensAt ? z.opensAt(tool) : null; } catch (e) { d = null; }
    return d instanceof Date && !isNaN(d) ? `Opens ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : "";
  }
  // Text with an optional link: plain text until the URL exists.
  function maybeLink(key, text) {
    const u = siteLink(key);
    if (!u || (TOOL_OF[key] && !isOpen(TOOL_OF[key]))) return esc(text);
    return `<a href="${esc(u)}"${EXTERNAL[key] ? ' target="_blank" rel="noopener"' : ""}>${esc(text)}</a>`;
  }
  // Series-wide Methodology & Concepts page (F-13), at its Fingerprint entry. Distinct from this tool's own #/method.
  function seriesMethodHref() {
    const u = siteLink("methodology");
    if (!u || u.indexOf("#") !== -1) return null;
    return u + "#housing-system-fingerprint";
  }
  function shape(c, size) {
    const s = size || 16, h = s / 2, col = c.color, ring = "#15171d";
    const common = `fill="${col}" stroke="${ring}" stroke-width="1.5"`;
    let g;
    if (c.shape === "square") g = `<rect x="2" y="2" width="${s - 4}" height="${s - 4}" rx="2" ${common}/>`;
    else if (c.shape === "diamond") g = `<polygon points="${h},1 ${s - 1},${h} ${h},${s - 1} 1,${h}" ${common}/>`;
    else if (c.shape === "triangle") g = `<polygon points="${h},1.5 ${s - 1.5},${s - 2} 1.5,${s - 2}" ${common}/>`;
    else g = `<circle cx="${h}" cy="${h}" r="${h - 1.5}" ${common}/>`;
    return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" aria-hidden="true" focusable="false">${g}</svg>`;
  }
  const badge = (c, withName) => `<span class="cb">${shape(c, 14)}${esc(c.id)}${withName ? ` <span class="cb-name">${esc(c.name)}</span>` : ""}</span>`;

  const slot = (tok) => (H.POSITIONS[tok] ? H.POSITIONS[tok].slot : null);
  function placement(cid, did) {
    const c = C[cid], p = (c.placements && c.placements[did]) || { pos: "NA", conf: "interpretive", src: [], short: H.copy.uncertainty, long: "" };
    return Object.assign({ as_of: c.profile_as_of, reviewer_status: "Launch placement: Fingerprint v1.0" }, p);
  }
  function posPhrase(d, tok) {
    switch (tok) {
      case "L": return `at the “${d.left}” end`;
      case "ML": return `leaning toward “${d.left}”`;
      case "M": return `between “${d.left}” and “${d.right}”`;
      case "MR": return `leaning toward “${d.right}”`;
      case "R": return `at the “${d.right}” end`;
      default: return H.copy.uncertainty;
    }
  }
  const markerLabel = (c, d, tok) => `${c.name}, ${d.name}: ${H.POSITIONS[tok].label}, ${posPhrase(d, tok)}. ${H.copy.evidenceCta}`;

  /* Structural distance between selected placements on one feature.
     Used ONLY to emphasise "largest structural differences" (spec §7).
     It compares countries' positions on a single spectrum; it never
     ranks countries and is never displayed. */
  function isLargeDifference(did, ids) {
    const slots = ids.map((id) => slot(placement(id, did).pos)).filter((x) => x !== null);
    if (slots.length < 2) return false;
    return Math.max.apply(null, slots) - Math.min.apply(null, slots) >= S.gap;
  }
  // Reader-chosen gap (F-10): 4 = opposite ends (default), 3 = three or more positions apart.
  const gapPhrase = () => (S.gap === 4 ? "at opposite ends of the spectrum" : "three or more positions apart");

  /* ---------------- routing ---------------- */
  function parseHash() {
    const raw = location.hash.replace(/^#/, "") || "/";
    const [path, qs] = raw.split("?");
    const parts = path.split("/").filter(Boolean);
    const q = new URLSearchParams(qs || "");
    S.route = parts[0] === "country" && C[(parts[1] || "").toUpperCase()] ? "country"
      : parts[0] === "method" ? "method"
      : parts[0] === "explore" ? "explore"
      : parts[0] === "compare" ? "home"
      : parts[0] === "how-to-read" ? "read"
      : parts[0] === "why-prices-move" || parts[0] === "background" ? "moves" // #/background: earlier v2.0 preview name
      : q.get("c") ? "home" // old v2.0 preview links like #/?c=IN,US open the Compare page
      : "intro"; // #/, #/guide and anything else: the context and overview page
    S.country = S.route === "country" ? parts[1].toUpperCase() : null;
    const cs = (q.get("c") || "").split(",").map((x) => x.trim().toUpperCase()).filter((x) => C[x]);
    if (S.route === "home") {
      // Keep the order the reader picked, so a third pick replaces the oldest.
      S.pick = (cs.length ? cs : HOME_DEFAULT).filter((x, i, a) => a.indexOf(x) === i).slice(0, HOME_MAX);
      S.c = S.pick.slice(); // [buying in, compare with?]
    } else {
      S.c = cs.length ? ALL.filter((id) => cs.includes(id)) : ALL.slice();
    }
    S.v = q.get("v") === "dims" ? "dims" : "glance";
    S.diff = q.get("diff") === "1";
    S.gap = q.get("gap") === "3" ? 3 : 4;
    S.d = DIM[q.get("d")] ? q.get("d") : null;
    // 24 features are shown one group at a time (A by default; "all" shows every group).
    const fq = q.get("f");
    S.f = FAM[fq] ? fq : fq === "all" ? "all" : S.d ? DIM[S.d].family : "A";
    S.s = METHOD_SECTIONS.some(([id]) => id === q.get("s")) ? q.get("s") : "m-what";
    S.m = ["rise", "fall", "leverage"].includes(q.get("m")) ? q.get("m") : "rise";
    if (S.d) open.add(S.d);
  }
  function stateQuery() {
    const q = new URLSearchParams();
    if (S.c.length !== ALL.length) q.set("c", S.c.join(","));
    if (S.v !== "glance") q.set("v", S.v);
    if (S.v === "dims" && S.f !== "A") q.set("f", S.f);
    if (S.diff) q.set("diff", "1");
    if (S.diff && S.gap !== 4) q.set("gap", String(S.gap));
    if (S.d) q.set("d", S.d);
    const s = q.toString().replace(/%2C/g, ",");
    return s ? "?" + s : "";
  }
  function homeQuery() {
    const q = new URLSearchParams();
    if (S.pick.join() !== HOME_DEFAULT.join()) q.set("c", S.pick.join(","));
    const s = q.toString().replace(/%2C/g, ",");
    return s ? "?" + s : "";
  }
  function writeHash() {
    let h;
    if (S.route === "home") h = "#/compare" + homeQuery();
    else if (S.route === "intro") h = "#/";
    else if (S.route === "read") h = "#/how-to-read";
    else if (S.route === "moves") h = "#/why-prices-move" + (S.m !== "rise" ? "?m=" + S.m : "");
    else if (S.route === "country") h = `#/country/${S.country}` + (S.v === "dims" ? "?v=dims" + (S.f !== "A" ? "&f=" + S.f : "") : "");
    else if (S.route === "method") h = "#/method" + (S.s !== "m-what" ? "?s=" + S.s : "");
    else h = "#/explore" + stateQuery();
    history.replaceState(null, "", h);
  }
  // Home link that carries up to two of the current countries.
  const homeHref = () => {
    const ids = (S.route === "home" ? S.pick : S.c).slice(0, HOME_MAX);
    return ids.length && ids.join() !== HOME_DEFAULT.join() ? `#/compare?c=${ids.join(",")}` : "#/compare";
  };
  const exploreHref = (over) => {
    const keep = Object.assign({}, S);
    Object.assign(S, over);
    const h = "#/explore" + stateQuery();
    Object.assign(S, keep);
    return h;
  };

  /* ---------------- spectra ---------------- */
  function sharedSpectrum(d, ids, opts) {
    opts = opts || {};
    const cells = [0, 1, 2, 3, 4].map((i) => {
      const here = ids.filter((id) => slot(placement(id, d.id).pos) === i);
      const mks = here.map((id) => {
        const c = C[id], p = placement(id, d.id);
        return `<button class="mk" type="button" data-ev="${id}|${d.id}" aria-label="${esc(markerLabel(c, d, p.pos))}" title="${esc(c.name)}: ${esc(H.copy.evidenceCta)}">${shape(c, opts.compact ? 15 : 17)}<span class="mk-code" aria-hidden="true">${id}</span></button>`;
      }).join("");
      return `<div class="cell">${mks}</div>`;
    }).join("");
    const na = ids.filter((id) => slot(placement(id, d.id).pos) === null);
    return `<div class="spec${opts.compact ? " compact" : ""}" role="group" aria-label="${esc(d.name)}: spectrum from ${esc(d.left)} to ${esc(d.right)}">
      <span class="spec-end spec-l">${esc(d.left)}</span>
      <div class="track">${cells}</div>
      <span class="spec-end spec-r">${esc(d.right)}</span>
      ${na.length ? `<p class="na-line">${na.map((id) => `${esc(C[id].name)}: ${esc(H.copy.uncertainty)}`).join(" · ")}</p>` : ""}
    </div>`;
  }
  function laneRowHTML(d, id, noBadge) {
    const c = C[id], p = placement(id, d.id), sl = slot(p.pos);
    const track = sl === null
      ? `<span class="lane-na">${esc(H.copy.uncertainty)}</span>`
      : `<div class="track">${[0, 1, 2, 3, 4].map((i) => `<div class="cell">${i === sl ? `<button class="mk" type="button" data-ev="${id}|${d.id}" aria-label="${esc(markerLabel(c, d, p.pos))}">${shape(c, 16)}</button>` : ""}</div>`).join("")}</div>`;
    return noBadge ? `<div class="lane solo">${track}</div>` : `<div class="lane">${badge(c)}${track}</div>`;
  }
  // One country per line: badge (or label), a narrow bar, then its text to the right.
  function ltRowHTML(d, id, text, sub) {
    return `<div class="lt-row">${badge(C[id])}${laneRowHTML(d, id, true)}<p class="lt-text">${sub ? `<span class="lt-sub">${sub}</span>` : ""}${esc(text)}</p></div>`;
  }
  const ltEndsHTML = (d) => `<div class="lt-row lt-ends" aria-hidden="true"><span></span><div class="lane-ends"><span>← ${esc(d.left)}</span><span>${esc(d.right)} →</span></div><span></span></div>`;
  const laneEndsHTML = (d) => `<div class="lane-ends" aria-hidden="true"><span>← ${esc(d.left)}</span><span>${esc(d.right)} →</span></div>`;
  function laneSpectrum(d, ids, opts) {
    opts = opts || {};
    const lanes = ids.map((id) => laneRowHTML(d, id, opts.noBadge)).join("");
    return `<div class="lanes" role="group" aria-label="${esc(d.name)}: spectrum from ${esc(d.left)} to ${esc(d.right)}">
      ${laneEndsHTML(d)}${lanes}</div>`;
  }
  const spectrum = (d, ids, opts) => (MOBILE.matches || (opts && opts.lanes) ? laneSpectrum(d, ids, opts) : sharedSpectrum(d, ids, opts));

  /* Explanatory sub-factors inside a feature (e.g. water and basic
     servicing within Infrastructure maturity). Description only: no
     sub-position, no score. */
  function servicingHTML(d) {
    if (!d.sub_factors) return "";
    return `<div class="subf"><span class="k">What this feature covers</span>
      <ul>${d.sub_factors.map((f) => `<li><b>${esc(f.label)}</b>: ${esc(f.note)}</li>`).join("")}</ul>
      ${d.servicing_note ? `<p>${esc(d.servicing_note)}</p>` : ""}
      ${d.scale_guard ? `<p class="subf-guard">${esc(d.scale_guard)}</p>` : ""}</div>`;
  }

  /* ---------------- feature row ---------------- */
  function dimRow(d, ids, opts) {
    opts = opts || {};
    const big = S.diff && ids.length > 1 && isLargeDifference(d.id, ids);
    const isOpen = open.has(d.id);
    const interp = d.always_interpretive ? `<span class="tag tag-interp">Always interpretive</span>` : "";
    const rows = ids.map((id) => {
      const p = placement(id, d.id);
      return ltRowHTML(d, id, p.short, `<b class="pos-lbl" style="color:${C[id].color}">${esc(H.POSITIONS[p.pos].label)}</b> · ${esc(H.CONFIDENCE[p.conf].label)}${p.variation ? " · large internal variation" : ""}`);
    }).join("");
    return `<article class="dim${big ? " is-big" : ""}${S.d === d.id ? " is-target" : ""}" id="dim-${d.id}">
      <div class="dim-head">
        <span class="dim-title"><span class="dim-n">${d.n}</span><span class="dim-name">${esc(d.name)}</span></span>
        <span>${big ? `<span class="tag tag-big">Large structural difference</span> ` : ""}${interp}
          <button class="linkbtn dim-toggle" type="button" data-dimtoggle="${d.id}" aria-expanded="${isOpen}" aria-controls="more-${d.id}" data-fk="dt-${d.id}">${isOpen ? "Hide" : "Show"} definition</button></span>
      </div>
      <div class="lt" role="group" aria-label="${esc(d.name)}: spectrum from ${esc(d.left)} to ${esc(d.right)}">${ltEndsHTML(d)}${rows}</div>
      <div class="dim-defs" id="more-${d.id}"${isOpen ? "" : " hidden"}>
        <p><span class="cap">Definition</span> - ${esc(d.short_definition)}</p>
        <p><span class="cap">Why it matters</span> - ${esc(d.why_it_matters)}</p>
        <p><span class="cap">Trade-off</span> - ${esc(d.tradeoff)}</p>
        ${servicingHTML(d)}
      </div>
    </article>`;
  }

  /* ---------------- tool navigation (same strip on every page) ---------------- */
  // On narrow screens the strip scrolls sideways; keep the current page's item in view.
  function revealNavCurrent() {
    const strip = document.querySelector(".toolnav-inner"), cur = strip && strip.querySelector('[aria-current="page"]');
    if (!strip || !cur || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollLeft = Math.max(0, cur.offsetLeft - (strip.clientWidth - cur.offsetWidth) / 2);
  }
  function toolNavHTML() {
    const here = (cond) => (cond ? ' aria-current="page"' : "");
    const countries = COUNTRIES.map((c) => `<a href="#/country/${c.id}"${here(S.route === "country" && S.country === c.id)}>${shape(c, 11)}${esc(c.name)}</a>`).join("");
    return `<nav class="toolnav" aria-label="Fingerprint pages"><div class="wrap toolnav-inner">
      <a href="#/"${here(S.route === "intro")}>Start here</a>
      <a href="#/how-to-read"${here(S.route === "read")}>How to read it</a>
      <a href="${homeHref()}"${here(S.route === "home")}>Compare</a>
      <a href="${exploreHref({ v: "glance", f: "A", d: null, diff: false })}"${here(S.route === "explore" && S.v === "glance")}>6 groups</a>
      <a href="${exploreHref({ v: "dims", f: "A", d: null, diff: false })}"${here(S.route === "explore" && S.v === "dims")}>All 24 features</a>
      <a href="#/why-prices-move"${here(S.route === "moves")}>Why prices move</a>
      <span class="toolnav-sep" aria-hidden="true"></span>${countries}
      <span class="toolnav-sep" aria-hidden="true"></span><a href="#/method"${here(S.route === "method")}>Methodology</a>
    </div></nav>`;
  }

  /* ---------------- default home (v2.0) ---------------- */
  function pickChipsHTML() {
    const chip = (c, attr, on, fk) => `<button class="chip" type="button" style="--c:${c.color}" ${attr} aria-pressed="${on}" data-fk="${fk}">${shape(c, 13)}${esc(c.name)}</button>`;
    const buy = COUNTRIES.map((c) => chip(c, `data-buyin="${c.id}"`, S.pick[0] === c.id, "b-" + c.id)).join("");
    const vs = COUNTRIES.filter((c) => c.id !== S.pick[0]).map((c) => chip(c, `data-vs="${c.id}"`, S.pick[1] === c.id, "v-" + c.id)).join("");
    return `<div class="pick-row" role="group" aria-label="I'm buying in"><span class="pick-label">I'm buying in</span>${buy}</div>
      <div class="pick-row" role="group" aria-label="Compare with (optional)"><span class="pick-label">Compare with</span>${vs}<button class="chip" type="button" data-vs="none" aria-pressed="${!S.pick[1]}" data-fk="v-none">No comparison</button></div>`;
  }
  function sixCardHTML(did, ids) {
    const d = DIM[did], fam = FAM[d.family];
    const rows = ids.map((id) => ltRowHTML(d, id, (C[id].buyer_lines && C[id].buyer_lines[did]) || placement(id, did).short)).join("");
    return `<article class="six-card" id="six-${did}">
      <div class="six-head"><div><span class="six-fam">${esc(fam.name)}</span><h3>${esc(d.name)}</h3></div>
        <button class="linkbtn six-more" type="button" data-detail="${did}" aria-label="${esc(d.name)}: what it means and the evidence">Detail</button></div>
      <div class="lt" role="group" aria-label="${esc(d.name)}: spectrum from ${esc(d.left)} to ${esc(d.right)}">${ltEndsHTML(d)}${rows}</div>
    </article>`;
  }
  /* One numbering system: each step is a numbered heading, in reading order. */
  const stepH = (n, id, text) => `<h2 class="step-h" id="${id}"><span class="step-n">${n}</span>${text}</h2>`;

  /* Step 2, the answer: built from the countries picked. Checks and cautions
     only; never a buy, sell or rent verdict. */
  function takeawayHTML(ids) {
    const c = C[ids[0]], o = ids[1] ? C[ids[1]] : null;
    const half = (x, vs) => `<div class="tk-col${vs ? " tk-vs" : ""}" style="--c:${x.color}">
          <p class="tk-label">${vs ? '<span class="tk-tag">For comparison</span>' : ""}${badge(x, true)}<span>${esc(x.fingerprint_label)}</span></p>
          <span class="k">${vs ? `If buying in ${esc(x.name)}, check` : "Before buying, check"}</span>
          <ul class="tk-checks">${(x.checks || []).map((y) => `<li>${esc(y)}</li>`).join("")}</ul>
          ${x.dont_assume ? `<p class="tk-dont"><b>Don't assume:</b> ${esc(x.dont_assume)}</p>` : ""}
        </div>`;
    return `<div class="takeaway" aria-labelledby="tk-h">
      ${stepH(2, "tk-h", `What a property in ${esc(c.name)} depends on`)}
      <div class="tk-card">
        <div class="tk-halves${o ? " two" : ""}">${half(c, false)}${o ? half(o, true) : ""}</div>
      </div>
    </div>`;
  }
  function homeHTML() {
    const ids = S.c;
    const vs = ids[1] ? `, compared with ${esc(C[ids[1]].name)}` : "";
    return `<section class="hero hero-home"><div class="wrap">
      <p class="eyebrow">Compare · 3 steps · About 5 minutes · <a href="#/how-to-read">How to read it</a></p>
      <h1>What a property depends on, country by country</h1>
    </div></section>
    <section class="step steps12"><div class="wrap s12">
      <div class="s12-pick" aria-labelledby="pick-h">
        ${stepH(1, "pick-h", "Pick where you're buying")}
        <div class="pick">${pickChipsHTML()}</div>
      </div>
      ${takeawayHTML(ids)}
    </div></section>
    <section class="step six" aria-labelledby="six-h"><div class="wrap">
      ${stepH(3, "six-h", `Why: six features of ${esc(C[ids[0]].name)}'s housing system${vs}`)}
      <p class="six-howto">Each bar runs between two opposite conditions, and the dot shows where a country sits. Neither end is better. Click a dot for evidence.</p>
      <div class="six-grid">${H.homeDims.map((did) => sixCardHTML(did, ids)).join("")}</div>
    </div></section>`;
  }
  function renderHome() { $app.innerHTML = toolNavHTML() + homeHTML(); }
  function rerenderHome() {
    const fk = document.activeElement && document.activeElement.getAttribute("data-fk");
    const y = window.scrollY;
    renderHome();
    window.scrollTo(0, y);
    if (fk) { const el = document.querySelector(`[data-fk="${fk}"]`); if (el) el.focus({ preventScroll: true }); }
    writeHash();
  }

  /* ---------------- #/why-prices-move : same price move, different causes ---------------- */
  function renderMoves() {
    $app.innerHTML = toolNavHTML() + `<section class="hero-sm explore-head"><div class="wrap">
      <p class="eyebrow">Why prices move · all four countries</p>
      <h1>Same price move, different causes</h1>
      <p class="lede">A price chart shows the result, not the cause. Pick a scenario to see what can drive it in each country, and how a shock spreads.</p>
    </div></section>
    <div class="wrap bg-page">${mechBodyHTML()}</div>`;
  }
  function mechBodyHTML() {
    return `<div class="seg mech-tabs" role="group" aria-label="Scenario">${H.mechanisms.map((m) => `<button type="button" data-mech="${m.id}" aria-pressed="${S.m === m.id}" data-fk="m-${m.id}">${esc(m.tab)}</button>`).join("")}</div>
      <div id="mech-body">${mechChainsHTML()}</div>
      <p class="note">Each chain is dated. These are illustrations of how the systems work, not forecasts.</p>`;
  }

  /* ---------------- full explorer (#/explore) ---------------- */
  function toolbarHTML() {
    const chips = COUNTRIES.map((c) => {
      const on = S.c.includes(c.id);
      return `<button class="chip" type="button" style="--c:${c.color}" data-togglec="${c.id}" aria-pressed="${on}" data-fk="c-${c.id}" ${on && S.c.length === 1 ? 'aria-disabled="true" title="At least one country stays selected"' : ""}>${shape(c, 13)}${esc(c.name)}</button>`;
    }).join("");
    const fams = S.v === "dims" ? `<div class="tb-group fam-row" role="group" aria-label="Filter by group"><span class="tb-label">Group</span>
        ${H.families.map((f) => `<button class="chip fam" type="button" data-fam="${f.id}" aria-pressed="${S.f === f.id}" data-fk="f-${f.id}">${f.id}. ${esc(f.name)}</button>`).join("")}
        <button class="chip fam" type="button" data-fam="all" aria-pressed="${S.f === "all"}" data-fk="f-all">All 24</button>
      </div>` : "";
    const canDiff = S.c.length > 1;
    return `<div class="toolbar" role="region" aria-label="Comparison controls">
      <a class="tb-back" href="${homeHref()}">← Compare</a>
      <div class="tb-group" role="group" aria-label="Countries"><span class="tb-label">Countries</span>${chips}</div>
      <div class="seg" role="group" aria-label="View">
        <button type="button" data-view="glance" aria-pressed="${S.v === "glance"}" data-fk="v-glance">6 groups</button>
        <button type="button" data-view="dims" aria-pressed="${S.v === "dims"}" data-fk="v-dims">All 24 features</button>
      </div>
      <label class="switch" title="${canDiff ? "" : "Select two or more countries"}"><input type="checkbox" data-diff ${S.diff && canDiff ? "checked" : ""} ${canDiff ? "" : "disabled"} data-fk="diff" />Show largest structural differences</label>
      ${S.diff && canDiff ? `<div class="seg seg-sm" role="group" aria-label="How far apart counts as a large difference">
        <button type="button" data-gap="4" aria-pressed="${S.gap === 4}" data-fk="gap-4">Opposite ends</button>
        <button type="button" data-gap="3" aria-pressed="${S.gap === 3}" data-fk="gap-3">3+ positions apart</button>
      </div>` : ""}
      ${fams}
      ${S.v === "dims" ? `<button class="btn-ghost small" type="button" data-expandall="1" data-fk="expandall">${visibleDims().every((id) => open.has(id)) ? "Hide all definitions" : "Show all definitions"}</button>` : ""}
    </div>`;
  }
  const visibleDims = () => H.dimensions.filter((d) => S.f === "all" || d.family === S.f).map((d) => d.id);

  function diffSummary(dimIds) {
    if (!S.diff || S.c.length < 2) return "";
    const big = dimIds.filter((id) => isLargeDifference(id, S.c));
    if (!big.length) return `<div class="diffsum">No feature in this view has ${esc(cnames(S.c))} ${gapPhrase()}. Try “3+ positions apart”, or a different set of countries.</div>`;
    return `<div class="diffsum"><b>Largest structural differences</b>: ${big.length} ${big.length === 1 ? "feature" : "features"} where ${esc(cnames(S.c))} sit ${gapPhrase()}. These are differences in kind, not advantages or disadvantages.
      <ul>${big.map((id) => `<li><button type="button" data-goto="${id}">${DIM[id].n}. ${esc(DIM[id].name)}</button></li>`).join("")}</ul></div>`;
  }

  function legendHTML() {
    return `<div class="legend" aria-hidden="true">${S.c.map((id) => badge(C[id], true)).join("")}
      ${S.v === "dims" ? `<span class="legend-note">Five positions between two named system states, no scores. ${esc(H.copy.antiRank)} Select a marker for the evidence.</span>` : ""}</div>`;
  }

  function glanceHTML() {
    const ids = S.c;
    // A matrix: one row per question (group), one column per selected country. Read across to compare.
    const head = `<div class="qm-row qm-head" style="--n:${ids.length};--qw:${ids.length <= 2 ? 1.7 : ids.length === 3 ? 1.4 : 1.25}fr"><div class="qm-q"><span class="k">Group and its question</span></div>${ids.map((id) => `<div class="qm-c">${badge(C[id], true)}</div>`).join("")}</div>`;
    const rows = H.lenses.map((L) => {
      const feats = L.dims.map((did) => {
        const d = DIM[did], big = S.diff && ids.length > 1 && isLargeDifference(did, ids);
        return `<button class="feat-link${big ? " is-big" : ""}" type="button" data-goto="${did}" title="${big ? "Large structural difference. " : ""}Open in the 24-features view">${esc(d.name)}</button>`;
      }).join("");
      return `<div class="qm-row" style="--n:${ids.length};--qw:${ids.length <= 2 ? 1.7 : ids.length === 3 ? 1.4 : 1.25}fr" id="lens-${L.id}">
        <div class="qm-q"><span class="six-fam">${L.n} · ${esc(L.short)}</span><h3>${esc(FAM[L.family].question)}</h3><p class="lens-feats">${feats}</p></div>
        ${ids.map((id) => `<div class="qm-c" style="--c:${C[id].color}"><span class="sr">${esc(C[id].name)}: </span>${esc(C[id].lens_summaries[L.id] || "")}</div>`).join("")}
      </div>`;
    }).join("");
    return `${diffSummary(H.dimensions.map((d) => d.id))}<div class="qm" role="table" aria-label="Six groups by country">${head}${rows}</div>`;
  }



  function dimsHTML() {
    const fams = S.f === "all" ? H.families : [FAM[S.f]];
    const visible = H.dimensions.filter((d) => fams.some((f) => f.id === d.family)).map((d) => d.id);
    const body = fams.map((f) => `<section class="family" id="fam-${f.id}" aria-labelledby="famh-${f.id}">
        <div class="fam-head"><span class="fam-letter" aria-hidden="true">${f.id}</span><h3 id="famh-${f.id}">${esc(f.name)}</h3>
          <p class="fam-q">${esc(f.question)}</p><p class="fam-intro">${esc(f.intro)}</p></div>
        <div class="dims">${H.dimensions.filter((d) => d.family === f.id).map((d) => dimRow(d, S.c)).join("")}</div>
      </section>`).join("");
    return `${legendHTML()}${diffSummary(visible)}${body}`;
  }

  function explorerBodyHTML() { return S.v === "dims" ? dimsHTML() : glanceHTML(); }

  const exploreHead = () => (S.v === "dims"
    ? ["All 24 features, up to four countries", "Every feature, with the evidence behind each position. Switch to the 6 groups for a quick summary."]
    : ["Six groups, one line per country", "Each of the 6 groups of features answers one question. Each line summarises the research behind this tool for that country; nothing is averaged or scored. The features listed under a group open their bars and evidence."]);
  function explorerHTML() {
    return `<section class="hero-sm explore-head"><div class="wrap">
      <h1>${exploreHead()[0]}</h1>
      <p class="lede">${exploreHead()[1]}</p>
    </div></section>
    <section class="part" id="explore"><div class="wrap">
      <p class="which-line"><b>No system is “best”.</b> ${esc(H.copy.whichBetter.replace(/^Different housing systems optimise different things and create different trade-offs\. There is no overall winner to find here\. /, "Each one makes different trade-offs. "))}</p>
      ${toolbarHTML()}
      <div id="explorer-body">${explorerBodyHTML()}</div>
    </div></section>`;
  }
  function renderExplore() { $app.innerHTML = toolNavHTML() + explorerHTML(); }

  function mechChainsHTML() {
    const M = H.mechanisms.find((m) => m.id === S.m);
    let rows;
    if (M.id === "leverage") {
      rows = S.c.map((id) => {
        const c = C[id];
        return `<div class="chain" style="--c:${c.color}"><div class="chain-who">${badge(c, true)}<span class="period">Today</span></div>
          <div><p class="lev-site">${esc(c.leverage.site)}</p><p class="chain-note" style="margin:0">${esc(c.leverage.text)}</p></div>
          <div class="chain-dims"><span>Features behind this:</span>${M.dims.map((did) => `<button class="linkbtn" type="button" data-ev="${id}|${did}">${esc(DIM[did].name)}</button>`).join("")}</div></div>`;
      }).join("");
    } else {
      rows = S.c.map((id) => {
        const c = C[id], ch = M.chains[id];
        if (!ch) return `<div class="chain" style="--c:${c.color}"><div class="chain-who">${badge(c, true)}</div><p class="chain-note">Mechanism chain not yet written for this country.</p></div>`;
        return `<div class="chain" style="--c:${c.color}"><div class="chain-who">${badge(c, true)}<span class="period">${esc(ch.period)}</span></div>
          <ol class="steps" aria-label="${esc(c.name)} mechanism">${ch.steps.map((s) => `<li><span>${esc(s)}</span></li>`).join("")}</ol>
          ${ch.note ? `<p class="chain-note">${esc(ch.note)}</p>` : ""}
          <div class="chain-dims"><span>Features behind this:</span>${ch.dims.map((did) => `<button class="linkbtn" type="button" data-ev="${id}|${did}">${esc(DIM[did].name)}</button>`).join("")}</div></div>`;
      }).join("");
    }
    return `<h3 class="mech-title">${esc(M.title)}</h3><p class="mech-intro">${esc(M.intro)}</p>
      <div class="chains">${rows}</div><p class="cue mech-caption">${esc(M.caption)}</p>`;
  }

  /* ---------------- country page ---------------- */
  function renderCountry() {
    const c = C[S.country];
    const others = COUNTRIES.filter((x) => x.id !== c.id);
    const lensList = H.lenses.map((L) => `<div class="lens-item"><span class="k">${L.n} · ${esc(L.short)}</span><h3 class="lens-q">${esc(FAM[L.family].question)}</h3><p>${esc(c.lens_summaries[L.id])}</p></div>`).join("");
    const groups = S.f === "all" ? H.families : [FAM[S.f]];
    const fams = groups.map((f) => `<section class="family single" id="fam-${f.id}">
        <div class="fam-head"><span class="fam-letter" aria-hidden="true">${f.id}</span><h3>${esc(f.name)}</h3><p class="fam-q">${esc(f.question)}</p></div>
        <div class="c-rows">${H.dimensions.filter((d) => d.family === f.id).map((d) => {
          const p = placement(c.id, d.id);
          return `<article class="c-row" id="dim-${d.id}">
            <p class="c-row-name"><span class="dim-n">${d.n}</span>${esc(d.name)}${p.conf === "interpretive" ? ' <span class="tag tag-interp">Interpretive</span>' : ""}${p.variation ? ' <span class="tag tag-var">Varies widely inside the country</span>' : ""}</p>
            ${sharedSpectrum(d, [c.id], { compact: true })}
            <p class="c-row-text"><span class="lt-sub"><b class="pos-lbl" style="color:${c.color}">${esc(H.POSITIONS[p.pos].label)}</b> · ${esc(H.CONFIDENCE[p.conf].label)}</span>${esc(p.short)}</p>
          </article>`;
        }).join("")}</div></section>`).join("");
    const groupChips = `<div class="tb-group" role="group" aria-label="Filter by group"><span class="tb-label">Group</span>
        ${H.families.map((f) => `<button class="chip fam" type="button" data-fam="${f.id}" aria-pressed="${S.f === f.id}" data-fk="f-${f.id}">${f.id}. ${esc(f.name)}</button>`).join("")}
        <button class="chip fam" type="button" data-fam="all" aria-pressed="${S.f === "all"}" data-fk="f-all">All 24</button></div>`;
    $app.innerHTML = toolNavHTML() + `<section class="hero-sm c-top"><div class="wrap">
      <p class="eyebrow">Country fingerprint · ${esc(H.copy.freshness)}: ${esc(c.profile_as_of)}</p>
      <h1>${shape(c, 26)}${esc(c.name)} <span class="c-label-inline">${esc(c.fingerprint_label)}</span></h1>
      <div class="c-three">
        <div class="o-card c-prof">
          <p><b>System mechanism</b> - ${esc(c.mechanism)}</p>
          <p><b>Principal friction</b> - ${esc(c.friction)}</p>
          <p><b>Large internal variation</b> - ${esc(c.variation_note.replace(/^Large internal variation:\s*/, ""))}</p>
        </div>
        <div class="dni"><span class="mcard-k">What not to infer</span><p>${esc(c.do_not_infer)}</p></div>
        <div class="card compare-box">
          <label for="cmp">Compare ${esc(c.name)} with…</label>
          <select id="cmp">${others.map((o) => `<option value="${o.id}">${esc(o.name)}</option>`).join("")}<option value="ALL">All four countries</option></select>
          <button class="btn small" type="button" data-compare="${c.id}">Compare on 24 features →</button>
        </div>
      </div>
      <div class="chain" style="--c:${c.color}"><div class="chain-who"><span class="mcard-k" style="margin:0">How the machine has run</span><span class="period">${esc(c.machine.period)}</span></div>
        <ol class="steps">${c.machine.steps.map((x) => `<li><span>${esc(x)}</span></li>`).join("")}</ol>
        <p class="chain-note">${esc(c.machine.constraint)}</p></div>
    </div></section>
    <section class="part c-body"><div class="wrap">
      <div class="seg c-views" role="group" aria-label="View">
        <button type="button" data-view="glance" aria-pressed="${S.v === "glance"}" data-fk="v-glance">6 groups</button>
        <button type="button" data-view="dims" aria-pressed="${S.v === "dims"}" data-fk="v-dims">All 24 features</button>
      </div>
      ${S.v === "dims" ? `${groupChips}<p class="note">${esc(H.copy.antiRank)} Click a dot for the evidence.</p>${fams}` : `<div class="lens-list">${lensList}</div>`}
    </div></section>`;
  }

  /* ---------------- #/ : context and overview (the landing page) ----------------
     Every visitor is a first-time reader: what the tool does, why these four
     countries, what the 6 groups and 24 features are, how to read a
     comparison, what to keep in mind. The three steps live on #/compare. */
  function renderIntro() {
    const countries = COUNTRIES.map((c) => `<li class="o-country" style="--c:${c.color}">
        <p class="o-c-name">${shape(c, 13)}<b>${esc(c.name)}</b></p>
        <p class="o-c-label">${esc(c.fingerprint_label)}</p>
        <p class="o-small">${esc(c.why_included || "")}</p>
        ${(H.fourApartments[c.id] || []).length ? `<p class="o-small o-buy"><b>Buying here means buying into:</b> ${H.fourApartments[c.id].map(esc).join(" + ")}</p>` : ""}</li>`).join("");
    const fams = H.families.map((f) => {
      const ds = H.dimensions.filter((d) => d.family === f.id);
      return `<li class="o-fam"><p class="o-fam-head"><b>${esc(f.name)}</b><span>${ds.length}</span></p>
        <p class="o-small">${esc(f.question)}</p>
        <p class="o-chips">${ds.map((d) => `<span${H.homeDims.includes(d.id) ? ' class="on-home"' : ""}>${esc(d.name)}</span>`).join("")}</p></li>`;
    }).join("");
    $app.innerHTML = toolNavHTML() + `<section class="hero hero-intro"><div class="wrap intro-top">
      <div>
        <p class="eyebrow">For Indian property buyers · Companion to ${maybeLink("article3", "Article 3")}</p>
        <h1>Housing System Fingerprint</h1>
        <p class="subtitle">How housing works in India, China, Japan and the US, and what that means before you buy.</p>
        <p class="lede">This page shows what is compared (2 minutes). The next page shows how to read it, then compare countries in three steps (5 minutes).</p>
        <p class="intro-cta"><a class="btn btn-gold" href="${homeHref()}">Start comparing →</a><span class="o-small">or <a href="#/how-to-read">read how it works</a> first</span></p>
      </div>
      <div class="o-three">
        <div class="o-card"><h2 class="o-h">What it does</h2><p>Describes the system around housing in each country: demand, new supply, loans, builders, ownership records, and how a price fall spreads. Shows what a property bet there depends on, and what to check.</p></div>
        <div class="o-card"><h2 class="o-h">What it doesn't</h2><p>Predict prices, score countries, or tell you whether to buy.</p></div>
        <div class="o-card"><h2 class="o-h">Why compare countries</h2><p>The same price rise can come from rising incomes, cheap credit or a housing shortage. The cause decides whether it lasts.</p></div>
      </div>
    </div></section>
    <div class="wrap o-page">

      <section class="o-sec"><h2 class="o-h2">The four countries <span class="o-intro">Four different ways to run housing, and the comparisons Indian buyers hear most.</span></h2>
        <ul class="o-countries">${countries}</ul>
      </section>

      <section class="o-sec"><h2 class="o-h2">What is compared: 24 features in 6 groups <span class="o-intro">Every country is placed on the same 24 features. <span class="o-key"><span class="on-home">Gold</span> = the six used on the Compare page: one per group, picked for how directly it affects a buyer.</span></span></h2>
        <ul class="o-fams">${fams}</ul>
      </section>

      <p class="o-next"><a class="btn btn-ghost" href="#/how-to-read">Next: How to read it →</a></p>
    </div>`;
  }

  /* ---------------- #/how-to-read : reading guide between Start here and Compare ---------------- */
  function renderRead() {
    $app.innerHTML = toolNavHTML() + `<section class="hero hero-intro hero-read"><div class="wrap">
      <h1>How to read it</h1>
      <p class="lede">One minute on reading a comparison and what it can't tell you. Then compare.</p>
    </div></section>
    <div class="wrap o-page read-page">
      <section class="o-sec"><div class="o-end">
        <div class="o-card"><h2 class="o-h">How to read a comparison</h2>
          <div class="g-demo">${laneSpectrum(DIM.d12, ["IN", "US"])}</div>
          <ul class="o-list">
            <li>Each feature is a bar between two opposite conditions.</li>
            <li>The dot shows where a country sits: one of five positions, not a score.</li>
            <li>Neither end is better. Fixed loans protect your payments but can stop owners selling; floating loans do the reverse.</li>
            <li>Click a dot for the reasoning, sources, date and evidence strength.</li>
          </ul></div>
        <div class="o-card"><h2 class="o-h">Keep in mind</h2>
          <p class="o-layers-cap">Four layers decide how a property turns out; a strong country can still contain a weak city or a badly built property. This tool covers the first.</p>
          <ol class="o-layers" aria-label="Four layers of a property decision">
            <li class="here"><b>1 · Country</b><span>What system am I buying inside? <em>This tool</em></span></li>
            <li><b>2 · City</b><span>Where inside that system am I buying?</span></li>
            <li><b>3 · Property</b><span>What exactly is this asset?</span></li>
            <li><b>4 · Person</b><span>What does it do to my finances?</span></li>
          </ol>
          <ul class="o-list">
            <li>Profiles are snapshots (${esc(H.meta.profile_as_of)}) and will change.</li>
            <li>Placements marked Interpretive rest on judgement, not one measured statistic.</li>
            <li>Education, not financial advice.</li>
          </ul></div>
        <div class="o-card o-go"><h2 class="o-h">Ready?</h2>
          <p>Three steps: pick where you're buying, see what a property there depends on, then see why.</p>
          <p><a class="btn btn-gold" href="${homeHref()}">Start comparing →</a></p>
        </div>
      </div></section>
    </div>`;
  }

  /* ---------------- method page ---------------- */
  function renderMethod() {
    const cites = {};
    COUNTRIES.forEach((c) => Object.values(c.placements).forEach((p) => p.src.forEach((s) => (cites[s] = (cites[s] || 0) + 1))));
    const demoD = { name: "Example feature", left: "System state A", right: "System state B" };
    const demo = `<div class="pos-demo"><div class="spec" aria-hidden="true"><span class="spec-end spec-l">${esc(demoD.left)}</span><div class="track">${[0, 1, 2, 3, 4].map(() => '<div class="cell"></div>').join("")}</div><span class="spec-end spec-r">${esc(demoD.right)}</span></div>
      <div class="pos-names" aria-hidden="true"><div>${["Left", "Mid-left", "Middle", "Mid-right", "Right"].map((x) => `<span>${x}</span>`).join("")}</div></div></div>`;
    const confRows = Object.entries(H.CONFIDENCE).map(([k, v]) => `<tr><td><b>${esc(v.label)}</b></td><td>${esc(v.means)}</td><td>${k === "high" ? "Label in the evidence drawer." : k === "medium" ? "Label plus a one-sentence comparability note." : "Labelled wherever shown; the basis is explained, never disguised as hard data."}</td></tr>`).join("");
    const confCounts = {};
    COUNTRIES.forEach((c) => Object.values(c.placements).forEach((p) => (confCounts[p.conf] = (confCounts[p.conf] || 0) + 1)));
    // Long tables render as two side-by-side halves on wide screens.
    const twoTables = (head, rows) => {
      const half = Math.ceil(rows.length / 2);
      const tbl = (rs) => `<div class="tbl-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rs.join("")}</tbody></table></div>`;
      return rows.length > 8 ? `<div class="tbl-two">${tbl(rows.slice(0, half))}${tbl(rows.slice(half))}</div>` : tbl(rows);
    };
    const cadRows = H.dimensions.map((d) => `<tr><td>${d.n}. ${esc(d.name)}</td><td>${esc(d.update_cadence)}</td><td>${esc(d.evidence_type)}</td></tr>`);
    const SRC_GROUPS = [["IN", "India", (g) => g === "India"], ["CN", "China", (g) => g === "China"], ["JP", "Japan", (g) => g === "Japan"], ["US", "United States", (g) => g === "United States"], ["X", "International and series", (g) => !["India", "China", "Japan", "United States"].includes(g)]];
    const sg = SRC_GROUPS.find(([k]) => k === S.sg) || SRC_GROUPS[0];
    const srcChips = SRC_GROUPS.map(([k, label, fn]) => `<button class="chip fam" type="button" data-srcg="${k}" aria-pressed="${sg[0] === k}">${esc(label)} (${H.sources.filter((x) => fn(x.geography)).length})</button>`).join("");
    const srcRows = H.sources.filter((x) => sg[2](x.geography)).map((s) => `<tr id="src-${s.source_id}"><td><b>${esc(s.publisher)}</b></td><td>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}</td><td>${esc(s.geography)}<br><span class="muted">${esc(s.data_period)}</span></td><td>${esc(s.source_type)}</td><td>${cites[s.source_id] || 0}</td></tr>`);
    $app.innerHTML = toolNavHTML() + `<section class="hero-sm"><div class="wrap">
      <p class="eyebrow">Methodology</p>
      <h1 style="font-size:clamp(2rem,4.5vw,3rem);margin:0 0 14px">How the Fingerprint is built</h1>
      <p class="lede">Qualitative placements, explicit evidence, visible uncertainty, and a hard rule against turning any of it into a score.</p>
      ${seriesMethodHref() ? `<p class="hero-a3">This page explains how this tool places countries. Definitions shared across the whole series are on the <a href="${esc(seriesMethodHref())}">Real Estate Reframed Methodology &amp; Concepts page</a>.</p>` : ""}
    </div></section>
    <div class="wrap"><div class="m-grid">
      <nav class="m-nav" aria-label="Methodology sections">${METHOD_SECTIONS.map(([id, t]) => `<a href="#/method${id === "m-what" ? "" : "?s=" + id}"${S.s === id ? ' aria-current="page"' : ""}>${t}</a>`).join("")}</nav>
      <div>
        <section class="m-sec" id="m-what"><h2>What the Fingerprint is</h2>
          <div class="req-lines"><p class="cue">${esc(H.copy.cue)}</p><p class="cue">${esc(H.copy.method)}</p></div>
          <p>A house does not exist inside a generic real-estate market. It exists inside a housing system. The Housing System Fingerprint is a common set of features describing the demographic, supply, financing, development, legal and institutional conditions through which a country’s housing market operates.</p>
          <p>It is <b>descriptive, not normative</b>. Endpoints describe different system states, not good and bad poles. Deep mortgages can improve access and increase leverage; responsive supply can improve affordability and reduce appreciation; a housing shortage can be painful social policy while supporting incumbent owners’ prices. Each feature helps some objectives and hurts others.</p>
          <p>Each country profile is a <b>current snapshot</b> (${esc(H.meta.profile_as_of)}), not a permanent national personality. ${esc(H.copy.propertyGuard)}</p>
          <p>The Fingerprint puts into practice the system-level ideas in Real Estate Reframed ${maybeLink("article3", "Article 3")} (describe the machine before forecasting its output), its primary home. It also supports ${maybeLink("article13", "Article 13")} (why demand, supply and affordability behave differently across systems) and ${maybeLink("article14", "Article 14")} (the country as the first layer of Country → City → Property → Person).</p>
        </section>
        <section class="m-sec" id="m-place"><h2>Placement method</h2>
          <p>Each of the 24 features is a spectrum between two explicitly named endpoints. Every country is placed in one of five qualitative positions:</p>
          ${demo}
          <ul>
            <li>Positions are discrete anchors, not a continuous slider; this avoids false precision.</li>
            <li>Placement is comparative and evidence-led, but deliberately not presented as a measured index value. No number is displayed, summed, averaged, converted to a percentile or used to rank countries.</li>
            <li>Where comparable data are strong, the rationale cites them. Where a feature is institutional or behavioural, the placement is labelled as a synthesis judgement.</li>
            <li>If evidence is materially insufficient, the product shows “${esc(H.copy.uncertainty)}” instead of forcing a marker.</li>
            <li>The six questions (one per group) are editorial summaries of the model. Their sentences are written, never calculated from the underlying features.</li>
          </ul>
        </section>
        <section class="m-sec" id="m-conf"><h2>Confidence labels</h2>
          <p>Confidence describes the evidence behind a placement, not whether the housing system is “safe”.</p>
          <div class="tbl-wrap"><table><thead><tr><th>Label</th><th>Used when</th><th>Shown as</th></tr></thead><tbody>${confRows}</tbody></table></div>
          <p>Across the ${COUNTRIES.length * H.dimensions.length} launch placements: ${confCounts.high || 0} high, ${confCounts.medium || 0} medium, ${confCounts.interpretive || 0} interpretive. Cultural expectation of property appreciation is always interpretive. The India and China mortgage-rate-structure placements carry the comparability flag from Fingerprint v1.0.</p>
        </section>
        <section class="m-sec" id="m-evidence"><h2>Evidence standards</h2>
          <ul>
            <li>Every placement is traceable to at least one source, or to an explicit interpretive rationale.</li>
            <li>Source hierarchy: national statistics, regulators, central banks, multilateral institutions and high-quality research bodies first. News reporting may add context but does not anchor a placement when primary evidence exists.</li>
            <li>Survey asset-share figures (such as India’s AIDIS) and national-account balance sheets (such as the US Financial Accounts) are never treated as directly comparable; contrasts carry an explicit caveat.</li>
            <li>No single vacancy, affordability, price-growth or homeownership statistic is treated as determining a fingerprint.</li>
            <li>Current figures live in evidence drawers rather than headline copy. Historical causal claims keep their dates visible, so “how this system developed” is not confused with “what it looks like now”.</li>
          </ul>
        </section>
        <section class="m-sec" id="m-limits"><h2>Comparability limits and honest uncertainty</h2>
          <div class="tbl-wrap"><table><thead><tr><th>Situation</th><th>What the Fingerprint does</th></tr></thead><tbody>
            <tr><td><b>Missing current evidence</b></td><td>Shows the last verified placement only if still defensible, flagged “evidence refresh due”; otherwise shows no marker.</td></tr>
            <tr><td><b>Conflicting reputable sources</b></td><td>Keeps the placement if the direction is robust and explains the conflict; marks it under review if direction is affected.</td></tr>
            <tr><td><b>Large regional variation</b></td><td>Keeps the national placement as a system prior and adds a “large internal variation” note. Nothing is averaged into false precision.</td></tr>
            <tr><td><b>Recent reform not yet in outcomes</b></td><td>Updates the rationale immediately; moves the marker only when the structural condition has materially changed.</td></tr>
            <tr><td><b>Crisis causing rapid change</b></td><td>Event-driven review with a dated note; features are not rewritten reflexively.</td></tr>
            <tr><td><b>“Which is better?”</b></td><td>${esc(H.copy.whichBetter)}</td></tr>
          </tbody></table></div>
        </section>
        <section class="m-sec" id="m-design"><h2>Framework decisions</h2>
          <h3>Six groups</h3><p>The original framework document counts five groups but lists six (A to F). The Fingerprint uses the six listed.</p>
          <h3>Causes, not every consequence</h3><p>Vacancy and affordability are not separate country-level axes. Vacancy is partly an outcome of stock balance, mismatch and demographics; affordability is partly an outcome of income, prices, rates, supply and geography, and national averages hide large city differences. Both belong at the city layer. Keeping them out avoids double-counting.</p>
          <h3>One developer-fragility feature</h3><p>Feature 16 deliberately combines presale dependence and developer leverage. Separating them would count essentially the same systemic vulnerability twice.</p>
          <h3>Water and basic urban servicing sit inside Infrastructure maturity</h3><p>Housing stock is not the same thing as sustainably serviced housing capacity. Feature 10 therefore covers reliable water supply, sustainable groundwater use, sewage and wastewater, drainage and power alongside transport, and reads maturity as the reliability and scalability of those systems rather than their mere existence. Water is deliberately not a 25th feature and carries no separate score: it shares causes with the rest of the infrastructure system, and comparable country-level servicing evidence has not yet been assembled. National placements never describe the water security of a particular city or project.</p>
          <h3>Why there is no radar chart</h3><p>Radar area behaves visually like an overall magnitude even though the axes are unlike and non-normative; changing axis order changes the silhouette without changing the data; a larger area reads as “stronger”. Aligned spectra let each feature be read on its own terms.</p>
        </section>
        <section class="m-sec" id="m-update"><h2>Update policy</h2>
          <p>The framework is relatively stable; placements and evidence are not. Updates go feature by feature rather than in one annual rewrite. Placement changes need reviewer sign-off and are recorded in the change log, so history is never overwritten silently. Normal cyclical moves (for example in interest rates) do not shift structural placements.</p>
          ${twoTables("<th>Feature</th><th>Review cadence</th><th>Evidence type</th>", cadRows)}
          <h3>Adding a country</h3><p>A new country extends the same 24-feature model; the framework does not grow because a country is added. It publishes only when it has a four-part profile (label, mechanism, friction, what not to infer), a placement or an explicit “not enough comparable evidence” on all 24 features, sources, dates and confidence for each, and has passed anti-ranking and cross-country consistency checks. Another country’s placement is never reused as a proxy.</p>
        </section>
        <section class="m-sec" id="m-not"><h2>What the Fingerprint does not do</h2>
          <ul>
            <li>No composite, quality, investment or risk score, and no ranking or league table.</li>
            <li>No “best housing market”, “best country to buy property”, or country-versus-country contest.</li>
            <li>No house-price forecasts, expected returns or portfolio recommendations.</li>
            <li>No city-level data, property due diligence or personal suitability; those belong to other Real Estate Reframed tools, such as the ${maybeLink("xray", "Property Decision X-Ray")}${opensNote("xray") ? ` (${esc(opensNote("xray").replace(/^Opens/, "opens"))})` : ""}.</li>
            <li>No buy, rent, sell or invest recommendation.</li>
            <li>No historical animation of fingerprints, user weights, or crowd ratings.</li>
          </ul>
        </section>
        <section class="m-sec" id="m-sources"><h2>Sources</h2>
          <p>${H.sources.length} source records. Links go to each publisher’s release or data page; the specific release is named. Accessed ${esc(H.sources[0].accessed_date)}.</p>
          <div class="tb-group" role="group" aria-label="Sources by geography" style="margin:8px 0">${srcChips}</div>
          ${twoTables("<th>Source</th><th>Document (link)</th><th>Geography · period</th><th>Type</th><th>Placements citing</th>", srcRows)}
        </section>

      </div>
    </div></div>`;
  }

  /* ---------------- evidence drawer ---------------- */
  function drawerHTML(cid, did, aboutFirst) {
    const c = C[cid], d = DIM[did], p = placement(cid, did), conf = H.CONFIDENCE[p.conf];
    const showNote = p.conf !== "high" ? (p.note || d.comparability) : p.note;
    const srcs = p.src.map((id) => SRC[id]).filter(Boolean).map((s) => `<li><span class="src-pub">${esc(s.publisher)}</span>: ${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}
        <span class="src-meta">${esc(s.source_type)} · ${esc(s.geography)} · ${esc(s.data_period)}</span></li>`).join("");
    const tabs = COUNTRIES.map((o) => `<button class="chip" type="button" style="--c:${o.color}" data-drc="${o.id}" aria-pressed="${o.id === cid}">${shape(o, 13)}${esc(o.name)}</button>`).join("");
    const about = `<details class="dr-about"${aboutFirst ? " open" : ""}><summary>About this feature</summary>
          <p><span class="k">Definition</span>${esc(d.short_definition)}</p>
          <p><span class="k">Why it matters</span>${esc(d.why_it_matters)}</p>
          <p><span class="k">Trade-off</span>${esc(d.tradeoff)}</p>
          ${servicingHTML(d)}
          <p><span class="k">Endpoints</span>Left: ${esc(d.left)}. Right: ${esc(d.right)}.</p>
        </details>`;
    const compare = S.route === "explore" ? "" : `<a class="btn-ghost small dr-compare" href="#/explore?v=dims&d=${did}">Compare all four countries on this feature →</a>`;
    return `<div class="dr-head"><div><p class="eyebrow" style="margin:0">${esc(FAM[d.family].name)} · Feature ${d.n}</p><h2 id="dr-title">${esc(d.name)}</h2></div>
        <button class="dr-close" type="button" data-close aria-label="Close evidence panel">×</button></div>
      <div class="dr-body">
        ${aboutFirst ? about : ""}
        <div class="dr-tabs" role="group" aria-label="Country">${tabs}</div>
        <div>${laneSpectrum(d, [cid])}<p class="dr-pos"><b>${esc(c.name)}: ${esc(H.POSITIONS[p.pos].label)}</b>: ${esc(posPhrase(d, p.pos))}.</p></div>
        <div><p class="dr-q">${esc(H.copy.evidenceCta)}</p><p class="dr-short">${esc(p.short)}</p>${p.long ? `<p class="dr-long">${esc(p.long)}</p>` : ""}</div>
        <div class="conf"><span class="conf-label ${p.conf}">${esc(conf.label)}</span><p>${esc(conf.means)}</p>${showNote ? `<p><b>Comparability:</b> ${esc(showNote)}</p>` : ""}</div>
        ${p.variation ? `<p class="var-note" style="margin:0">${esc(c.variation_note)}</p>` : ""}
        <div class="dr-meta"><span>${esc(H.copy.freshness)}: ${esc(p.as_of)}</span><span>Status: ${esc(p.reviewer_status)}</span></div>
        <div><span class="k" style="margin-bottom:8px">Sources</span><ul class="srcs">${srcs || "<li>No source attached.</li>"}</ul></div>
        ${aboutFirst ? "" : about}
        ${compare}
      </div>
      <div class="dr-foot">${esc(H.copy.antiRank)} <a href="#/method">Methodology</a></div>`;
  }
  function openDrawer(cid, did, returnTo, aboutFirst) {
    const keep = returnTo === "keep";
    const back = keep ? drawerState && drawerState.returnTo : returnTo || document.activeElement;
    const about = keep ? !!(drawerState && drawerState.about) : !!aboutFirst;
    drawerState = { cid, did, returnTo: back, about };
    $drawer.innerHTML = drawerHTML(cid, did, about);
    $drawer.hidden = false; $scrim.hidden = false;
    document.body.style.overflow = "hidden";
    const focusEl = keep ? $drawer.querySelector(`[data-drc="${cid}"]`) : $drawer.querySelector("[data-close]");
    (focusEl || $drawer).focus();
  }
  function closeDrawer() {
    if (!drawerState) return;
    const back = drawerState.returnTo;
    drawerState = null;
    $drawer.hidden = true; $scrim.hidden = true; $drawer.innerHTML = "";
    document.body.style.overflow = "";
    if (back && back.focus && document.contains(back)) back.focus();
  }
  $drawer.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); closeDrawer(); return; }
    if (e.key !== "Tab") return;
    const f = $drawer.querySelectorAll('button, a[href], summary, [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  $scrim.addEventListener("click", closeDrawer);

  /* ---------------- partial re-render with focus restore ---------------- */
  function rerenderExplorer() {
    if (S.route === "home") { rerenderHome(); return; }
    if (S.route === "country") { const y = window.scrollY; renderCountry(); window.scrollTo(0, y); writeHash(); revealNavCurrent(); return; }
    const fk = document.activeElement && document.activeElement.getAttribute("data-fk");
    const ex = document.getElementById("explore");
    if (!ex) return;
    const tb = ex.querySelector(".toolbar");
    tb.outerHTML = toolbarHTML();
    const nav = document.querySelector(".toolnav");
    if (nav) { nav.outerHTML = toolNavHTML(); revealNavCurrent(); }
    const head = document.querySelector(".explore-head");
    if (head) { head.querySelector("h1").textContent = exploreHead()[0]; head.querySelector(".lede").textContent = exploreHead()[1]; }
    document.getElementById("explorer-body").innerHTML = explorerBodyHTML();
    const mb = document.getElementById("mech-body");
    if (mb) mb.innerHTML = mechChainsHTML();
    if (fk) { const el = document.querySelector(`[data-fk="${fk}"]`); if (el) el.focus(); }
    writeHash();
  }
  function scrollToId(id, behavior) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: behavior || "smooth", block: "start" });
  }
  function gotoDim(did) {
    S.v = "dims";
    if (S.f !== "all") S.f = DIM[did].family;
    S.d = did; open.add(did);
    rerenderExplorer();
    scrollToId("dim-" + did, "instant");
    const t = document.querySelector(`[data-dimtoggle="${did}"]`);
    if (t) t.focus({ preventScroll: true });
    announce(`Showing feature ${DIM[did].n}, ${DIM[did].name}`);
  }

  /* ---------------- events ---------------- */
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-expandall],[data-srcg],[data-ev],[data-detail],[data-buyin],[data-vs],[data-togglec],[data-view],[data-fam],[data-dimtoggle],[data-goto],[data-mech],[data-gap],[data-drc],[data-close],[data-compare],[data-anchor],[data-scroll]");
    if (!t) return;
    if (t.dataset.ev) { const [cid, did] = t.dataset.ev.split("|"); openDrawer(cid, did, t); track("drawer-opened"); return; }
    if (t.dataset.expandall) {
      const ids = visibleDims(), allOpen = ids.every((id) => open.has(id));
      ids.forEach((id) => (allOpen ? open.delete(id) : open.add(id)));
      rerenderExplorer(); return;
    }
    if (t.dataset.srcg) {
      S.sg = t.dataset.srcg; const y = window.scrollY; renderMethod();
      document.querySelectorAll(".m-sec").forEach((sec) => (sec.hidden = sec.id !== S.s));
      window.scrollTo(0, y); revealNavCurrent(); return;
    }
    if (t.dataset.detail) { openDrawer(S.c[0], t.dataset.detail, t, true); track("detail-opened"); return; }
    if (t.dataset.drc) { openDrawer(t.dataset.drc, drawerState.did, "keep"); return; }
    if (t.hasAttribute("data-close")) { closeDrawer(); return; }
    if (t.dataset.buyin) {
      const id = t.dataset.buyin;
      S.pick = [id].concat(S.pick[1] && S.pick[1] !== id ? [S.pick[1]] : []);
      S.c = S.pick.slice();
      rerenderHome(); announce(`Buying in ${C[id].name}`); track("home-countries-changed"); return;
    }
    if (t.dataset.vs) {
      const id = t.dataset.vs;
      S.pick = [S.pick[0]].concat(id === "none" ? [] : [id]);
      S.c = S.pick.slice();
      rerenderHome(); announce(id === "none" ? "No comparison" : `Comparing with ${C[id].name}`); track("home-countries-changed"); return;
    }
    if (t.dataset.togglec) {
      const id = t.dataset.togglec;
      if (S.c.includes(id)) { if (S.c.length === 1) { announce("At least one country stays selected"); return; } S.c = S.c.filter((x) => x !== id); }
      else S.c = ALL.filter((x) => S.c.includes(x) || x === id);
      if (S.c.length < 2) S.diff = false;
      rerenderExplorer(); announce(`Showing ${cnames(S.c)}`); track("compare-changed"); return;
    }
    if (t.dataset.view) {
      S.v = t.dataset.view;
      rerenderExplorer();
      if (!t.closest(".toolbar")) scrollToId("explore");
      announce(S.v === "dims" ? "Showing all 24 features" : "Showing the 6 groups");
      track(S.v === "dims" ? "view-24-features" : "view-at-a-glance"); return;
    }
    if (t.dataset.fam) { S.f = t.dataset.fam; rerenderExplorer(); announce(S.f === "all" ? "All groups" : `Group: ${FAM[S.f].name}`); return; }
    if (t.dataset.dimtoggle) {
      const id = t.dataset.dimtoggle, more = document.getElementById("more-" + id), now = !open.has(id);
      now ? open.add(id) : open.delete(id);
      t.setAttribute("aria-expanded", now); t.textContent = (now ? "Hide" : "Show") + " definition"; if (more) more.hidden = !now;
      S.d = now ? id : (S.d === id ? null : S.d); writeHash(); return;
    }
    if (t.dataset.goto) { gotoDim(t.dataset.goto); return; }
    if (t.dataset.gap) {
      S.gap = t.dataset.gap === "3" ? 3 : 4; rerenderExplorer();
      announce(S.gap === 4 ? "Highlighting features at opposite ends" : "Highlighting features three or more positions apart");
      track("largest-differences-gap-" + S.gap); return;
    }
    if (t.dataset.mech) {
      S.m = t.dataset.mech;
      document.querySelectorAll("[data-mech]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mech === S.m));
      document.getElementById("mech-body").innerHTML = mechChainsHTML(); writeHash(); track("mechanism-" + S.m); return;
    }
    if (t.dataset.compare) {
      const v = document.getElementById("cmp").value, cid = t.dataset.compare;
      S.c = v === "ALL" ? ALL.slice() : ALL.filter((x) => x === cid || x === v);
      S.v = "dims"; S.f = "A"; S.diff = S.c.length > 1; S.d = null; track("compare-changed");
      location.hash = exploreHref({}); return;
    }
    if (t.dataset.anchor) { e.preventDefault(); scrollToId(t.dataset.anchor); return; }
    if (t.dataset.scroll && S.route !== "country" && S.route !== "method") { e.preventDefault(); scrollToId(t.dataset.scroll); }
  });
  document.addEventListener("change", (e) => {
    if (e.target.matches("[data-diff]")) {
      S.diff = e.target.checked; rerenderExplorer(); track("largest-differences-toggled");
      announce(S.diff ? "Highlighting largest structural differences" : "Difference highlighting off");
    }
  });
  // In-page anchors (#machines etc.) must not be treated as routes.
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented) return;
    const href = a.getAttribute("href");
    if (href.startsWith("#/")) return;
    e.preventDefault();
    if (S.route !== "home") { location.hash = "#/"; setTimeout(() => scrollToId(href.slice(1)), 60); return; }
    scrollToId(href.slice(1));
  });

  /* ---------------- render ---------------- */
  function render(fromNav) {
    parseHash();
    closeDrawer();
    if (S.route === "country") { renderCountry(); document.title = `${C[S.country].name} | Housing System Fingerprint`; }
    else if (S.route === "method") { renderMethod(); document.querySelectorAll(".m-sec").forEach((sec) => (sec.hidden = sec.id !== S.s)); document.title = "Methodology | Housing System Fingerprint"; }
    else if (S.route === "explore") { renderExplore(); document.title = `${S.v === "dims" ? "All 24 features" : "6 groups"} | Housing System Fingerprint`; }
    else if (S.route === "home") { renderHome(); document.title = "Compare | Housing System Fingerprint"; }
    else if (S.route === "moves") { renderMoves(); document.title = "Why prices move | Housing System Fingerprint"; }
    else if (S.route === "read") { renderRead(); document.title = "How to read it | Housing System Fingerprint"; }
    else { renderIntro(); document.title = "Housing System Fingerprint | Real Estate Reframed"; }
    if (S.route === "explore" && S.d) {
      // Deep links (e.g. from Articles 3, 13 and 14) land on the explorer. Jump
      // instantly (CSS smooth scrolling would otherwise animate from the top) and
      // jump again once web fonts settle, because they change the page height.
      const target = S.d ? "dim-" + S.d : "explore";
      const jump = () => scrollToId(target, "instant");
      requestAnimationFrame(jump);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(jump);
    } else if (fromNav) {
      window.scrollTo(0, 0);
      $app.focus({ preventScroll: true });
    }
  }
  window.addEventListener("hashchange", () => { render(true); revealNavCurrent(); });
  MOBILE.addEventListener("change", () => { if (S.route === "country") renderCountry(); else if (S.route === "home") rerenderHome(); else if (S.route === "intro") renderIntro(); else if (S.route === "read") renderRead(); else if (S.route === "moves") renderMoves(); else if (S.route === "explore") rerenderExplorer(); });
  render(false);
  revealNavCurrent();
})();
