/* ============================================================
   Property Decision Worksheet — hand-off with the other
   Real Estate Reframed tools.

   Worksheet <-> X-Ray: each tool keeps its own case model; this
   file translates between them. Shared field names carry over
   directly; everything else is mapped explicitly below. Pure
   functions, no DOM; runs in the browser and in Node.

   Transport (see app.js): when the tools share an origin — e.g.
   all three under one domain — cases travel through each tool's
   localStorage; a JSON file works everywhere else.
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WSHandoff = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const XRAY_STORE = "zenca.xray.v1";
  const FILE_KIND_WORKSHEET = "zenca.property-decision-worksheet";
  const FILE_KIND_XRAY = "zenca.property-decision-xray.case";

  // Where the sibling tools may live, relative to the worksheet. The first
  // one that answers is used: the short names are the intended deployed
  // layout, the long ones match the build folders for local testing.
  const TOOL_CANDIDATES = {
    xray: ["../x-ray/", "../property-decision-xray/"],
    fingerprint: ["../fingerprint/", "../housing-fingerprint-explorer/"],
  };

  const isBlank = (v) => v === null || v === undefined || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && !v.length);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const pick = (map, v) => (v === undefined || v === null || v === "" ? undefined : map[v]);
  const sum = (o) => Object.keys(o || {}).reduce((a, k) => a + (+o[k] || 0), 0) || "";

  /* ---------- Vocabulary maps (worksheet <-> X-Ray) ----------------- */

  const SIGNAL_TO_X = {
    jobs: { strong: "tailwind", weak: "headwind", mixed: "mixed", unknown: "unknown" },
    migration: { strong: "tailwind", weak: "headwind", mixed: "mixed", unknown: "unknown" },
    incomes: { strong: "tailwind", weak: "headwind", mixed: "mixed", unknown: "unknown" },
    supply: { low: "tailwind", high: "headwind", medium: "mixed", unknown: "unknown" },
    infrastructure: { improving: "tailwind", weakening: "headwind", stable: "mixed", unknown: "unknown" },
    rents: { supports: "tailwind", doesnot: "headwind", mixed: "mixed", unknown: "unknown" },
  };
  const invert = (m) => Object.keys(m).reduce((o, k) => { o[m[k]] = k; return o; }, {});
  const SIGNAL_FROM_X = Object.keys(SIGNAL_TO_X).reduce((o, k) => { o[k] = invert(SIGNAL_TO_X[k]); return o; }, {});

  const WATER_SOURCE_TO_X = { piped: "municipal", borewell: "borewell", tanker: "tanker", other: "other" };
  const WATER_SOURCE_FROM_X = { municipal: "piped", borewell: "borewell", tanker: "tanker", rainwater: "other", recycled: "other", other: "other" };
  const RELIABILITY_TO_X = { reliable: "none", seasonal: "occasional", frequent: "frequent" };
  const RELIABILITY_FROM_X = invert(RELIABILITY_TO_X);
  const TANKER_TO_X = { none: "never", occasional: "occasional", seasonal: "regular", regular: "regular" };
  const TANKER_FROM_X = { never: "none", occasional: "occasional", regular: "regular" };
  const TREATMENT_FROM_X = { direct: "none", after_treatment: "some", not_usable: "significant", unknown: "unknown" };
  const TREATMENT_TO_X = { none: "direct", some: "after_treatment", significant: "after_treatment", unknown: "unknown" };
  const ROAD_TO_X = { public: "public", private: "private_own", shared: "shared", dependent: "via_other_land", unknown: "unknown" };
  const ROAD_FROM_X = invert(ROAD_TO_X);
  const LEGAL_TO_X = { clear: "resolved", partly: "open", unclear: "problem", unknown: "unknown" };
  const LEGAL_FROM_X = invert(LEGAL_TO_X);
  const TITLE_TO_X = { resolved: "resolved", partly: "open", unresolved: "problem", unknown: "unknown" };
  const ENGINES = ["rent", "land", "infrastructure", "jobs", "redevelopment", "uc_discount", "inflation", "belief"];
  const UTILITY = ["control", "permanence", "family", "location", "school", "space", "privacy", "customisation", "identity", "other"];

  // The X-Ray's own scenario defaults (its SCEN_DEFAULTS). The X-Ray should
  // still merge any incoming case over its blank case, so a field it adds
  // later never arrives missing.
  const XRAY_SCEN_DEFAULTS = {
    base_appr: 5, upside_appr: 8, inflation: 5, rent_growth: "", vacancy_base_months: 1,
    flat_years: 5, price_fall_pct: 20, rate_rise_bps: 200, income_months: 6, vacancy_months: 6,
    delay_a: 12, delay_b: 24, shock_amount: "", shock_year: 3, compound: ["rate", "income"],
    thesis_b_appr: 2, thesis_c_appr: -2, thesis_c_exit_extra: 3,
  };

  /* ---------- X-Ray -> worksheet ------------------------------------ */

  function fromXRay(x, blankWorksheet) {
    const c = blankWorksheet();
    x = x || {};
    c.meta.name = ((x.meta || {}).name || "X-Ray case").replace(/ \(example\)$/, "");
    c.meta.source = "xray";
    if (x.meta && x.meta.worksheet_id) c.meta.worksheet_id = x.meta.worksheet_id;

    Object.assign(c.decision, x.decision || {});
    if (c.decision.occupancy === "mixed") c.decision.occupancy = "rent";

    const mk = x.market || {};
    Object.assign(c.market, { country: mk.country || "IN", currency: mk.currency || "INR", city: mk.city || "", micro_market: mk.micro_market || "", city_stage: mk.city_stage || "" });
    Object.keys(SIGNAL_FROM_X).forEach((k) => {
      const s = (mk.signals || {})[k];
      if (s) c.market.signals[k] = { status: SIGNAL_FROM_X[k][s.status] || "", note: s.note || "" };
    });

    const p = x.property || {};
    Object.assign(c.property, {
      purchase_price: p.purchase_price, acq_total: sum(p.acq), initial_work: p.initial_work, owner_annual: sum(p.owner),
      expected_monthly_rent: p.expected_monthly_rent || p.equivalent_market_rent, exit_cost_pct: p.exit_cost_pct,
      return_engine: (p.return_engine || []).filter((e) => ENGINES.indexOf(e) >= 0),
    });
    // Transactions before listings, then the most similar, then the most recent.
    const SIM = { high: 0, medium: 1, low: 2 };
    const rank = (y) => (y.type === "transaction" ? 0 : 10) + (SIM[y.similarity] !== undefined ? SIM[y.similarity] : 3);
    const comps = (p.comps || []).slice().sort((a, b) => rank(a) - rank(b) || String(b.date).localeCompare(String(a.date)));
    c.property.comps = comps.slice(0, 2).map((y) => ({ price: y.price, date: y.date, similarity: y.similarity, kind: y.type === "transaction" ? "transaction" : "listing", note: y.note || "" }));
    while (c.property.comps.length < 2) c.property.comps.push({});

    // Diligence: legal access becomes the worksheet's access question; the
    // rest collapse into one title / documentation status.
    const items = Object.assign({}, (x.diligence || {}).items);
    if (items.legal_access) c.access.legal = LEGAL_FROM_X[items.legal_access] || "";
    delete items.legal_access;
    const vals = Object.keys(items).map((k) => items[k]).filter(Boolean);
    if (vals.length) c.property.title_status = vals.some((v) => v === "problem" || v === "issue" || v === "unresolved") ? "unresolved" : vals.every((v) => v === "resolved") ? "resolved" : vals.indexOf("resolved") >= 0 ? "partly" : "unknown";

    // Water
    const w = p.water || {};
    const sources = w.sources || [];
    if (sources.length > 1) c.water.source = "combination";
    else if (w.primary || sources.length) c.water.source = WATER_SOURCE_FROM_X[w.primary || sources[0]] || "other";
    if (pick(RELIABILITY_FROM_X, w.dry_season)) c.water.reliability = RELIABILITY_FROM_X[w.dry_season];
    if (pick(TANKER_FROM_X, w.tanker_freq)) c.water.tanker = TANKER_FROM_X[w.tanker_freq];
    if (!isBlank(w.tanker_monthly)) c.water.monthly_cost = w.tanker_monthly;
    if (!isBlank(w.contingency)) c.water.failure = w.contingency;
    if (pick(TREATMENT_FROM_X, w.potable)) c.water.treatment = TREATMENT_FROM_X[w.potable];
    const quality = [w.quality_issues, w.treatment, w.groundwater_note].filter((v) => !isBlank(v)).join(" · ");
    if (quality) c.water.quality = quality;

    // Access and dependencies
    const a = p.access || {};
    if (pick(ROAD_FROM_X, a.type)) c.access.road = ROAD_FROM_X[a.type];
    if (!isBlank(a.year_round)) c.access.year_round = a.year_round;
    const deps = a.dependencies || [];
    if (deps.indexOf("pending_connection") >= 0) c.water.future_connection = "yes";
    const outside = deps.filter((d) => d !== "pending_connection");
    if (outside.length) c.access.third_party = outside.some((d) => ["neighbour_land", "private_road", "developer", "other"].indexOf(d) >= 0) ? "material" : "some";
    if (!isBlank(a.dependency_note)) c.access.dependency_note = a.dependency_note;

    const f = x.financing || {};
    Object.assign(c.financing, { mode: f.mode, loan_amount: f.loan_amount, rate: f.rate, rate_type: f.rate_type, tenure_years: f.tenure_years });
    const h = x.household || {};
    ["income", "existing_debt_service", "liquid", "financial", "existing_re_value", "existing_re_debt", "living_expenses"].forEach((k) => { if (h[k] !== undefined) c.household[k] = h[k]; });
    if (h.funding_from_financial) c.household.from_long_term = h.funding_from_financial;
    const k = x.constraints || {};
    if (k.min_liquid_mode !== "months" && k.min_liquid) c.constraints.min_liquid = k.min_liquid;

    const l = x.life || {};
    Object.assign(c.life, {
      zat: l.zat || "", zat_why: (l.utility || []).filter((u) => UTILITY.indexOf(u) >= 0), enough_price: l.enough_price, enough_rent: l.enough_rent,
      alt_type: l.alt_type === "larger_down" ? "custom" : l.alt_type, alt_note: l.alt_custom || "",
    });
    Object.assign(c.thesis, { happy_b: l.thesis_b_happy || "", survive_c: l.thesis_c_survive || "", note: l.thesis_note || "" });
    if ((x.decision || {}).status === "uc") c.uc.ready_alt_price = p.ready_alt_price || "";
    return c;
  }

  /* ---------- worksheet -> X-Ray ------------------------------------ */

  function toXRay(c) {
    const d = c.decision || {}, m = c.market || {}, p = c.property || {}, f = c.financing || {}, h = c.household || {};
    const l = c.life || {}, w = c.water || {}, a = c.access || {}, th = c.thesis || {};
    const x = {
      meta: { name: (c.meta && (c.meta.name || p.name)) || "From the worksheet", source: "worksheet", worksheet_id: c.meta && c.meta.id },
      decision: { purpose: d.purpose || "", status: d.status || "", occupancy: d.occupancy || "", holding_years: d.holding_years === undefined ? "" : d.holding_years, move_risk: d.move_risk || "" },
      market: { country: m.country || "IN", currency: m.currency || "INR", city: m.city || "", micro_market: m.micro_market || "", city_stage: m.city_stage === "unclear" ? "" : m.city_stage || "", signals: {} },
      property: {
        purchase_price: p.purchase_price, acq: isBlank(p.acq_total) ? {} : { other: p.acq_total }, owner: isBlank(p.owner_annual) ? {} : { maintenance: p.owner_annual },
        initial_work: p.initial_work, exit_cost_pct: p.exit_cost_pct, expected_monthly_rent: p.expected_monthly_rent,
        equivalent_market_rent: d.occupancy === "self" ? p.expected_monthly_rent : undefined,
        return_engine: (p.return_engine || []).slice(),
        comps: (p.comps || []).filter((y) => !isBlank(y.price)).map((y) => ({ price: y.price, area: "", date: y.date || "", type: y.kind === "listing" ? "listing" : "transaction", similarity: y.similarity || "", note: y.note || "" })),
        water: {}, access: {},
      },
      diligence: { items: {}, schedule: [] },
      financing: { mode: f.mode || "", loan_amount: f.loan_amount, rate: f.rate, rate_type: f.rate_type || "floating", tenure_years: f.tenure_years },
      household: { income: h.income, existing_debt_service: h.existing_debt_service, liquid: h.liquid, financial: h.financial, existing_re_value: h.existing_re_value, existing_re_debt: h.existing_re_debt, living_expenses: h.living_expenses, funding_from_financial: h.from_long_term, outlays: [], fi_active: false },
      life: {
        zat: l.zat || "", utility: (l.zat_why || []).slice(), enough_price: l.enough_price, enough_rent: l.enough_rent, alt_type: l.alt_type || "", alt_custom: l.alt_note || "", alt_invests: "yes",
        thesis_b_happy: th.happy_b || "", thesis_c_survive: th.survive_c || "", thesis_note: th.note || "",
      },
      constraints: { min_liquid_mode: "amount", min_liquid: (c.constraints || {}).min_liquid, max_outflow_mode: "amount", legal_required: [] },
      scenarios: Object.assign(clone(XRAY_SCEN_DEFAULTS), { _touched: {} }),
    };
    Object.keys(SIGNAL_TO_X).forEach((k) => {
      const s = (m.signals || {})[k];
      if (s && (s.status || s.note)) x.market.signals[k] = { status: SIGNAL_TO_X[k][s.status] || "unknown", note: s.note || "" };
    });
    // The rate the user is relying on becomes the X-Ray's base appreciation path.
    if (!isBlank((c.dependency || {}).implied_appr)) { x.scenarios.base_appr = +c.dependency.implied_appr; x.scenarios._touched.base_appr = true; }
    // Diligence: title and legal access.
    if (TITLE_TO_X[p.title_status]) ["title_chain", "approvals"].forEach((id) => { x.diligence.items[id] = TITLE_TO_X[p.title_status]; });
    if (LEGAL_TO_X[a.legal]) x.diligence.items.legal_access = LEGAL_TO_X[a.legal];
    // Water
    const xw = x.property.water;
    if (WATER_SOURCE_TO_X[w.source]) { xw.sources = [WATER_SOURCE_TO_X[w.source]]; xw.primary = WATER_SOURCE_TO_X[w.source]; }
    if (RELIABILITY_TO_X[w.reliability]) xw.dry_season = RELIABILITY_TO_X[w.reliability];
    if (TANKER_TO_X[w.tanker]) xw.tanker_freq = TANKER_TO_X[w.tanker];
    if (!isBlank(w.failure)) xw.contingency = w.failure;
    if (TREATMENT_TO_X[w.treatment]) xw.potable = TREATMENT_TO_X[w.treatment];
    if (!isBlank(w.quality)) xw.quality_issues = w.quality;
    // Access
    const xa = x.property.access;
    if (ROAD_TO_X[a.road]) xa.type = ROAD_TO_X[a.road];
    if (!isBlank(a.year_round)) xa.year_round = a.year_round;
    xa.dependencies = [];
    if (a.road === "dependent") xa.dependencies.push("neighbour_land");
    if (a.third_party === "material" || a.third_party === "some") xa.dependencies.push("other");
    if (w.future_connection === "yes") xa.dependencies.push("pending_connection");
    if (!isBlank(a.dependency_note)) xa.dependency_note = a.dependency_note;
    return prune(x);
  }

  // Drop undefined values so the receiving tool's defaults stay in charge.
  function prune(o) {
    if (Array.isArray(o)) return o.map(prune);
    if (o && typeof o === "object") {
      Object.keys(o).forEach((k) => { if (o[k] === undefined) delete o[k]; else o[k] = prune(o[k]); });
    }
    return o;
  }

  // Re-importing refreshes a case without wiping what only the receiving
  // tool holds: values that arrive filled in overwrite, blanks never do.
  // "Empty" all the way down: blank values, and arrays or objects holding
  // nothing but blanks (e.g. the placeholder rows of an empty table).
  function emptyDeep(v) {
    if (Array.isArray(v)) return v.every(emptyDeep);
    if (v && typeof v === "object") return Object.keys(v).every((k) => emptyDeep(v[k]));
    return isBlank(v);
  }

  function mergeInto(target, incoming) {
    Object.keys(incoming).forEach((k) => {
      const v = incoming[k];
      if (emptyDeep(v)) return;
      if (v && typeof v === "object" && !Array.isArray(v) && target[k] && typeof target[k] === "object" && !Array.isArray(target[k])) mergeInto(target[k], v);
      else target[k] = clone(v);
    });
    return target;
  }

  return { XRAY_STORE, FILE_KIND_WORKSHEET, FILE_KIND_XRAY, TOOL_CANDIDATES, fromXRay, toXRay, mergeInto };
});
