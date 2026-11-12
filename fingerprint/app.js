/* ============================================================
   Housing System Fingerprint Explorer — interface
   One page, hash-routed, no build step.

   Routes
     #/                  landing + explorer + mechanisms
     #/explore?…         same page, scrolled to the explorer
     #/country/JP?…      single-country mode
     #/method            methodology, sources, change log

   Query state (shareable): c=IN,CN,JP,US · v=glance|dims ·
   f=all|A..F · diff=1 · d=d07 · m=rise|fall|leverage
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
  const S = { route: "home", c: ALL.slice(), v: "glance", f: "all", diff: false, gap: 4, d: null, m: "rise", country: null, with: null };
  const open = new Set(); // expanded dimension rows
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
  function seriesLinksHTML() {
    const items = [
      ["article3", "Article 3: Your house’s last five years won’t predict the next twenty", "The underlying framework: describe the machine before forecasting its output"],
      ["article13", "Article 13: Can housing be affordable and a great investment?", "Why demand, supply and affordability behave differently across systems"],
      ["article14", "Article 14, So, should you buy this property?", "The country is the first layer: Country → City → Property → Person"],
      ["xray", "Property Decision X-Ray", "The next layers: this property, for this person, at this price"],
    ].filter(([k]) => siteLink(k));
    if (!items.length) return "";
    return `<div class="series-links"><span class="k">Continue in the series</span><ul>${items.map(([k, t, sub]) =>
      `<li>${maybeLink(k, t)}<span>${esc(sub)}</span>${opensNote(k) ? `<span class="opens">${esc(opensNote(k))}</span>` : ""}</li>`).join("")}</ul></div>`;
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

  /* Structural distance between selected placements on one dimension.
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
    S.route = parts[0] === "country" && C[(parts[1] || "").toUpperCase()] ? "country" : parts[0] === "method" ? "method" : parts[0] === "explore" ? "explore" : "home";
    S.country = S.route === "country" ? parts[1].toUpperCase() : null;
    const cs = (q.get("c") || "").split(",").map((x) => x.trim().toUpperCase()).filter((x) => C[x]);
    S.c = cs.length ? ALL.filter((id) => cs.includes(id)) : ALL.slice();
    S.v = q.get("v") === "dims" ? "dims" : "glance";
    S.f = FAM[q.get("f")] ? q.get("f") : "all";
    S.diff = q.get("diff") === "1";
    S.gap = q.get("gap") === "3" ? 3 : 4;
    S.d = DIM[q.get("d")] ? q.get("d") : null;
    S.m = ["rise", "fall", "leverage"].includes(q.get("m")) ? q.get("m") : "rise";
    if (S.d) open.add(S.d);
  }
  function stateQuery() {
    const q = new URLSearchParams();
    if (S.c.length !== ALL.length) q.set("c", S.c.join(","));
    if (S.v !== "glance") q.set("v", S.v);
    if (S.f !== "all") q.set("f", S.f);
    if (S.diff) q.set("diff", "1");
    if (S.diff && S.gap !== 4) q.set("gap", String(S.gap));
    if (S.d) q.set("d", S.d);
    if (S.m !== "rise") q.set("m", S.m);
    const s = q.toString().replace(/%2C/g, ",");
    return s ? "?" + s : "";
  }
  function writeHash() {
    const base = S.route === "country" ? `#/country/${S.country}` : S.route === "method" ? "#/method" : "#/explore";
    history.replaceState(null, "", base + (S.route === "method" ? "" : stateQuery()));
  }
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
  function laneSpectrum(d, ids, opts) {
    opts = opts || {};
    const lanes = ids.map((id) => {
      const c = C[id], p = placement(id, d.id), sl = slot(p.pos);
      const track = sl === null
        ? `<span class="lane-na">${esc(H.copy.uncertainty)}</span>`
        : `<div class="track">${[0, 1, 2, 3, 4].map((i) => `<div class="cell">${i === sl ? `<button class="mk" type="button" data-ev="${id}|${d.id}" aria-label="${esc(markerLabel(c, d, p.pos))}">${shape(c, 16)}</button>` : ""}</div>`).join("")}</div>`;
      return opts.noBadge ? `<div class="lane solo">${track}</div>` : `<div class="lane">${badge(c)}${track}</div>`;
    }).join("");
    return `<div class="lanes" role="group" aria-label="${esc(d.name)}: spectrum from ${esc(d.left)} to ${esc(d.right)}">
      <div class="lane-ends" aria-hidden="true"><span>← ${esc(d.left)}</span><span>${esc(d.right)} →</span></div>${lanes}</div>`;
  }
  const spectrum = (d, ids, opts) => (MOBILE.matches || (opts && opts.lanes) ? laneSpectrum(d, ids, opts) : sharedSpectrum(d, ids, opts));

  /* Explanatory sub-factors inside a dimension (e.g. water and basic
     servicing within Infrastructure maturity). Description only: no
     sub-position, no score. */
  function servicingHTML(d) {
    if (!d.sub_factors) return "";
    return `<div class="subf"><span class="k">What this dimension covers</span>
      <ul>${d.sub_factors.map((f) => `<li><b>${esc(f.label)}</b>: ${esc(f.note)}</li>`).join("")}</ul>
      ${d.servicing_note ? `<p>${esc(d.servicing_note)}</p>` : ""}
      ${d.scale_guard ? `<p class="subf-guard">${esc(d.scale_guard)}</p>` : ""}</div>`;
  }

  /* ---------------- dimension row ---------------- */
  function dimRow(d, ids, opts) {
    opts = opts || {};
    const big = S.diff && ids.length > 1 && isLargeDifference(d.id, ids);
    const isOpen = open.has(d.id);
    const interp = d.always_interpretive ? `<span class="tag tag-interp">Always interpretive</span>` : "";
    const rats = ids.map((id) => {
      const c = C[id], p = placement(id, d.id);
      return `<li>${badge(c)}<div><span class="rat-pos">${esc(H.POSITIONS[p.pos].label)} · ${esc(H.CONFIDENCE[p.conf].label)}${p.variation ? " · large internal variation" : ""}</span>${esc(p.short)}<br><button class="linkbtn" type="button" data-ev="${id}|${d.id}">${esc(H.copy.evidenceCta)}</button></div></li>`;
    }).join("");
    return `<article class="dim${big ? " is-big" : ""}${S.d === d.id ? " is-target" : ""}" id="dim-${d.id}">
      <div class="dim-head">
        <button class="dim-toggle" type="button" data-dimtoggle="${d.id}" aria-expanded="${isOpen}" aria-controls="more-${d.id}" data-fk="dt-${d.id}">
          <span class="dim-n">${d.n}</span><span class="dim-name">${esc(d.name)}</span><span class="chev" aria-hidden="true"></span>
        </button>
        <span>${big ? `<span class="tag tag-big">Large structural difference</span> ` : ""}${interp}</span>
      </div>
      ${spectrum(d, ids)}
      <div class="dim-more" id="more-${d.id}"${isOpen ? "" : " hidden"}>
        <div class="about">
          <p><span class="k">Definition</span>${esc(d.short_definition)}</p>
          <p><span class="k">Why it matters</span>${esc(d.why_it_matters)}</p>
          <p><span class="k">Trade-off</span>${esc(d.tradeoff)}</p>
          ${servicingHTML(d)}
        </div>
        <ul class="rats">${rats}</ul>
      </div>
    </article>`;
  }

  /* ---------------- views ---------------- */
  function heroHTML() {
    return `<section class="hero"><div class="wrap">
      <p class="eyebrow">Interactive companion to Article 3 · Real Estate Reframed</p>
      <h1>${esc(H.copy.headline)}</h1>
      <p class="lede">${esc(H.copy.deck)}</p>
      <div class="guard"><span class="guard-mark" aria-hidden="true">≠</span><span><b>This is a fingerprint, not a scorecard.</b> Farther left or right is not better; it is simply different. ${esc(H.copy.method)}</span></div>
      <p class="hero-a3">The framework behind this tool comes from Article 3, ${maybeLink("article3", "Your House’s Last Five Years Won’t Predict the Next Twenty")}: describe the machine before you forecast its output.</p>
      <nav class="hero-nav" aria-label="Sections">
        <a href="#machines">Four housing machines</a>
        <a href="${exploreHref({})}" data-scroll="explore">Explore the fingerprint</a>
        <a href="#mechanisms">Same outcome, different machine</a>
        <a href="#/method">Methodology &amp; sources</a>
      </nav>
    </div></section>`;
  }

  function machinesHTML() {
    const apts = COUNTRIES.map((c) => {
      const parts = (H.fourApartments[c.id] || []);
      return parts.length ? `<div class="apt">${badge(c, true)}<div>${parts.map(esc).join(' <span class="apt-plus">+</span> ')}</div></div>` : "";
    }).join("");
    const cards = COUNTRIES.map((c) => `
      <article class="mcard" style="--c:${c.color}">
        <div class="mcard-top"><h3 class="mcard-name">${esc(c.name)}</h3>${badge(c)}</div>
        <p class="mcard-label">${esc(c.fingerprint_label)}</p>
        <div><span class="mcard-k">System mechanism</span><p>${esc(c.mechanism)}</p></div>
        <div><span class="mcard-k">Principal friction</span><p>${esc(c.friction)}</p></div>
        <div class="dni"><span class="mcard-k">What not to infer</span><p>${esc(c.do_not_infer)}</p></div>
        <div class="mcard-foot"><span class="asof">${esc(H.copy.freshness)}: ${esc(c.profile_as_of)}</span>
          <a class="btn small" href="#/country/${c.id}">Open ${esc(c.name)}’s fingerprint →</a></div>
      </article>`).join("");
    return `<section class="part" id="machines"><div class="wrap">
      <div class="part-head"><span class="part-num">Four machines</span>
        <h2>Four countries. Four housing machines.</h2>
        <p class="part-sub lines"><span>Four people each buy an apartment. All four believe they bought “real estate”. Each actually bought into a different system:</span></p>
      </div>
      <div class="apts">${apts}</div>
      <div class="machines">${cards}</div>
      <p class="note">These are concise system summaries, not permanent national identities. Fingerprints change over time: each profile is a current snapshot.</p>
    </div></section>`;
  }

  function toolbarHTML() {
    const chips = COUNTRIES.map((c) => {
      const on = S.c.includes(c.id);
      return `<button class="chip" type="button" style="--c:${c.color}" data-togglec="${c.id}" aria-pressed="${on}" data-fk="c-${c.id}" ${on && S.c.length === 1 ? 'aria-disabled="true" title="At least one country stays selected"' : ""}>${shape(c, 13)}${esc(c.name)}</button>`;
    }).join("");
    const fams = S.v === "dims" ? `<div class="tb-group fam-row" role="group" aria-label="Filter by family"><span class="tb-label">Family</span>
        <button class="chip fam" type="button" data-fam="all" aria-pressed="${S.f === "all"}" data-fk="f-all">All</button>
        ${H.families.map((f) => `<button class="chip fam" type="button" data-fam="${f.id}" aria-pressed="${S.f === f.id}" data-fk="f-${f.id}">${f.id}. ${esc(f.name)}</button>`).join("")}
      </div>` : "";
    const canDiff = S.c.length > 1;
    return `<div class="toolbar" role="region" aria-label="Explorer controls">
      <div class="tb-group" role="group" aria-label="Countries"><span class="tb-label">Countries</span>${chips}</div>
      <div class="seg" role="group" aria-label="View">
        <button type="button" data-view="glance" aria-pressed="${S.v === "glance"}" data-fk="v-glance">At a glance</button>
        <button type="button" data-view="dims" aria-pressed="${S.v === "dims"}" data-fk="v-dims">24 dimensions</button>
      </div>
      <label class="switch" title="${canDiff ? "" : "Select two or more countries"}"><input type="checkbox" data-diff ${S.diff && canDiff ? "checked" : ""} ${canDiff ? "" : "disabled"} data-fk="diff" />Show largest structural differences</label>
      ${S.diff && canDiff ? `<div class="seg seg-sm" role="group" aria-label="How far apart counts as a large difference">
        <button type="button" data-gap="4" aria-pressed="${S.gap === 4}" data-fk="gap-4">Opposite ends</button>
        <button type="button" data-gap="3" aria-pressed="${S.gap === 3}" data-fk="gap-3">3+ positions apart</button>
      </div>` : ""}
      ${fams}
    </div>`;
  }

  function diffSummary(dimIds) {
    if (!S.diff || S.c.length < 2) return "";
    const big = dimIds.filter((id) => isLargeDifference(id, S.c));
    if (!big.length) return `<div class="diffsum">No dimension in this view has ${esc(cnames(S.c))} ${gapPhrase()}. Try “3+ positions apart”, or a different set of countries.</div>`;
    return `<div class="diffsum"><b>Largest structural differences</b>: ${big.length} ${big.length === 1 ? "dimension" : "dimensions"} where ${esc(cnames(S.c))} sit ${gapPhrase()}. These are differences in kind, not advantages or disadvantages.
      <ul>${big.map((id) => `<li><button type="button" data-goto="${id}">${DIM[id].n}. ${esc(DIM[id].name)}</button></li>`).join("")}</ul></div>`;
  }

  function legendHTML() {
    return `<div class="legend" aria-hidden="true">${S.c.map((id) => badge(C[id], true)).join("")}
      <span class="legend-note">Each row is a spectrum between two named system states. Five discrete positions, no scores. ${esc(H.copy.antiRank)} Select any marker to see why it is placed there.</span></div>`;
  }

  function glanceHTML() {
    const ids = S.c;
    const lenses = H.lenses.map((L) => {
      const sums = ids.map((id) => `<li>${badge(C[id])}<span>${esc(C[id].lens_summaries[L.id] || "")}</span></li>`).join("");
      const minis = L.dims.map((did) => {
        const d = DIM[did], big = S.diff && ids.length > 1 && isLargeDifference(did, ids);
        return `<div class="mini-dim${big ? " is-big" : ""}"><div class="mini-dim-name"><span>${d.n}. ${esc(d.name)}${big ? ' <span class="tag tag-big">Large difference</span>' : ""}</span><button class="linkbtn" type="button" data-goto="${did}">Details</button></div>${spectrum(d, ids, { compact: true })}</div>`;
      }).join("");
      return `<article class="lens" id="lens-${L.id}">
        <div class="lens-head"><span class="lens-n" aria-hidden="true">${L.n}</span><div><h3><span class="sr">Lens ${L.n}: </span>${esc(L.question)}</h3><p>${esc(L.understand)}</p></div></div>
        <div class="lens-body">
          <ul class="lens-sum" aria-label="Editorial summary by country">${sums}</ul>
          <div class="lens-dims" aria-label="Underlying dimensions">${minis}</div>
        </div>
      </article>`;
    }).join("");
    return `${legendHTML()}${diffSummary(H.dimensions.map((d) => d.id))}
      <p class="note" style="margin:0 0 16px">Each lens is an editorial question over the 24-dimension model. Its summary sentences are written, not calculated: nothing is averaged into a lens position. The markers beside them are the underlying dimensions.</p>
      <div class="lenses">${lenses}</div>
      <div class="lens-foot"><button class="btn" type="button" data-view="dims">${esc(H.copy.deepCta)} →</button></div>`;
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

  function explorerHTML() {
    return `<section class="part" id="explore"><div class="wrap">
      <div class="part-head"><span class="part-num">Explore</span>
        <h2>Explore the fingerprint</h2>
        <p class="part-sub lines"><span>Start with eight plain-English questions. Then open all 24 dimensions, grouped into six families, and inspect the evidence behind any placement.</span>
        <span>Compare one to four countries on the same rows. <em>${esc(H.copy.cue)}</em></span></p>
      </div>
      <details class="which"><summary>Which housing system is best?</summary><p>${esc(H.copy.whichBetter)}</p></details>
      ${toolbarHTML()}
      <div id="explorer-body">${explorerBodyHTML()}</div>
    </div></section>`;
  }

  function mechChainsHTML() {
    const M = H.mechanisms.find((m) => m.id === S.m);
    let rows;
    if (M.id === "leverage") {
      rows = S.c.map((id) => {
        const c = C[id];
        return `<div class="chain" style="--c:${c.color}"><div class="chain-who">${badge(c, true)}<span class="period">Today</span></div>
          <div><p class="lev-site">${esc(c.leverage.site)}</p><p class="chain-note" style="margin:0">${esc(c.leverage.text)}</p></div>
          <div class="chain-dims"><span>Dimensions behind this:</span>${M.dims.map((did) => `<button class="linkbtn" type="button" data-ev="${id}|${did}">${esc(DIM[did].name)}</button>`).join("")}</div></div>`;
      }).join("");
    } else {
      rows = S.c.map((id) => {
        const c = C[id], ch = M.chains[id];
        if (!ch) return `<div class="chain" style="--c:${c.color}"><div class="chain-who">${badge(c, true)}</div><p class="chain-note">Mechanism chain not yet written for this country.</p></div>`;
        return `<div class="chain" style="--c:${c.color}"><div class="chain-who">${badge(c, true)}<span class="period">${esc(ch.period)}</span></div>
          <ol class="steps" aria-label="${esc(c.name)} mechanism">${ch.steps.map((s) => `<li><span>${esc(s)}</span></li>`).join("")}</ol>
          ${ch.note ? `<p class="chain-note">${esc(ch.note)}</p>` : ""}
          <div class="chain-dims"><span>Dimensions behind this:</span>${ch.dims.map((did) => `<button class="linkbtn" type="button" data-ev="${id}|${did}">${esc(DIM[did].name)}</button>`).join("")}</div></div>`;
      }).join("");
    }
    return `<h3 class="mech-title">${esc(M.title)}</h3><p class="mech-intro">${esc(M.intro)}</p>
      <div class="chains">${rows}</div><p class="cue mech-caption">${esc(M.caption)}</p>`;
  }

  function mechanismsHTML() {
    return `<section class="part" id="mechanisms"><div class="wrap">
      <div class="part-head"><span class="part-num">Mechanisms</span>
        <h2>Same outcome, different machine</h2>
        <p class="part-sub">A price chart records the combined result of the system. It does not tell you which forces produced it, or how a shock would travel. These stylised chains come from the cross-country comparison; each is dated, and none is a forecast.</p>
      </div>
      <div class="seg mech-tabs" role="group" aria-label="Scenario">${H.mechanisms.map((m) => `<button type="button" data-mech="${m.id}" aria-pressed="${S.m === m.id}" data-fk="m-${m.id}">${esc(m.tab)}</button>`).join("")}</div>
      <div id="mech-body">${mechChainsHTML()}</div>
      <p class="note">Shown for the countries selected in the explorer above.</p>
    </div></section>`;
  }

  function layersHTML() {
    return `<section class="part" id="layers"><div class="wrap">
      <div class="part-head"><span class="part-num">Context, not a forecast</span>
        <h2>The country is only the first layer</h2>
        <p class="part-sub">${esc(H.copy.propertyGuard)} A strong system can contain a weak city; a strong city can contain a weak corridor; a good micro-market can contain one poorly built or legally problematic property.</p>
      </div>
      <ol class="layers">
        <li><span class="here">This explorer</span><b>Country</b><span>What system am I buying inside?</span></li>
        <li><b>City</b><span>Where inside that system am I buying?</span></li>
        <li><b>Property</b><span>What exactly is this asset?</span></li>
        <li><b>Person</b><span>What does this asset do to me?</span></li>
      </ol>
      ${seriesLinksHTML()}
      <div class="card method-teaser">
        <div><h3>How to read the Fingerprint</h3><p class="cue" style="font-size:1.1rem">${esc(H.copy.method)}</p></div>
        <div><ul class="checks">
          <li>Every dimension is qualitative: five positions on a spectrum between two named system states, never a measured score.</li>
          <li>The framework is descriptive, not normative. Nothing is added up, ranked or turned into a “best market”.</li>
          <li>Each country profile is a current snapshot, dated, with confidence and sources on every placement.</li>
          <li>National profiles do not determine city or property outcomes. Every country has large internal variation.</li>
          <li>Evidence evolves. Placements are reviewed dimension by dimension, and every change is logged.</li>
        </ul><p class="teaser-links"><a class="btn small" href="#/method">Read the methodology →</a>${seriesMethodHref() ? `<a class="btn-ghost small" href="${esc(seriesMethodHref())}">Series Methodology &amp; Concepts →</a>` : ""}</p></div>
      </div>
    </div></section>`;
  }

  function renderHome() {
    $app.innerHTML = heroHTML() + machinesHTML() + explorerHTML() + mechanismsHTML() + layersHTML();
  }

  /* ---------------- country page ---------------- */
  function renderCountry() {
    const c = C[S.country];
    const others = COUNTRIES.filter((x) => x.id !== c.id);
    const lensList = H.lenses.map((L) => `<div class="lens-item"><span class="k">${L.n}. ${esc(L.short)}</span><p>${esc(c.lens_summaries[L.id])}</p></div>`).join("");
    const fams = H.families.map((f) => `<section class="family single" id="fam-${f.id}">
        <div class="fam-head"><span class="fam-letter" aria-hidden="true">${f.id}</span><h3>${esc(f.name)}</h3><p class="fam-q">${esc(f.question)}</p></div>
        <div class="dims">${H.dimensions.filter((d) => d.family === f.id).map((d) => {
          const p = placement(c.id, d.id);
          return `<article class="dim" id="dim-${d.id}"><div class="dim-head"><span class="dim-toggle" style="cursor:default"><span class="dim-n">${d.n}</span><span class="dim-name">${esc(d.name)}</span></span>
              <span>${p.conf === "interpretive" ? '<span class="tag tag-interp">Interpretive</span> ' : ""}${p.variation ? '<span class="tag tag-var">Large internal variation</span>' : ""}</span></div>
            ${laneSpectrum(d, [c.id], { noBadge: true })}
            <div class="single-rat"><p><span class="rat-pos muted" style="font-size:.78rem">${esc(H.POSITIONS[p.pos].label)}: ${esc(posPhrase(d, p.pos))}</span><br>${esc(p.short)}</p>
              <button class="linkbtn" type="button" data-ev="${c.id}|${d.id}">${esc(H.copy.evidenceCta)}</button></div></article>`;
        }).join("")}</div></section>`).join("");
    $app.innerHTML = `<section class="hero-sm"><div class="wrap">
      <a class="back" href="${exploreHref({})}">← All countries</a>
      <div class="c-hero">
        <div>
          <p class="eyebrow">Country fingerprint · ${esc(H.copy.freshness)}: ${esc(c.profile_as_of)}</p>
          <h1>${shape(c, 30)}${esc(c.name)}</h1>
          <p class="c-label">${esc(c.fingerprint_label)}</p>
          <p><b>System mechanism.</b> ${esc(c.mechanism)}</p>
          <p><b>Principal friction.</b> ${esc(c.friction)}</p>
        </div>
        <div class="side-stack">
          <div class="dni" style="border-radius:0 12px 12px 0;padding:12px 16px"><span class="mcard-k">What not to infer</span><p style="margin:0;font-size:.94rem">${esc(c.do_not_infer)}</p></div>
          <p class="var-note">${esc(c.variation_note)}</p>
          <div class="card compare-box">
            <label for="cmp">Compare ${esc(c.name)} with…</label>
            <div class="compare-row"><select id="cmp">${others.map((o) => `<option value="${o.id}">${esc(o.name)}</option>`).join("")}<option value="ALL">All four countries</option></select>
              <button class="btn small" type="button" data-compare="${c.id}">Compare on 24 dimensions →</button></div>
          </div>
        </div>
      </div>
    </div></section>
    <section class="part"><div class="wrap">
      <div class="part-head"><span class="part-num">At a glance</span><h2>Eight questions about ${esc(c.name)}’s machine</h2></div>
      <div class="lens-list">${lensList}</div>
      <div class="chain" style="--c:${c.color};margin-top:22px"><div class="chain-who"><span class="mcard-k" style="margin:0">How the machine has run</span><span class="period">${esc(c.machine.period)}</span></div>
        <ol class="steps">${c.machine.steps.map((s) => `<li><span>${esc(s)}</span></li>`).join("")}</ol>
        <p class="chain-note">${esc(c.machine.constraint)}</p></div>
    </div></section>
    <section class="part"><div class="wrap">
      <div class="part-head"><span class="part-num">24 dimensions</span><h2>All six families, in sequence</h2>
        <p class="part-sub">${esc(H.copy.antiRank)} ${esc(H.copy.propertyGuard)}</p></div>
      ${fams}
    </div></section>`;
  }

  /* ---------------- method page ---------------- */
  function renderMethod() {
    const cites = {};
    COUNTRIES.forEach((c) => Object.values(c.placements).forEach((p) => p.src.forEach((s) => (cites[s] = (cites[s] || 0) + 1))));
    const demoD = { name: "Example dimension", left: "System state A", right: "System state B" };
    const demo = `<div class="pos-demo"><div class="spec" aria-hidden="true"><span class="spec-end spec-l">${esc(demoD.left)}</span><div class="track">${[0, 1, 2, 3, 4].map(() => '<div class="cell"></div>').join("")}</div><span class="spec-end spec-r">${esc(demoD.right)}</span></div>
      <div class="pos-names" aria-hidden="true"><div>${["Left", "Mid-left", "Middle", "Mid-right", "Right"].map((x) => `<span>${x}</span>`).join("")}</div></div></div>`;
    const confRows = Object.entries(H.CONFIDENCE).map(([k, v]) => `<tr><td><b>${esc(v.label)}</b></td><td>${esc(v.means)}</td><td>${k === "high" ? "Label in the evidence drawer." : k === "medium" ? "Label plus a one-sentence comparability note." : "Labelled wherever shown; the basis is explained, never disguised as hard data."}</td></tr>`).join("");
    const confCounts = {};
    COUNTRIES.forEach((c) => Object.values(c.placements).forEach((p) => (confCounts[p.conf] = (confCounts[p.conf] || 0) + 1)));
    const cadRows = H.dimensions.map((d) => `<tr><td>${d.n}. ${esc(d.name)}</td><td>${esc(d.update_cadence)}</td><td>${esc(d.evidence_type)}</td></tr>`).join("");
    const srcRows = H.sources.map((s) => `<tr id="src-${s.source_id}"><td><b>${esc(s.publisher)}</b><br>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}</td><td>${esc(s.geography)}<br><span class="muted">${esc(s.data_period)}</span></td><td>${esc(s.source_type)}</td><td>${cites[s.source_id] || 0}</td></tr>`).join("");
    const logRows = H.changelog.map((l) => `<tr><td>${esc(l.effective_date)}</td><td>${l.country_id === "*" ? "All" : esc(C[l.country_id] ? C[l.country_id].name : l.country_id)}</td><td>${l.dimension_id === "*" ? "All 24" : esc(DIM[l.dimension_id].name)}</td><td>${l.previous_position ? esc(H.POSITIONS[l.previous_position] ? H.POSITIONS[l.previous_position].label : l.previous_position) + " → " : ""}${esc(H.POSITIONS[l.new_position] ? H.POSITIONS[l.new_position].label : l.new_position)}</td><td>${esc(l.reason)}</td></tr>`).join("");
    const nav = [["m-what", "What it is"], ["m-place", "Placement method"], ["m-conf", "Confidence"], ["m-evidence", "Evidence standards"], ["m-limits", "Comparability & uncertainty"], ["m-design", "Framework decisions"], ["m-update", "Update policy"], ["m-not", "What it does not do"], ["m-sources", "Sources"], ["m-log", "Change log"]];
    $app.innerHTML = `<section class="hero-sm"><div class="wrap">
      <a class="back" href="${exploreHref({})}">← Back to the explorer</a>
      <p class="eyebrow">Methodology</p>
      <h1 style="font-size:clamp(2rem,4.5vw,3rem);margin:0 0 14px">How the Fingerprint is built</h1>
      <p class="lede">Qualitative placements, explicit evidence, visible uncertainty, and a hard rule against turning any of it into a score.</p>
      ${seriesMethodHref() ? `<p class="hero-a3">This page explains how this tool places countries. Definitions shared across the whole series are on the <a href="${esc(seriesMethodHref())}">Real Estate Reframed Methodology &amp; Concepts page</a>.</p>` : ""}
    </div></section>
    <div class="wrap"><div class="m-grid">
      <nav class="m-nav" aria-label="Methodology sections">${nav.map(([id, t]) => `<a href="#${id}" data-anchor="${id}">${t}</a>`).join("")}</nav>
      <div>
        <section class="m-sec" id="m-what"><h2>What the Fingerprint is</h2>
          <div class="req-lines"><p class="cue">${esc(H.copy.cue)}</p><p class="cue">${esc(H.copy.method)}</p></div>
          <p>A house does not exist inside a generic real-estate market. It exists inside a housing system. The Housing System Fingerprint is a common set of dimensions describing the demographic, supply, financing, development, legal and institutional conditions through which a country’s housing market operates.</p>
          <p>It is <b>descriptive, not normative</b>. Endpoints describe different system states, not good and bad poles. Deep mortgages can improve access and increase leverage; responsive supply can improve affordability and reduce appreciation; a housing shortage can be painful social policy while supporting incumbent owners’ prices. Each feature helps some objectives and hurts others.</p>
          <p>Each country profile is a <b>current snapshot</b> (${esc(H.meta.profile_as_of)}), not a permanent national personality. ${esc(H.copy.propertyGuard)}</p>
          <p>The Explorer operationalises the system-level ideas in Real Estate Reframed ${maybeLink("article3", "Article 3")} (describe the machine before forecasting its output), its primary home. It also supports ${maybeLink("article13", "Article 13")} (why demand, supply and affordability behave differently across systems) and ${maybeLink("article14", "Article 14")} (the country as the first layer of Country → City → Property → Person).</p>
        </section>
        <section class="m-sec" id="m-place"><h2>Placement method</h2>
          <p>Each of the 24 dimensions is a spectrum between two explicitly named endpoints. Every country is placed in one of five qualitative positions:</p>
          ${demo}
          <ul>
            <li>Positions are discrete anchors, not a continuous slider; this avoids false precision.</li>
            <li>Placement is comparative and evidence-led, but deliberately not presented as a measured index value. No number is displayed, summed, averaged, converted to a percentile or used to rank countries.</li>
            <li>Where comparable data are strong, the rationale cites them. Where a dimension is institutional or behavioural, the placement is labelled as a synthesis judgement.</li>
            <li>If evidence is materially insufficient, the product shows “${esc(H.copy.uncertainty)}” instead of forcing a marker.</li>
            <li>The eight “at a glance” lenses are editorial questions over the model. Their summary sentences are written, never calculated from the underlying dimensions.</li>
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
          <div class="tbl-wrap"><table><thead><tr><th>Situation</th><th>What the Explorer does</th></tr></thead><tbody>
            <tr><td><b>Missing current evidence</b></td><td>Shows the last verified placement only if still defensible, flagged “evidence refresh due”; otherwise shows no marker.</td></tr>
            <tr><td><b>Conflicting reputable sources</b></td><td>Keeps the placement if the direction is robust and explains the conflict; marks it under review if direction is affected.</td></tr>
            <tr><td><b>Large regional variation</b></td><td>Keeps the national placement as a system prior and adds a “large internal variation” note. Nothing is averaged into false precision.</td></tr>
            <tr><td><b>Recent reform not yet in outcomes</b></td><td>Updates the rationale immediately; moves the marker only when the structural condition has materially changed.</td></tr>
            <tr><td><b>Crisis causing rapid change</b></td><td>Event-driven review with a dated note; dimensions are not rewritten reflexively.</td></tr>
            <tr><td><b>“Which is better?”</b></td><td>${esc(H.copy.whichBetter)}</td></tr>
          </tbody></table></div>
        </section>
        <section class="m-sec" id="m-design"><h2>Framework decisions</h2>
          <h3>Six families</h3><p>Fingerprint v1.0 refers to “five families” but enumerates six (A–F). The Explorer uses the six enumerated families as canonical.</p>
          <h3>Causes, not every consequence</h3><p>Vacancy and affordability are not separate country-level axes. Vacancy is partly an outcome of stock balance, mismatch and demographics; affordability is partly an outcome of income, prices, rates, supply and geography, and national averages hide large city differences. Both belong at the city layer. Keeping them out avoids double-counting.</p>
          <h3>One developer-fragility dimension</h3><p>Dimension 16 deliberately combines presale dependence and developer leverage. Separating them would count essentially the same systemic vulnerability twice.</p>
          <h3>Water and basic urban servicing sit inside Infrastructure maturity</h3><p>Housing stock is not the same thing as sustainably serviced housing capacity. Dimension 10 therefore covers reliable water supply, sustainable groundwater use, sewage and wastewater, drainage and power alongside transport, and reads maturity as the reliability and scalability of those systems rather than their mere existence. Water is deliberately not a 25th dimension and carries no separate score: it shares causes with the rest of the infrastructure system, and comparable country-level servicing evidence has not yet been assembled. National placements never describe the water security of a particular city or project.</p>
          <h3>Why there is no radar chart</h3><p>Radar area behaves visually like an overall magnitude even though the axes are unlike and non-normative; changing axis order changes the silhouette without changing the data; a larger area reads as “stronger”. Aligned spectra let each dimension be read on its own terms.</p>
        </section>
        <section class="m-sec" id="m-update"><h2>Update policy</h2>
          <p>The framework is relatively stable; placements and evidence are not. Updates are dimension-driven rather than one annual rewrite. Placement changes need reviewer sign-off and are recorded in the change log, so history is never overwritten silently. Normal cyclical moves (for example in interest rates) do not shift structural placements.</p>
          <div class="tbl-wrap"><table><thead><tr><th>Dimension</th><th>Review cadence</th><th>Evidence type</th></tr></thead><tbody>${cadRows}</tbody></table></div>
          <h3>Adding a country</h3><p>A new country extends the same 24-dimension model; the framework does not grow because a country is added. It publishes only when it has a four-part profile (label, mechanism, friction, what not to infer), a placement or an explicit “not enough comparable evidence” on all 24 dimensions, sources, dates and confidence for each, and has passed anti-ranking and cross-country consistency checks. Another country’s placement is never reused as a proxy.</p>
        </section>
        <section class="m-sec" id="m-not"><h2>What this Explorer does not do</h2>
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
          <div class="tbl-wrap"><table><thead><tr><th>Source</th><th>Geography · period</th><th>Type</th><th>Placements citing</th></tr></thead><tbody>${srcRows}</tbody></table></div>
        </section>
        <section class="m-sec" id="m-log"><h2>Change log</h2>
          <div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Country</th><th>Dimension</th><th>Change</th><th>Reason</th></tr></thead><tbody>${logRows}</tbody></table></div>
        </section>
      </div>
    </div></div>`;
  }

  /* ---------------- evidence drawer ---------------- */
  function drawerHTML(cid, did) {
    const c = C[cid], d = DIM[did], p = placement(cid, did), conf = H.CONFIDENCE[p.conf];
    const showNote = p.conf !== "high" ? (p.note || d.comparability) : p.note;
    const srcs = p.src.map((id) => SRC[id]).filter(Boolean).map((s) => `<li><span class="src-pub">${esc(s.publisher)}</span>: ${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}
        <span class="src-meta">${esc(s.source_type)} · ${esc(s.geography)} · ${esc(s.data_period)}</span></li>`).join("");
    const tabs = COUNTRIES.map((o) => `<button class="chip" type="button" style="--c:${o.color}" data-drc="${o.id}" aria-pressed="${o.id === cid}">${shape(o, 13)}${esc(o.name)}</button>`).join("");
    return `<div class="dr-head"><div><p class="eyebrow" style="margin:0">${esc(FAM[d.family].name)} · Dimension ${d.n}</p><h2 id="dr-title">${esc(d.name)}</h2></div>
        <button class="dr-close" type="button" data-close aria-label="Close evidence panel">×</button></div>
      <div class="dr-body">
        <div class="dr-tabs" role="group" aria-label="Country">${tabs}</div>
        <div>${laneSpectrum(d, [cid])}<p class="dr-pos"><b>${esc(c.name)}: ${esc(H.POSITIONS[p.pos].label)}</b>: ${esc(posPhrase(d, p.pos))}.</p></div>
        <div><p class="dr-q">${esc(H.copy.evidenceCta)}</p><p class="dr-short">${esc(p.short)}</p>${p.long ? `<p class="dr-long">${esc(p.long)}</p>` : ""}</div>
        <div class="conf"><span class="conf-label ${p.conf}">${esc(conf.label)}</span><p>${esc(conf.means)}</p>${showNote ? `<p><b>Comparability:</b> ${esc(showNote)}</p>` : ""}</div>
        ${p.variation ? `<p class="var-note" style="margin:0">${esc(c.variation_note)}</p>` : ""}
        <div class="dr-meta"><span>${esc(H.copy.freshness)}: ${esc(p.as_of)}</span><span>Status: ${esc(p.reviewer_status)}</span></div>
        <div><span class="k" style="margin-bottom:8px">Sources</span><ul class="srcs">${srcs || "<li>No source attached.</li>"}</ul></div>
        <details class="dr-about"><summary>About this dimension</summary>
          <p><span class="k">Definition</span>${esc(d.short_definition)}</p>
          <p><span class="k">Why it matters</span>${esc(d.why_it_matters)}</p>
          <p><span class="k">Trade-off</span>${esc(d.tradeoff)}</p>
          ${servicingHTML(d)}
          <p><span class="k">Endpoints</span>Left: ${esc(d.left)}. Right: ${esc(d.right)}.</p>
        </details>
      </div>
      <div class="dr-foot">${esc(H.copy.antiRank)} <a href="#/method">Methodology</a></div>`;
  }
  function openDrawer(cid, did, returnTo) {
    const keep = returnTo === "keep";
    const back = keep ? drawerState && drawerState.returnTo : returnTo || document.activeElement;
    drawerState = { cid, did, returnTo: back };
    $drawer.innerHTML = drawerHTML(cid, did);
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
    const fk = document.activeElement && document.activeElement.getAttribute("data-fk");
    const ex = document.getElementById("explore");
    if (!ex) return;
    const tb = ex.querySelector(".toolbar");
    tb.outerHTML = toolbarHTML();
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
    if (S.f !== "all" && S.f !== DIM[did].family) S.f = "all";
    S.d = did; open.add(did);
    rerenderExplorer();
    scrollToId("dim-" + did);
    const t = document.querySelector(`[data-dimtoggle="${did}"]`);
    if (t) t.focus({ preventScroll: true });
    announce(`Showing dimension ${DIM[did].n}, ${DIM[did].name}`);
  }

  /* ---------------- events ---------------- */
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-ev],[data-togglec],[data-view],[data-fam],[data-dimtoggle],[data-goto],[data-mech],[data-gap],[data-drc],[data-close],[data-compare],[data-anchor],[data-scroll]");
    if (!t) return;
    if (t.dataset.ev) { const [cid, did] = t.dataset.ev.split("|"); openDrawer(cid, did, t); track("drawer-opened"); return; }
    if (t.dataset.drc) { openDrawer(t.dataset.drc, drawerState.did, "keep"); return; }
    if (t.hasAttribute("data-close")) { closeDrawer(); return; }
    if (t.dataset.togglec) {
      const id = t.dataset.togglec;
      if (S.c.includes(id)) { if (S.c.length === 1) { announce("At least one country stays selected"); return; } S.c = S.c.filter((x) => x !== id); }
      else S.c = ALL.filter((x) => S.c.includes(x) || x === id);
      if (S.c.length < 2) S.diff = false;
      rerenderExplorer(); announce(`Showing ${cnames(S.c)}`); track("compare-changed"); return;
    }
    if (t.dataset.view) {
      S.v = t.dataset.view; if (S.v === "glance") S.f = "all";
      rerenderExplorer();
      if (!t.closest(".toolbar")) scrollToId("explore");
      announce(S.v === "dims" ? "Showing all 24 dimensions" : "Showing eight lenses at a glance");
      track(S.v === "dims" ? "view-24-dimensions" : "view-at-a-glance"); return;
    }
    if (t.dataset.fam) { S.f = t.dataset.fam; rerenderExplorer(); announce(S.f === "all" ? "All families" : `Family ${FAM[S.f].name}`); return; }
    if (t.dataset.dimtoggle) {
      const id = t.dataset.dimtoggle, more = document.getElementById("more-" + id), now = !open.has(id);
      now ? open.add(id) : open.delete(id);
      t.setAttribute("aria-expanded", now); if (more) more.hidden = !now;
      S.d = now ? id : (S.d === id ? null : S.d); writeHash(); return;
    }
    if (t.dataset.goto) { gotoDim(t.dataset.goto); return; }
    if (t.dataset.gap) {
      S.gap = t.dataset.gap === "3" ? 3 : 4; rerenderExplorer();
      announce(S.gap === 4 ? "Highlighting dimensions at opposite ends" : "Highlighting dimensions three or more positions apart");
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
      S.v = "dims"; S.f = "all"; S.diff = S.c.length > 1; S.d = null; track("compare-changed");
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
    if (S.route !== "home" && S.route !== "explore") { location.hash = "#/"; setTimeout(() => scrollToId(href.slice(1)), 60); return; }
    scrollToId(href.slice(1));
  });

  /* ---------------- render ---------------- */
  function render(fromNav) {
    parseHash();
    closeDrawer();
    if (S.route === "country") { renderCountry(); document.title = `${C[S.country].name} | Housing System Fingerprint Explorer`; }
    else if (S.route === "method") { renderMethod(); document.title = "Methodology | Housing System Fingerprint Explorer"; }
    else { renderHome(); document.title = "Housing System Fingerprint Explorer | Real Estate Reframed"; }
    if (S.route === "explore" || (S.route === "home" && S.d)) {
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
  window.addEventListener("hashchange", () => render(true));
  MOBILE.addEventListener("change", () => { if (S.route === "country") renderCountry(); else if (S.route !== "method") rerenderExplorer(); });
  render(false);
})();
