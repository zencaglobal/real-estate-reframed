/* ============================================================
   Property Decision X-Ray — calculation & synthesis engine
   Pure functions, no DOM. Runs in the browser (window.XRayEngine)
   and in Node (module.exports) so tests/validate.mjs can check
   the exact math the site ships.

   Governing rules (Product Specification v1.0):
   - profile, not score: nothing here produces a composite number
     or a BUY / DON'T BUY verdict;
   - asset return, leveraged equity return, housing consumption,
     utility, liquidity, concentration and execution risk are
     computed and reported separately;
   - mortgage principal is equity, never cost and never profit;
   - red lines are tested exactly as the user entered them;
   - missing inputs withhold the conclusions that depend on them.
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.XRayEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- Small helpers ---------------------------------------- */

  const num = (v) => (v === null || v === undefined || v === "" || isNaN(+v) ? null : +v);
  const pos = (v) => { const x = num(v); return x === null ? null : Math.max(0, x); };
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const sum = (a) => a.reduce((s, x) => s + x, 0);

  function sumKnown(obj, keys) {
    let s = 0, known = false;
    keys.forEach((k) => { const x = num(obj && obj[k]); if (x !== null) { s += x; known = true; } });
    return { sum: s, known };
  }

  /* ---------- Money / number formatting (shared with the UI) ------- */

  const CCY = {
    INR: { sym: "₹", locale: "en-IN", dec: 0 },
    USD: { sym: "$", locale: "en-US", dec: 0 },
    JPY: { sym: "¥", locale: "ja-JP", dec: 0 },
    CNY: { sym: "CN¥", locale: "zh-CN", dec: 0 },
    GBP: { sym: "£", locale: "en-GB", dec: 0 },
    EUR: { sym: "€", locale: "en-IE", dec: 0 },
    AED: { sym: "AED ", locale: "en-AE", dec: 0 },
    SGD: { sym: "S$", locale: "en-SG", dec: 0 },
    AUD: { sym: "A$", locale: "en-AU", dec: 0 },
    CAD: { sym: "C$", locale: "en-CA", dec: 0 },
  };

  function trim(x) {
    const a = Math.abs(x);
    if (a >= 100) return Math.round(x).toString();
    if (a >= 10) return x.toFixed(1).replace(/\.0$/, "");
    return x.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
  }

  // Compact, readable money: ₹3 Cr, ₹45 L, $1.2M, $850K.
  function money(v, ccy, full) {
    if (v === null || v === undefined || !isFinite(v)) return "—";
    const c = CCY[ccy] || CCY.USD;
    const neg = v < 0 ? "−" : "";
    const a = Math.abs(v);
    if (full) return neg + c.sym + Math.round(a).toLocaleString(c.locale);
    if (ccy === "INR") {
      if (a >= 1e7) return neg + "₹" + trim(a / 1e7) + " Cr";
      if (a >= 1e5) return neg + "₹" + trim(a / 1e5) + " L";
      return neg + "₹" + Math.round(a).toLocaleString("en-IN");
    }
    if (a >= 1e9) return neg + c.sym + trim(a / 1e9) + "B";
    if (a >= 1e6) return neg + c.sym + trim(a / 1e6) + "M";
    if (a >= 1e4) return neg + c.sym + trim(a / 1e3) + "K";
    return neg + c.sym + Math.round(a).toLocaleString(c.locale);
  }

  const pct = (x, d) => (x === null || x === undefined || !isFinite(x) ? "—" : (x * 100).toFixed(d === undefined ? 1 : d) + "%");
  const months = (m) => (m === null || !isFinite(m) ? "—" : Math.round(m) + (Math.round(m) === 1 ? " month" : " months"));
  const years = (y) => (y === null || !isFinite(y) ? "—" : (Math.round(y * 10) / 10) + (y === 1 ? " year" : " years"));

  /* ---------- Loan maths ------------------------------------------- */

  // Standard amortising payment.
  function emi(L, ratePct, n) {
    if (!L || !n) return 0;
    const r = ratePct / 1200;
    if (Math.abs(r) < 1e-12) return L / n;
    return (L * r) / (1 - Math.pow(1 + r, -n));
  }

  // Outstanding balance after k scheduled payments.
  function balanceAfter(L, ratePct, n, k) {
    if (!L) return 0;
    if (k >= n) return 0;
    const r = ratePct / 1200, E = emi(L, ratePct, n);
    if (Math.abs(r) < 1e-12) return L - E * k;
    return L * Math.pow(1 + r, k) - (E * (Math.pow(1 + r, k) - 1)) / r;
  }

  // Months needed to clear balance B at payment E (tenure extension view).
  function monthsToClear(B, ratePct, E) {
    const r = ratePct / 1200;
    if (B <= 0) return 0;
    if (E <= B * r) return Infinity; // payment does not cover interest
    if (Math.abs(r) < 1e-12) return B / E;
    return -Math.log(1 - (B * r) / E) / Math.log(1 + r);
  }

  /* ---------- IRR on monthly flows, annualised --------------------- */

  function npv(flows, r) {
    let s = 0, d = 1;
    for (let t = 0; t < flows.length; t++) { s += flows[t] / d; d *= 1 + r; }
    return s;
  }

  function irr(flows) {
    let hasNeg = false, hasPos = false;
    flows.forEach((f) => { if (f < -1e-9) hasNeg = true; if (f > 1e-9) hasPos = true; });
    if (!hasNeg || !hasPos) return null;
    let lo = -0.5, hi = 0.5, flo = npv(flows, lo), fhi = npv(flows, hi);
    if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2, fm = npv(flows, mid);
      if (fm * flo > 0) { lo = mid; flo = fm; } else { hi = mid; }
      if (hi - lo < 1e-12) break;
    }
    const m = (lo + hi) / 2;
    return Math.pow(1 + m, 12) - 1;
  }

  // Bisection for the appreciation rate a where f(a) = target, f increasing in a.
  function solveIncreasing(f, target, lo, hi) {
    lo = lo === undefined ? -0.25 : lo; hi = hi === undefined ? 0.4 : hi;
    let flo = f(lo), fhi = f(hi);
    if (flo === null || fhi === null) return null;
    if (flo >= target) return { value: lo, bound: "below" };
    if (fhi < target) return { value: hi, bound: "above" };
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2, fm = f(mid);
      if (fm === null) return null;
      if (fm >= target) hi = mid; else lo = mid;
      if (hi - lo < 1e-6) break;
    }
    return { value: (lo + hi) / 2, bound: null };
  }

  /* ---------- Reference content ------------------------------------ */

  const DILIGENCE = [
    { id: "title_chain", label: "Title chain / ownership history verified", when: "all" },
    { id: "legal_access", label: "Legally documented road / right-of-way access", when: "all" },
    { id: "encumbrance", label: "Encumbrances, liens and existing loans checked", when: "all" },
    { id: "approvals", label: "Building approvals / sanctioned plan verified", when: "all" },
    { id: "registration_docs", label: "Sale will be registered with the full consideration documented", when: "all" },
    { id: "tax_dues", label: "Property tax, utility and society dues clear", when: "all" },
    { id: "occupancy_cert", label: "Occupancy / completion certificate available", when: "ready" },
    { id: "society_noc", label: "Society / association transfer consent (resale)", when: "ready" },
    { id: "project_registration", label: "Project registered with the regulator (RERA or equivalent)", when: "uc" },
    { id: "land_title", label: "Project land title and development rights verified", when: "uc" },
    { id: "developer_record", label: "Developer's delivery record and current project load reviewed", when: "uc" },
    { id: "construction_stage", label: "Construction stage independently verified (not just brochure)", when: "uc" },
    { id: "project_funding", label: "Project funding / escrow position understood", when: "uc" },
    { id: "agreement_terms", label: "Delay-compensation and exit terms in the agreement read", when: "uc" },
  ];

  const UTILITY = {
    control: "control over your home", permanence: "permanence", family: "family continuity",
    location: "location", school: "schools", space: "space", customisation: "customisation",
    privacy: "privacy", identity: "identity / status", other: "other reasons you named",
  };

  const ENGINES = {
    land: "land scarcity in this location", rent: "rental income", infrastructure: "new infrastructure or a transport link",
    jobs: "local job and income growth", redevelopment: "redevelopment potential", uc_discount: "an under-construction discount",
    inflation: "general inflation", credit: "cheaper or more available credit", belief: "the belief that a later buyer will pay much more",
    none: "nothing specific yet",
  };

  const CITY_SIGNALS = [
    { id: "jobs", label: "Jobs / employment" }, { id: "migration", label: "Migration & household formation" },
    { id: "incomes", label: "Local incomes" }, { id: "supply", label: "Supply pipeline" },
    { id: "infrastructure", label: "Infrastructure" }, { id: "affordability", label: "Affordability for the next buyer" },
    { id: "rents", label: "Rents" }, { id: "vacancy", label: "Vacancy" },
  ];

  // Access, water and effective-access vocabularies (v1.1 additions).
  const WATER_SOURCES = { municipal: "Municipal / piped supply", borewell: "Borewell", tanker: "Tanker", rainwater: "Rainwater harvesting", recycled: "Recycled (non-potable)", other: "Other" };
  const WATER_CONTROL = { utility: "the municipal utility", association: "the owners' association", developer: "the developer", tanker_vendors: "private tanker vendors", neighbour: "a neighbour / shared borewell", self: "you (self-owned)" };
  const ACCESS_TYPES = { public: "a public road", private_own: "your own private road", shared: "a shared / association road", via_other_land: "a route through another landowner's property", unknown: "an unrecorded route" };
  const ACCESS_DEPS = { neighbour_land: "a neighbouring landowner", private_road: "a private road owner", shared_infra: "shared infrastructure", association: "association-run services", developer: "the developer (before handover)", pending_connection: "a utility connection still pending", other: "another third party" };
  // Dependencies the owner does not collectively control (association/shared infra is noted, not flagged).
  const ACCESS_DEPS_FLAGGED = ["neighbour_land", "private_road", "developer", "pending_connection", "other"];
  const SERVICES = [{ id: "power", label: "Electricity" }, { id: "sewage", label: "Sewage / STP" }, { id: "waste", label: "Waste collection" }, { id: "road", label: "Road maintenance" }];
  const PROVIDERS = { public: "Public utility", association: "Owners' association", developer: "Developer", private: "Private vendor", neighbour: "Neighbour / shared", self: "Self", unknown: "Unknown" };
  const PROVIDERS_FLAGGED = ["developer", "private", "neighbour", "unknown"];
  const DEST_KINDS = { work: "Work / employment hub", school: "School", hospital: "Hospital", daily: "Groceries / daily needs", transport: "Airport / railway / major transport", family: "Family / social network", other: "Other" };
  const ACCESS_RULES = { peakRatio: 1.5, peakExtraMin: 20, note: "Peak-sensitive = peak travel time at least 1.5× normal and at least 20 minutes longer. A product heuristic, not a standard." };
  const COMPARE_DIMS = [
    { id: "home_quality", label: "Home quality" }, { id: "floor_view", label: "Floor / view" },
    { id: "mobility", label: "Mobility", dest: ["work", "transport"] }, { id: "healthcare", label: "Healthcare", dest: ["hospital"] },
    { id: "daily", label: "Daily conveniences", dest: ["daily", "school"] }, { id: "social", label: "Social / community access", dest: ["family"] },
    { id: "lifestyle", label: "Lifestyle utility" },
  ];
  const GATE_LABELS = ["Acceptable", "Concern", "Potential disqualifier", "Not assessed"];

  // Visible product heuristic for price-evidence quality (spec §10.1).
  const EVIDENCE_RULES = {
    recentMonths: 12,
    strong: { minRecentTransactions: 3, minHighSimilarity: 2, maxDispersion: 0.2 },
    mixed: { minTransactions: 1, minTotal: 2 },
    note: "A product heuristic, not an economic truth: count, recency, similarity and spread of the evidence you entered.",
  };

  // FIRE impact band: change in years-to-target smaller than this is "neutral".
  const FI_NEUTRAL_YEARS = 0.5;

  /* ---------- Normalise a case into a numeric model ---------------- */

  function defaultSchedule(T0) {
    // Illustrative construction-linked plan: 20% at booking, balance evenly
    // at quarterly milestones up to possession.
    const rows = [{ month: 0, pct: 20 }];
    const steps = Math.max(1, Math.ceil(T0 / 3));
    for (let i = 1; i <= steps; i++) rows.push({ month: Math.min(T0, i * 3), pct: 80 / steps });
    return rows;
  }

  function model(c, asOf) {
    const d = c.decision || {}, p = c.property || {}, f = c.financing || {}, h = c.household || {};
    const l = c.life || {}, k = c.constraints || {}, s = c.scenarios || {}, g = c.diligence || {}, mk = c.market || {};
    const m = { notes: [], gaps: [] };

    m.asOf = asOf || new Date().toISOString().slice(0, 7);
    m.ccy = mk.currency || "INR";
    m.country = mk.country || "OTHER";
    m.purpose = d.purpose || "home";
    m.status = d.status || "ready";
    m.uc = m.status === "uc";
    m.occ = d.occupancy || (m.purpose === "investment" ? "rent" : "self");
    m.selfUse = m.occ === "self" || m.occ === "mixed";
    m.letting = m.occ === "rent" || m.occ === "mixed";
    m.moveRisk = d.move_risk || "";

    m.P = pos(p.purchase_price);
    m.H = pos(d.holding_years);
    m.N = m.H ? Math.max(1, Math.round(m.H * 12)) : null;

    m.R = m.letting ? pos(p.expected_monthly_rent) : null;
    m.Req = pos(p.equivalent_market_rent);

    const acq = sumKnown(p.acq, ["stamp", "registration", "brokerage", "legal", "other"]);
    m.acq = acq.sum; m.acqKnown = acq.known;
    const own = sumKnown(p.owner, ["maintenance", "property_tax", "insurance", "repairs"]);
    m.ownerAnnual = own.sum; m.ownerKnown = own.known;
    m.mgmtPct = (num(p.mgmt_pct) || 0) / 100;
    m.letCost = pos(p.letting_costs_annual) || 0;
    m.work = pos(p.initial_work) || 0;
    m.exitKnown = num(p.exit_cost_pct) !== null;
    m.exitPct = (pos(p.exit_cost_pct) || 0) / 100;
    m.exitTax = pos(p.exit_tax) || 0;
    m.area = pos(p.area);
    m.age = pos(p.age_years);

    // Financing
    const loanAmt = pos(f.loan_amount);
    m.financed = f.mode === "loan" && loanAmt > 0;
    m.L = m.financed && m.P ? Math.min(loanAmt, m.P) : 0;
    m.rate = num(f.rate);
    m.n = num(f.tenure_years) ? Math.round(num(f.tenure_years) * 12) : null;
    m.fees = m.financed ? pos(f.loan_fees) || 0 : 0;
    m.rateType = f.rate_type || "floating";
    m.floating = m.financed && m.rateType !== "fixed";
    m.E = m.financed && m.rate !== null && m.n ? emi(m.L, m.rate, m.n) : 0;
    m.LTV = m.P ? m.L / m.P : 0;

    // Scenarios (illustrative defaults are flagged in provenance by the UI)
    m.base = (num(s.base_appr) !== null ? num(s.base_appr) : 0) / 100;
    m.upside = (num(s.upside_appr) !== null ? num(s.upside_appr) : 0) / 100;
    m.infl = num(s.inflation) !== null ? num(s.inflation) / 100 : null;
    m.rentGrowth = num(s.rent_growth) !== null ? num(s.rent_growth) / 100 : m.infl || 0;
    m.costGrowth = m.infl || 0;
    m.vacBase = m.letting ? clamp(num(s.vacancy_base_months) || 0, 0, 12) : 0;
    m.flatYears = clamp(num(s.flat_years) || 5, 1, 30);
    m.fall = clamp(num(s.price_fall_pct) !== null ? num(s.price_fall_pct) : 20, 0, 90) / 100;
    m.bump = num(s.rate_rise_bps) !== null ? num(s.rate_rise_bps) : 200;
    m.incomeMonths = clamp(num(s.income_months) !== null ? num(s.income_months) : 6, 0, 60);
    m.vacStress = clamp(num(s.vacancy_months) !== null ? num(s.vacancy_months) : 6, 0, 24);
    m.delays = [num(s.delay_a) !== null ? num(s.delay_a) : 12, num(s.delay_b) !== null ? num(s.delay_b) : 24].map((x) => clamp(x, 0, 120));
    m.shock = pos(s.shock_amount);
    m.shockYear = clamp(num(s.shock_year) || 1, 0, 50);
    m.compound = Array.isArray(s.compound) ? s.compound : [];
    m.opp = num(l.opp_rate) !== null ? num(l.opp_rate) / 100 : null;

    // Under construction
    m.T0 = m.uc ? Math.round(pos(g.months_to_possession) || 0) : 0;
    m.Rp = m.uc ? pos(g.ready_comparable_price) : null;
    if (m.uc) {
      let rows = Array.isArray(g.schedule) ? g.schedule.filter((r) => num(r.pct) > 0).map((r) => ({ month: clamp(Math.round(num(r.month) || 0), 0, 600), pct: num(r.pct) })) : [];
      m.scheduleEntered = rows.length > 0;
      if (!rows.length) rows = defaultSchedule(m.T0);
      const tot = sum(rows.map((r) => r.pct));
      m.scheduleScaled = Math.abs(tot - 100) > 0.5;
      m.schedule = rows.map((r) => ({ month: Math.min(r.month, m.T0), pct: (r.pct / tot) * 100 })).sort((a, b) => a.month - b.month);
    }

    // Household
    m.income = pos(h.income);
    m.stability = h.stability || "";
    m.existingDS = pos(h.existing_debt_service) || 0;
    m.living = pos(h.living_expenses);
    m.curRent = pos(h.current_housing_cost) || 0;
    m.liquid0 = pos(h.liquid);
    m.fin0 = pos(h.financial);
    m.re0 = pos(h.existing_re_value) || 0;
    m.rePrimary0 = Math.min(m.re0, pos(h.existing_primary_value) || 0);
    m.reDebt0 = pos(h.existing_re_debt) || 0;
    m.reSameCity0 = Math.min(m.re0, pos(h.existing_re_same_city) || 0);
    m.incomeSameCity = !!h.income_same_city;
    m.retire0 = pos(h.retirement) || 0;
    m.fromFinancial = pos(h.funding_from_financial) || 0;
    m.outlays = (Array.isArray(h.outlays) ? h.outlays : []).filter((o) => pos(o.amount) > 0).map((o) => ({ label: o.label || "Outlay", amount: pos(o.amount), year: clamp(num(o.year) || 0, 0, 60) }));

    // FI
    m.fi = !!h.fi_active;
    m.fiTarget = pos(h.fi_target);
    m.fiTargetHome = pos(h.fi_target_with_home);
    m.fiReturn = num(h.fi_return) !== null ? num(h.fi_return) / 100 : null;
    m.fiInvest = pos(h.fi_monthly_invest);
    m.fiMonetise = !!h.fi_monetise;

    // Utility / alternative
    m.zat = l.zat || "";
    m.utility = Array.isArray(l.utility) ? l.utility : [];
    m.enoughPrice = pos(l.enough_price);
    m.enoughRent = pos(l.enough_rent);
    m.alt = l.alt_type || "";
    m.altInvests = l.alt_invests !== "no";
    m.altRent = pos(l.alt_rent);
    m.altWait = pos(l.alt_wait_months);
    m.altExtraDown = pos(l.alt_extra_down);

    // Red lines (tested exactly as entered)
    m.k = {
      minLiquidMode: k.min_liquid_mode || "amount",
      minLiquid: pos(k.min_liquid),
      maxOutMode: k.max_outflow_mode || "amount",
      maxOut: pos(k.max_outflow),
      maxDS: pos(k.max_debt_service_pct),
      minReturn: num(k.min_return),
      minYield: num(k.min_net_yield),
      maxAppr: k.max_appr_dependency || "",
      maxDelay: pos(k.max_delay_months),
      legal: Array.isArray(k.legal_required) ? k.legal_required : [],
      minUcGap: pos(k.min_uc_gap),
      maxFiDelay: pos(k.max_fi_delay_years),
    };
    m.reserve = m.k.minLiquid === null ? null
      : m.k.minLiquidMode === "months" ? (m.living !== null ? m.k.minLiquid * m.living : null) : m.k.minLiquid;
    m.outLimit = m.k.maxOut === null ? null
      : m.k.maxOutMode === "pct" ? (m.income ? (m.k.maxOut / 100) * m.income : null) : m.k.maxOut;

    // Diligence
    m.diligenceItems = DILIGENCE.filter((x) => x.when === "all" || x.when === m.status).map((x) => ({
      id: x.id, label: x.label, status: (g.items && g.items[x.id]) || "unknown",
    }));
    m.developer = g.developer || "";
    m.registrationStatus = g.registration_status || "";

    m.engines = Array.isArray(p.return_engine) ? p.return_engine : [];

    // Access, water, effective access, comparative profile, location-thesis scenarios
    m.access = p.access || {};
    m.water = p.water || {};
    m.dil = g.items || {};
    m.waterCostAnnual = (pos(m.water.tanker_monthly) || 0) * 12 + (pos(m.water.treatment_annual) || 0) + (pos(m.water.pumping_annual) || 0);
    if (m.waterCostAnnual > 0) { m.ownerAnnual += m.waterCostAnnual; m.ownerKnown = true; }
    m.destinations = (Array.isArray(p.destinations) ? p.destinations : []).filter((x) => x && (x.kind || x.label));
    m.compare = l.compare || {};
    m.thesisB = (num(s.thesis_b_appr) !== null ? num(s.thesis_b_appr) : 2) / 100;
    m.thesisC = (num(s.thesis_c_appr) !== null ? num(s.thesis_c_appr) : -2) / 100;
    m.thesisCExit = clamp(num(s.thesis_c_exit_extra) !== null ? num(s.thesis_c_exit_extra) : 3, 0, 50) / 100;
    m.thesisBHappy = l.thesis_b_happy || "";
    m.thesisCSurvive = l.thesis_c_survive || "";
    m.comps = (Array.isArray(p.comps) ? p.comps : []).filter((x) => pos(x.price) > 0);
    m.cityStage = mk.city_stage || "";
    m.signals = mk.signals || {};
    return m;
  }

  // Inputs without which no X-Ray can be produced at all.
  function coreMissing(c) {
    const m = model(c);
    const miss = [];
    if (!m.P) miss.push({ step: "property", field: "purchase_price", label: "Purchase price" });
    if (!m.H) miss.push({ step: "frame", field: "holding_years", label: "Expected holding period" });
    if (m.financed && m.rate === null) miss.push({ step: "financing", field: "rate", label: "Loan interest rate" });
    if (m.financed && !m.n) miss.push({ step: "financing", field: "tenure_years", label: "Loan tenure" });
    if (m.uc && !(num((c.diligence || {}).months_to_possession) > 0)) miss.push({ step: "property", field: "months_to_possession", label: "Months to promised possession" });
    return miss;
  }

  /* ---------- Core cash-flow simulation ---------------------------- */
  // Monthly ledger from booking (t = 0) to sale (t = N).
  //   unlev:  property cash flows before financing (spec §10.2)
  //   eq:     owner's equity cash flows after financing (spec §10.3)
  //   imp:    imputed rent (housing value received) for self-use, kept separate
  function simulate(m, o) {
    o = o || {};
    const a = o.appr === undefined ? m.base : o.appr;
    const D = o.delay || 0;
    const N = o.months || m.N;
    const rateUsed = m.financed ? m.rate : 0;
    const r = rateUsed / 1200;
    const E = m.financed ? emi(m.L, rateUsed, m.n) : 0;
    const Tp = m.uc ? m.T0 + D : 0; // possession month
    const unlev = new Array(N + 1).fill(0), eq = new Array(N + 1).fill(0), imp = new Array(N + 1).fill(0);
    const disb = new Array(N + 1).fill(0), cap = new Array(N + 1).fill(0);
    const T = { interest: 0, preEmi: 0, principal: 0, owner: 0, rentSched: 0, vacancy: 0, mgmt: 0, letting: 0,
      rentNet: 0, imputed: 0, overlap: 0, rentLostWaiting: 0, equityIn: 0, ownFundsPaid: [] };

    unlev[0] -= m.acq;
    eq[0] -= m.acq + m.fees;
    cap[0] += m.acq + m.fees;

    // Price payments: one at t=0 when ready; dated tranches when under construction.
    const tranches = m.uc
      ? m.schedule.map((x) => ({ month: Math.min(N, x.month >= m.T0 ? Tp : x.month), amt: (x.pct / 100) * m.P }))
      : [{ month: 0, amt: m.P }];
    let ownLeft = m.P - m.L;
    tranches.forEach((x) => {
      unlev[x.month] -= x.amt;
      const ownPart = Math.min(ownLeft, x.amt);
      ownLeft -= ownPart;
      eq[x.month] -= ownPart;
      cap[x.month] += ownPart;
      disb[x.month] += x.amt - ownPart;
      if (ownPart > 0) T.ownFundsPaid.push({ month: x.month, amt: ownPart });
    });
    const workAt = Math.min(N, Tp);
    unlev[workAt] -= m.work;
    eq[workAt] -= m.work;
    cap[workAt] += m.work;

    let B = disb[0];
    const rg = 1 + (o.rentGrowth === undefined ? m.rentGrowth : o.rentGrowth), cg = 1 + m.costGrowth;
    for (let t = 1; t <= N; t++) {
      // financing
      if (m.financed) {
        if (t <= Tp) {
          const i = B * r; eq[t] -= i; T.preEmi += i;
        } else if (t - Tp <= m.n && B > 1e-6) {
          const i = B * r, pr = Math.min(B, E - i);
          B -= pr; eq[t] -= i + pr; T.interest += i; T.principal += pr;
        }
        B += disb[t];
      }
      const inUse = t > Tp;
      const yi = Math.floor((t - 1) / 12);
      if (inUse) {
        const oc = (m.ownerAnnual / 12) * Math.pow(cg, yi);
        unlev[t] -= oc; eq[t] -= oc; T.owner += oc;
        if (m.letting && m.R) {
          const sched = m.R * Math.pow(rg, yi);
          const vac = (sched * m.vacBase) / 12;
          const coll = sched - vac;
          const mg = coll * m.mgmtPct;
          const lc = (m.letCost / 12) * Math.pow(cg, yi);
          const net = coll - mg - lc;
          unlev[t] += net; eq[t] += net;
          T.rentSched += sched; T.vacancy += vac; T.mgmt += mg; T.letting += lc; T.rentNet += net;
        }
        if (m.selfUse && m.Req) {
          const iv = m.Req * Math.pow(rg, yi);
          imp[t] += iv; T.imputed += iv;
        }
      } else {
        if (m.selfUse) T.overlap += m.curRent;
        if (m.letting && m.R) T.rentLostWaiting += m.R;
      }
    }
    const V = m.P * Math.pow(1 + a, N / 12);
    const exitCost = V * (o.exitPct === undefined ? m.exitPct : o.exitPct) + m.exitTax;
    const netSale = V - exitCost;
    unlev[N] += netSale;
    const eqSale = netSale - B;
    eq[N] += eqSale;

    const plus = (x, y) => x.map((v, i) => v + y[i]);
    eq.forEach((v, i) => { if (i < N && v < 0) T.equityIn -= v; });
    if (eq[N] - eqSale < 0) T.equityIn -= eq[N] - eqSale;
    return {
      appr: a, delay: D, months: N, Tp, unlev, eq, imp, cap, V, exitCost, netSale, eqSale, balanceEnd: B, totals: T,
      unlevIRR: irr(unlev), eqIRR: irr(eq),
      unlevIRRImp: m.selfUse && m.Req ? irr(plus(unlev, imp)) : null,
      eqIRRImp: m.selfUse && m.Req ? irr(plus(eq, imp)) : null,
    };
  }

  const realOf = (r, infl) => (r === null || infl === null ? null : (1 + r) / (1 + infl) - 1);

  /* ---------- Rent v own (spec §10.4) ------------------------------ */
  // Owner: the case's equity cash flows; ends with equity at sale.
  // Renter: rents the equivalent home and puts the owner's capital outlays
  // to work at the user's opportunity-cost rate (0 if none entered). Monthly
  // differences are invested only if the user says they would actually do so.
  function rentVsOwn(m, a) {
    const rent0 = m.altRent || m.Req;
    if (!rent0 || !m.selfUse) return null;
    const s = simulate(m, { appr: a });
    const o = m.opp || 0, mo = Math.pow(1 + o, 1 / 12) - 1;
    const rg = 1 + m.rentGrowth;
    let pot = 0;
    for (let t = 0; t <= s.months; t++) {
      if (t > 0) pot *= 1 + mo;
      // what the owner pays out this month (sale proceeds excluded)
      let ownerOut = -(s.eq[t] - (t === s.months ? s.eqSale : 0));
      if (m.uc && t >= 1 && t <= s.Tp) ownerOut += m.curRent || rent0; // owner still rents while waiting
      const renterRent = t >= 1 ? rent0 * Math.pow(rg, Math.floor((t - 1) / 12)) : 0;
      if (m.altInvests) pot += ownerOut - renterRent;
      else pot += s.cap[t]; // capital outlays only; monthly differences are spent
    }
    return { ownerWealth: s.eqSale, renterWealth: pot, rent0, opp: o, invests: m.altInvests, sim: s };
  }

  /* ---------- Under-construction economics (spec §10.8) ------------ */

  function delayCost(m, D) {
    if (!m.uc) return null;
    const r = m.financed ? m.rate / 1200 : 0;
    const overlap = m.selfUse ? D * m.curRent : 0;
    const lostRent = m.letting && m.R ? D * m.R * (1 - m.vacBase / 12) : 0;
    const financing = D * m.L * r; // loan fully disbursed by promised possession
    const carrying = 0; // owner charges assumed to begin at possession
    const ownPaid = m.P - m.L + m.acq + m.fees;
    const opportunity = m.opp !== null ? ownPaid * (Math.pow(1 + m.opp, D / 12) - 1) : null;
    const total = overlap + lostRent + financing + carrying + (opportunity || 0);
    return { D, overlap, lostRent, financing, carrying, opportunity, total };
  }

  // Economic cost of reaching a completed, usable home at month T = T0 + D,
  // under-construction route versus buying a genuinely comparable ready unit now.
  // Both routes end at T holding equivalent homes. Each route's cost, valued at T:
  //   own capital paid (carrying your opportunity-cost rate, if entered)
  //   + loan interest and owner costs paid along the way
  //   + housing paid while waiting (UC, self-use) / − net rent earned (ready, letting)
  //   + loan principal still owed at T (borrowed money carries interest, not opportunity cost).
  function ucCompare(m, D) {
    if (!m.uc || !m.Rp) return null;
    D = D || 0;
    const base = ucCompareOnTime(m);
    if (!D) return base;
    // Each month of delay erodes the on-time advantage by the spec's (gross) delay cost.
    const dc = delayCost(m, D);
    return Object.assign({}, base, { D, T: m.T0 + D, advantage: base.advantage - dc.total, delayCost: dc.total });
  }

  function ucCompareOnTime(m) {
    const D = 0, T = m.T0;
    const o = m.opp || 0, mo = Math.pow(1 + o, 1 / 12) - 1;
    const r = m.financed ? m.rate / 1200 : 0;
    const fv = (amt, from) => amt * Math.pow(1 + mo, T - from);
    // Under-construction route
    let ucCost = fv(m.acq + m.fees, 0);
    const disb = new Array(T + 1).fill(0);
    let ownLeft = m.P - m.L;
    m.schedule.forEach((x) => {
      const at = x.month >= m.T0 ? T : x.month, amt = (x.pct / 100) * m.P;
      const own = Math.min(ownLeft, amt); ownLeft -= own;
      ucCost += fv(own, at); disb[at] += amt - own;
    });
    let B = disb[0], preEmi = 0;
    for (let t = 1; t <= T; t++) { const i = B * r; preEmi += i; ucCost += fv(i, t); B += disb[t]; }
    ucCost += B; // principal owed at possession
    let waitHousing = 0;
    if (m.selfUse) for (let t = 1; t <= T; t++) { waitHousing += m.curRent; ucCost += fv(m.curRent, t); }
    // Ready route (same loan-to-value, loan interest-only during the window)
    const ratio = m.Rp / m.P, acqR = m.acq * ratio, LR = m.LTV * m.Rp;
    let readyCost = fv(m.Rp - LR + acqR + m.fees, 0) + LR;
    let readyInterest = 0, readyOwner = 0, readyRent = 0;
    for (let t = 1; t <= T; t++) {
      const i = LR * r; readyInterest += i; readyCost += fv(i, t);
      const oc = m.ownerAnnual / 12; readyOwner += oc; readyCost += fv(oc, t);
      if (m.letting && m.R) { const net = m.R * (1 - m.vacBase / 12) * (1 - m.mgmtPct) - m.letCost / 12; readyRent += net; readyCost -= fv(net, t); }
    }
    return {
      D, T, sticker: m.Rp - m.P, stickerPct: (m.Rp - m.P) / m.P,
      ucCost, readyCost, advantage: readyCost - ucCost,
      parts: { preEmi, waitHousing, readyInterest, readyOwner, readyRent, acqReady: acqR },
    };
  }

  function ucBreakEvenDelay(m) {
    if (!m.uc || !m.Rp) return null;
    if (ucCompare(m, 0).advantage <= 0) return 0;
    for (let D = 1; D <= 120; D++) if (ucCompare(m, D).advantage <= 0) return D;
    return Infinity;
  }

  /* ---------- Holding-period friction ------------------------------ */
  // Years until the net sale price covers price + acquisition costs + work,
  // at appreciation a (ignores running costs and rent: friction only).
  function frictionYears(m, a) {
    const need = m.P + m.acq + m.work + m.exitTax;
    if (a <= 0) return need <= m.P * (1 - m.exitPct) ? 0 : Infinity;
    const y = Math.log(need / (m.P * (1 - m.exitPct))) / Math.log(1 + a);
    return Math.max(0, y);
  }

  /* ---------- Price evidence (spec §10.1) -------------------------- */

  function monthsBetween(ym, asOf) {
    if (!ym || !/^\d{4}-\d{2}/.test(ym)) return null;
    const [y1, m1] = ym.split("-").map(Number), [y2, m2] = asOf.split("-").map(Number);
    return (y2 - y1) * 12 + (m2 - m1);
  }

  function evidence(m) {
    const comps = m.comps.map((x) => {
      const area = pos(x.area);
      return { ...x, price: pos(x.price), area, unit: area ? pos(x.price) / area : null, age: monthsBetween(x.date, m.asOf), type: x.type || "listing", similarity: x.similarity || "medium" };
    });
    const tx = comps.filter((x) => x.type === "transaction");
    const recentTx = tx.filter((x) => x.age !== null && x.age <= EVIDENCE_RULES.recentMonths);
    const useUnit = m.area && comps.length > 0 && comps.every((x) => x.unit);
    const val = (x) => (useUnit ? x.unit : x.price);
    const basis = tx.length ? tx : comps;
    const vals = basis.map(val).sort((a, b) => a - b);
    const lo = vals.length ? vals[0] : null, hi = vals.length ? vals[vals.length - 1] : null;
    const med = vals.length ? (vals.length % 2 ? vals[(vals.length - 1) / 2] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2) : null;
    const dispersion = vals.length >= 2 && med ? (hi - lo) / med : null;
    const subject = useUnit ? m.P / m.area : m.P;
    const R = EVIDENCE_RULES;
    let label, reason;
    if (!comps.length) { label = "Insufficient"; reason = "No comparable evidence entered: no price-confidence conclusion is possible."; }
    else if (recentTx.length >= R.strong.minRecentTransactions && recentTx.filter((x) => x.similarity === "high").length >= R.strong.minHighSimilarity && dispersion !== null && dispersion <= R.strong.maxDispersion) {
      label = "Strong"; reason = recentTx.length + " recent transactions, mostly highly similar, with a tight spread.";
    } else if (tx.length >= R.mixed.minTransactions && comps.length >= R.mixed.minTotal) {
      label = "Mixed"; reason = tx.length + " transaction" + (tx.length > 1 ? "s" : "") + " among " + comps.length + " observations" +
        (dispersion !== null ? "; spread " + pct(dispersion, 0) : "") + (recentTx.length < tx.length ? "; some evidence is over " + R.recentMonths + " months old" : "") + ".";
    } else {
      label = "Weak"; reason = tx.length ? "Only one observation." : "Only listings, estimates or reference values; no completed transactions.";
    }
    const indicative = lo !== null ? { lo: useUnit ? lo * m.area : lo, hi: useUnit ? hi * m.area : hi } : null;
    let position = null;
    if (lo !== null && vals.length >= 2) position = subject < lo ? "below" : subject > hi ? "above" : "within";
    const oldest = comps.reduce((mx, x) => (x.age !== null && x.age > mx ? x.age : mx), 0);
    return { comps, label, reason, useUnit, subject, lo, hi, med, dispersion, indicative, position, basisIsTx: tx.length > 0, txCount: tx.length, recentTx: recentTx.length, oldest };
  }

  /* ---------- Rental P&L, year one (spec §10.5) -------------------- */

  function rentalPL(m, s) {
    if (!m.letting || !m.R) return null;
    const sched = m.R * 12, vac = (m.R * m.vacBase), coll = sched - vac;
    const mgmt = coll * m.mgmtPct, letting = m.letCost;
    const opex = m.ownerAnnual + mgmt + letting;
    const noi = coll - opex;
    const yr1Interest = m.financed ? sumInterestYear1(m) : 0;
    const ds = m.E * 12;
    const afterDebt = noi - ds;
    const cashEq = m.P - m.L + m.acq + m.fees + m.work;
    return {
      sched, vac, coll, mgmt, letting, owner: m.ownerAnnual, opex, noi, ds, yr1Interest, yr1Principal: ds - yr1Interest,
      grossYield: sched / m.P, netYield: noi / m.P, afterDebt, cashOnCash: cashEq ? afterDebt / cashEq : null,
      vacancyTax: sched ? vac / sched : 0, cashEq,
    };
  }

  function sumInterestYear1(m) {
    let B = m.L, s = 0; const r = m.rate / 1200;
    for (let t = 0; t < Math.min(12, m.n); t++) { const i = B * r; s += i; B -= m.E - i; }
    return s;
  }

  /* ---------- Household snapshot & balance sheet (spec §10.7) ------ */

  function household(m) {
    const cashNeed = m.P - m.L + m.acq + m.fees + m.work;
    let fromFin = Math.min(m.fromFinancial, m.fin0 || 0);
    let fromLiq = cashNeed - fromFin;
    let gap = 0;
    if (m.liquid0 !== null && fromLiq > m.liquid0) { gap = fromLiq - m.liquid0; fromLiq = m.liquid0; fromFin += gap; }
    const L1 = m.liquid0 !== null ? m.liquid0 - fromLiq : null;
    const F1 = m.fin0 !== null ? Math.max(0, m.fin0 - fromFin) : null;
    const shortfall = m.fin0 !== null && fromFin > m.fin0 ? fromFin - m.fin0 : 0;

    const before = sheet(m.liquid0, m.fin0, m.retire0, m.re0, m.reDebt0);
    const after = sheet(L1, F1, m.retire0, m.re0 + m.P, m.reDebt0 + m.L);
    const reCity1 = m.reSameCity0 + m.P;

    // Monthly property cash flows, steady state after possession (year 1)
    const ownerM = m.ownerAnnual / 12;
    const rentNetM = m.letting && m.R ? m.R * (1 - m.vacBase / 12) * (1 - m.mgmtPct) - m.letCost / 12 : 0;
    const outflowGross = m.E + ownerM;
    const outflow = outflowGross - rentNetM; // net property cash outflow
    // Construction phase: pre-EMI on (up to) the full loan + continuing current housing cost
    const preEmiMax = m.uc && m.financed ? (m.L * m.rate) / 1200 : 0;
    const outflowConstruction = m.uc ? preEmiMax + (m.selfUse ? m.curRent : 0) : null;
    const rentStops = m.selfUse; // moving in ends today's rent
    const housingNow = m.curRent;
    const debtService = m.existingDS + m.E;
    const dsPct = m.income ? debtService / m.income : null;
    let surplus = null, surplusConstruction = null;
    if (m.income !== null && m.living !== null) {
      surplus = m.income - m.living - m.existingDS - outflow - (rentStops ? 0 : housingNow);
      surplusConstruction = m.uc ? m.income - m.living - m.existingDS - preEmiMax - housingNow : null;
      // today, before buying
    }
    const surplusToday = m.income !== null && m.living !== null ? m.income - m.living - m.existingDS - housingNow : null;
    return { cashNeed, fromLiq, fromFin, gapToFinancial: gap, shortfall, L1, F1, before, after, reCity1,
      ownerM, rentNetM, outflowGross, outflow, outflowConstruction, preEmiMax, debtService, dsPct, surplus, surplusConstruction, surplusToday, housingNow, rentStops };
  }

  function sheet(liq, fin, ret, re, reDebt) {
    if (liq === null || fin === null) return null;
    const assets = liq + fin + ret + re;
    const nw = assets - reDebt;
    const reEq = re - reDebt;
    return { liquid: liq, financial: fin, retirement: ret, re, reDebt, assets, nw, reEq,
      grossShare: assets ? re / assets : 0, equityShare: nw > 0 ? reEq / nw : null };
  }

  // Year-by-year liquid assets in the base case (no investment return assumed on cash).
  function liquidityPath(m, hh) {
    if (hh.L1 === null) return null;
    const pts = [];
    let L = hh.L1;
    const savingsKnown = hh.surplus !== null;
    const yrs = Math.ceil(m.H || 1);
    for (let y = 0; y <= yrs; y++) {
      if (y > 0 && savingsKnown) {
        for (let mo = (y - 1) * 12 + 1; mo <= y * 12; mo++) L += m.uc && mo <= m.T0 ? hh.surplusConstruction : hh.surplus;
      }
      m.outlays.forEach((o) => { if (Math.round(o.year) === y) L -= o.amount; });
      pts.push({ y, L });
    }
    const min = pts.reduce((a, p) => (p.L < a.L ? p : a), pts[0]);
    return { pts, min, savingsKnown };
  }

  /* ---------- FIRE-usable wealth (spec §10.7) ---------------------- */

  function fire(m, hh) {
    if (!m.fi) return { status: "Not assessed", reason: "You have not asked for the purchase to be tested against a financial-independence plan." };
    if (!m.fiTarget || m.fiReturn === null || m.fiInvest === null || hh.before === null)
      return { status: "Not assessed", reason: "FI plan incomplete: needs a target, an expected return on usable assets and today's monthly investing." };
    const usable0 = hh.before.liquid + hh.before.financial + hh.before.retirement;
    const usable1 = hh.after.liquid + hh.after.financial + hh.after.retirement;
    // Housing cash change shifts what can be invested each month.
    const deltaHousing = hh.outflow - (hh.rentStops ? hh.housingNow : 0);
    const invest1 = m.fiInvest - deltaHousing;
    const target1 = m.fiTargetHome || m.fiTarget;
    const mr = Math.pow(1 + m.fiReturn, 1 / 12) - 1;
    const yearsTo = (W, c, target, withHome) => {
      for (let t = 0; t <= 600; t++) {
        let w = W;
        if (withHome) {
          const V = m.P * Math.pow(1 + m.base, t / 12);
          const B = m.financed ? balanceAfter(m.L, m.rate, m.n, Math.max(0, t - m.T0)) : 0;
          w += Math.max(0, V * (1 - m.exitPct) - B);
        }
        if (w >= target) return t / 12;
        W = W * (1 + mr) + c;
      }
      return Infinity;
    };
    const y0 = yearsTo(usable0, m.fiInvest, m.fiTarget, false);
    const y1 = yearsTo(usable1, invest1, target1, m.fiMonetise);
    const diff = y1 - y0;
    let status;
    if (!isFinite(y0) && !isFinite(y1)) status = "Neutral";
    else if (!isFinite(y1)) status = "Negative";
    else if (!isFinite(y0)) status = "Positive";
    else status = diff <= -FI_NEUTRAL_YEARS ? "Positive" : diff >= FI_NEUTRAL_YEARS ? "Negative" : "Neutral";
    return { status, usable0, usable1, invest0: m.fiInvest, invest1, target0: m.fiTarget, target1, y0, y1, diff,
      reason: "Years to your FI target move from " + years(y0) + " to " + years(y1) + " under your plan" +
        (m.fiMonetise ? " (this property's equity counted, because your plan monetises it)" : " (this property's equity not counted as withdrawal capital)") + "." };
  }

  /* ---------- Constraint testing ----------------------------------- */

  const RL = {
    min_liquid: "minimum liquidity", max_outflow: "maximum monthly property outflow", max_ds: "maximum total debt service",
    min_return: "minimum return", min_yield: "minimum net yield", max_appr: "maximum appreciation dependency",
    legal: "required legal/project items", max_delay: "delay tolerance", min_uc_gap: "minimum ready-v-under-construction gap",
    fi: "financial-independence limit",
  };

  function anyRedLine(m) {
    const k = m.k;
    return m.reserve !== null || m.outLimit !== null || k.maxDS !== null || k.minReturn !== null || k.minYield !== null ||
      !!k.maxAppr || k.legal.length > 0 || k.maxDelay !== null || k.minUcGap !== null || k.maxFiDelay !== null;
  }
  const cashRedLines = (m) => m.reserve !== null || m.outLimit !== null || m.k.maxDS !== null;

  // Tests a stressed snapshot against the cash-flow red lines.
  function testCash(m, snap) {
    const out = [];
    if (m.reserve !== null && snap.liquid !== undefined && snap.liquid !== null)
      out.push({ id: "min_liquid", breach: snap.liquid < m.reserve, detail: money(snap.liquid, m.ccy) + " vs floor " + money(m.reserve, m.ccy) });
    if (m.outLimit !== null && snap.outflow !== undefined && snap.outflow !== null)
      out.push({ id: "max_outflow", breach: snap.outflow > m.outLimit + 0.5, detail: money(snap.outflow, m.ccy) + "/mo vs limit " + money(m.outLimit, m.ccy) });
    if (m.k.maxDS !== null && snap.dsPct !== undefined && snap.dsPct !== null)
      out.push({ id: "max_ds", breach: snap.dsPct * 100 > m.k.maxDS + 1e-9, detail: pct(snap.dsPct) + " of income vs limit " + m.k.maxDS + "%" });
    return out;
  }

  /* ---------- The run ---------------------------------------------- */

  function run(c, opts) {
    opts = opts || {};
    const missing = coreMissing(c);
    if (missing.length) return { ready: false, missing };
    const m = model(c, opts.asOf);
    const R = { ready: true, m, ccy: m.ccy };
    const $ = (v) => money(v, m.ccy);

    /* Economics */
    const base = simulate(m, { appr: m.base });
    const flat = simulate(m, { appr: 0 });
    const upside = simulate(m, { appr: m.upside });
    const zeroReal = m.infl !== null ? simulate(m, { appr: m.infl }) : null;
    R.sims = { base, flat, upside, zeroReal };
    R.ledger = {
      priceAppreciation: base.V / m.P - 1, priceCAGR: m.base,
      unlevIRR: base.unlevIRR, eqIRR: base.eqIRR, unlevIRRImp: base.unlevIRRImp, eqIRRImp: base.eqIRRImp,
      unlevReal: realOf(base.unlevIRR, m.infl), eqReal: realOf(base.eqIRR, m.infl),
      netSale: base.netSale, exitCost: base.exitCost, saleValue: base.V,
      interest: base.totals.interest + base.totals.preEmi, principal: base.totals.principal, balanceEnd: base.balanceEnd,
      incomplete: !m.acqKnown || !m.ownerKnown || !m.exitKnown,
    };
    // What creates the return (undiscounted, base case, before financing)
    const T = base.totals;
    R.decomp = {
      rentNet: T.rentNet, imputed: T.imputed, owner: -T.owner, capital: base.V - m.P,
      friction: -(m.acq + m.work + base.exitCost), financing: -(T.interest + T.preEmi + m.fees),
    };
    const posIncome = Math.max(0, T.rentNet + (m.letting ? 0 : T.imputed) - T.owner);
    const posCap = Math.max(0, base.V - m.P);
    R.apprShare = posIncome + posCap > 0 ? posCap / (posIncome + posCap) : null;
    R.assetCharacter = R.apprShare === null ? "Undetermined" : R.apprShare > 0.7 ? "Appreciation-led" : R.apprShare < 0.4 ? "Income-led" : "Relies on both";
    R.rental = rentalPL(m, base);
    R.frictionYears = frictionYears(m, m.base);
    R.roundTripFriction = (m.acq + m.work + m.P * m.exitPct + m.exitTax) / m.P;

    /* Housing cost (home / mixed self-use) */
    if (m.selfUse) {
      const yrs = m.H;
      const unrec = base.totals.interest + base.totals.preEmi + base.totals.owner + m.acq + m.fees + base.exitCost + m.work;
      R.housing = {
        annualCashCost: unrec / yrs, // interest + owner costs + transaction costs spread over the hold; principal excluded
        interestAnnual: (base.totals.interest + base.totals.preEmi) / yrs, ownerAnnual: base.totals.owner / yrs,
        transactionAnnual: (m.acq + m.fees + base.exitCost + m.work) / yrs,
        oppAnnual: m.opp !== null ? ((m.P - m.L + m.acq + m.fees + m.work) * m.opp) : null,
        capitalCommitted: m.P - m.L + m.acq + m.fees + m.work, principal: base.totals.principal,
        rentAnnual: m.Req ? m.Req * 12 : null,
        rentTotal: m.Req ? base.totals.imputed : null,
      };
      const rvo = rentVsOwn(m, m.base);
      if (rvo) {
        const f = (a) => { const x = rentVsOwn(m, a); return x.ownerWealth - x.renterWealth; };
        const be = solveIncreasing(f, 0, -0.2, 0.4);
        R.rentVsOwn = { base: rvo, flat: rentVsOwn(m, 0), upside: rentVsOwn(m, m.upside), breakEven: be };
      }
    }

    /* Under construction */
    if (m.uc) {
      R.uc = {
        delays: [0].concat(m.delays).map((D) => ({ D, cost: delayCost(m, D), cmp: ucCompare(m, D) })),
        breakEven: ucBreakEvenDelay(m), scheduleEntered: m.scheduleEntered, scheduleScaled: m.scheduleScaled, schedule: m.schedule,
      };
    }

    /* Household */
    const hh = household(m);
    R.hh = hh;
    R.liqPath = liquidityPath(m, hh);
    R.fire = fire(m, hh);
    R.evidence = evidence(m);

    /* Appreciation dependency (spec §10.6) */
    R.apprDep = apprDependency(m, R);

    /* Stress tests (spec §11) */
    R.stress = stress(m, R, hh);

    /* Leverage sensitivity */
    R.leverage = leverageLabel(m, R);

    /* Utility */
    R.utility = utilityLabel(m);

    /* Execution */
    R.execution = executionLabel(m);

    /* City */
    R.city = cityContext(m);

    /* Access & dependency, water, effective access, location thesis, gates, comparative profile */
    R.access = accessProfile(m);
    R.water = waterProfile(m);
    R.effective = effectiveAccess(m);
    R.thesis = thesisScenarios(m, R);
    R.apprDep = apprDependency(m, R); // re-run: the Scenario B answer can qualify the home case
    R.gates = gates(m, R);
    R.comparative = comparative(m, R);

    /* Synthesis */
    R.redLinesSet = anyRedLine(m);
    R.tradeoff = tradeoff(m, R);
    R.works = worksIf(m, R);
    R.struggles = strugglesIf(m, R);
    R.openQuestions = openQuestions(m, R);
    R.statement = statement(m, R);
    R.completeness = completeness(m, R);
    return R;
  }

  /* ---------- Appreciation dependency ------------------------------ */

  function apprDependency(m, R) {
    const out = { financial: null, home: null };
    const finObjective = m.purpose === "investment" || m.purpose === "speculative" || (m.purpose === "mixed");
    // Financial dependency
    if (finObjective) {
      const useEquity = m.letting || m.occ === "resale" || !m.selfUse;
      if (useEquity) {
        const target = m.k.minReturn !== null ? m.k.minReturn / 100 : 0;
        const f = (a) => { const s = simulate(m, { appr: a }); return s.eqIRR === null ? -1 : s.eqIRR; };
        const req = solveIncreasing(f, target, -0.25, 0.4);
        const atZero = f(0) >= target, atBase = f(m.base) >= target, atUp = f(m.upside) >= target;
        const label = atZero ? "Low" : atBase ? "Moderate" : "High";
        out.financial = {
          metric: "equity", target, hurdleGiven: m.k.minReturn !== null, required: req, label, atZero, atBase, atUp,
          objective: m.k.minReturn !== null ? "your " + m.k.minReturn + "% minimum return on your equity" : "nominal break-even on your equity (no hurdle supplied, so adequacy is not judged)",
          reason: (atZero ? "The objective is met even with zero appreciation." : atBase ? "Some appreciation is needed: your base case (" + pct(m.base) + ") is enough." : atUp ? "Only your upside case (" + pct(m.upside) + ") meets the objective." : "Not met in any tested appreciation path, up to " + pct(m.upside) + ".") +
            (req && req.bound === null ? " Required: about " + pct(req.value) + " a year." : ""),
        };
      } else if (R.rentVsOwn) {
        const be = R.rentVsOwn.breakEven;
        const atZero = be && be.value <= 0, atBase = be && be.value <= m.base, atUp = be && be.value <= m.upside;
        out.financial = {
          metric: "rentVsOwn", required: be, label: atZero ? "Low" : atBase ? "Moderate" : "High", atZero, atBase, atUp,
          objective: "ending at least as wealthy as renting the equivalent home (your stated alternative)",
          reason: be && be.bound === null ? "Owning matches renting at about " + pct(be.value) + " a year of appreciation." : be && be.bound === "below" ? "Owning beats renting even with falling prices." : "Owning does not catch up with renting within the tested range.",
        };
      }
    }
    // Home / utility-led dependency (spec: ZAT + cash-flow resilience + red lines)
    if (m.purpose === "home" || m.purpose === "mixed") {
      const flatBreach = R && R._flatBreach;
      let label, reason;
      if (m.zat === "no") { label = "High"; reason = "You said you would not want this home without appreciation; the case rests on it."; }
      else if (m.zat === "yes" && !flatBreach && m.thesisBHappy === "no") { label = "Moderate"; reason = "You'd want the home without real appreciation, yet said you wouldn't be happy if new supply caps the upside (Scenario B): the case leans on appreciation more than the Zero-Appreciation answer suggests."; }
      else if (m.zat === "yes" && !flatBreach) { label = "Low"; reason = "You would still want the home with zero real appreciation, and a flat market breaches none of your red lines."; }
      else if (!m.zat) { label = null; reason = "Zero-Appreciation Test not answered: dependency cannot be judged against your own objective."; }
      else { label = "Moderate"; reason = m.zat === "unsure" ? "You are unsure whether you would want the home without appreciation." : "You would want the home anyway, but a flat market breaches one of your red lines."; }
      out.home = { label, reason, rentBreakEven: R.rentVsOwn ? R.rentVsOwn.breakEven : null };
    }
    out.primary = m.purpose === "home" ? out.home : out.financial || out.home;
    return out;
  }

  /* ---------- Stress engine ---------------------------------------- */

  function stress(m, R, hh) {
    const rows = [];
    const L1 = hh.L1;
    const burnBase = (outflow) => (m.living !== null ? m.living : 0) + m.existingDS + outflow + (hh.rentStops ? 0 : hh.housingNow);
    const pathMin = R.liqPath ? R.liqPath.min.L : L1;
    const peakOut = m.uc ? Math.max(hh.outflow, hh.outflowConstruction || 0) : hh.outflow;
    const $ = (v) => money(v, m.ccy);

    // Base case
    const baseTests = testCash(m, { liquid: pathMin, outflow: peakOut, dsPct: hh.dsPct });
    if (m.k.minReturn !== null && (m.purpose !== "home")) {
      const r = R.sims.base.eqIRR;
      baseTests.push({ id: "min_return", breach: r === null || r * 100 < m.k.minReturn, detail: "equity return " + pct(r) + " vs " + m.k.minReturn + "%" });
    }
    if (m.k.minYield !== null && R.rental) baseTests.push({ id: "min_yield", breach: R.rental.netYield * 100 < m.k.minYield, detail: "net yield " + pct(R.rental.netYield, 2) + " vs " + m.k.minYield + "%" });
    if (m.k.legal.length) {
      const open = m.diligenceItems.filter((x) => m.k.legal.indexOf(x.id) >= 0 && x.status !== "resolved");
      baseTests.push({ id: "legal", breach: open.length > 0, detail: open.length ? open.length + " required item" + (open.length > 1 ? "s" : "") + " not resolved" : "all required items resolved" });
    }
    if (m.k.minUcGap !== null && R.uc && R.uc.delays[0].cmp) baseTests.push({ id: "min_uc_gap", breach: R.uc.delays[0].cmp.advantage < m.k.minUcGap, detail: "on-time advantage " + $(R.uc.delays[0].cmp.advantage) + " vs " + $(m.k.minUcGap) });
    if (m.k.maxFiDelay !== null && R.fire && R.fire.diff !== undefined) baseTests.push({ id: "fi", breach: R.fire.diff > m.k.maxFiDelay, detail: "FI date moves " + years(R.fire.diff) + " vs limit " + years(m.k.maxFiDelay) });
    rows.push({
      id: "base", name: "Base case", desc: "Your inputs, " + pct(m.base) + " a year appreciation",
      cash: (m.uc ? "During construction " + $(hh.outflowConstruction) + "/mo; after possession " : "") + $(hh.outflow) + "/mo net property outflow" + (hh.surplus !== null ? "; household surplus " + $(hh.surplus) + "/mo" : ""),
      liquidity: L1 !== null ? "Liquid after purchase " + $(L1) + (R.liqPath && R.liqPath.min.L < L1 - 1 ? "; lowest " + $(R.liqPath.min.L) + " in year " + R.liqPath.min.y : "") : "Liquid assets not entered",
      equity: "Equity at purchase " + $(m.P - m.L) + " (" + pct(1 - m.LTV, 0) + " of price)",
      tests: baseTests,
    });

    // Flat market
    const fm = Math.min(m.N, Math.round(m.flatYears * 12));
    const fs = simulate(m, { appr: 0, months: fm });
    const contributed = fs.totals.equityIn;
    const flatTests = [];
    if (m.k.minReturn !== null && m.purpose !== "home") flatTests.push({ id: "min_return", breach: R.sims.flat.eqIRR === null || R.sims.flat.eqIRR * 100 < m.k.minReturn, detail: "equity return over the full hold at 0%: " + pct(R.sims.flat.eqIRR) });
    if (m.k.maxAppr === "zero") {
      const dep = R.apprDep.primary;
      flatTests.push({ id: "max_appr", breach: !!(dep && dep.label && dep.label !== "Low"), detail: "you require the case to work at zero appreciation" });
    }
    rows.push({
      id: "flat", name: "Flat market", desc: "0% nominal for " + years(fm / 12) + (fm < Math.round(m.flatYears * 12) ? " (your whole hold)" : ""), illustrative: true,
      cash: "No change to monthly cash flow",
      liquidity: "No change unless you need to sell",
      equity: "If sold after " + years(fm / 12) + ": you get back " + $(fs.eqSale + sumPositive(fs.eq, fs.months)) + " of " + $(contributed) + " paid in (" + $(fs.eqSale + sumPositive(fs.eq, fs.months) - contributed) + ")",
      tests: flatTests,
    });
    R._flatBreach = flatTests.some((t) => t.breach) || baseTests.some((t) => t.breach && (t.id === "min_liquid" || t.id === "max_outflow"));
    // recompute home appreciation dependency with the flat result now known
    R.apprDep = apprDependency(m, R);
    if (m.k.maxAppr === "zero") {
      const dep = R.apprDep.primary; const t = flatTests.find((x) => x.id === "max_appr");
      if (t) t.breach = !!(dep && dep.label && dep.label !== "Low");
    }
    if (m.k.maxAppr === "base") {
      const dep = R.apprDep.primary;
      baseTests.push({ id: "max_appr", breach: !!(dep && dep.label === "High"), detail: "you require the case to work within your base scenario" });
    }

    // Zero real appreciation
    if (R.sims.zeroReal) {
      const z = R.sims.zeroReal;
      const zt = [];
      if (m.k.minReturn !== null && m.purpose !== "home") zt.push({ id: "min_return", breach: z.eqIRR === null || z.eqIRR * 100 < m.k.minReturn, detail: "equity return " + pct(z.eqIRR) });
      rows.push({
        id: "zeroReal", name: "Zero real appreciation", desc: "Prices track inflation (" + pct(m.infl) + ")", illustrative: true,
        cash: "No change to monthly cash flow",
        liquidity: "No change",
        equity: "Equity return " + pct(z.eqIRR) + " nominal, " + pct(realOf(z.eqIRR, m.infl)) + " real" + (m.selfUse ? (m.zat ? " · Zero-Appreciation Test: " + (m.zat === "yes" ? "you'd still want it" : m.zat === "no" ? "you would not" : "unsure") : "") : ""),
        tests: zt,
      });
    }

    // Price fall
    const shockedV = m.P * (1 - m.fall);
    const eqShock = shockedV - m.L;
    const saleShock = shockedV * (1 - m.exitPct) - m.exitTax - m.L;
    const shockSheet = hh.after ? { ...hh.after, re: hh.after.re - m.P * m.fall, nw: hh.after.nw - m.P * m.fall } : null;
    rows.push({
      id: "fall", name: "Price fall", desc: "−" + Math.round(m.fall * 100) + "% marked value", illustrative: true,
      cash: "No change (no margin-call assumption)",
      liquidity: saleShock < 0 ? "A forced sale would need " + $(-saleShock) + " of other cash to clear the loan" : "No change unless you must sell",
      equity: "Equity " + $(eqShock) + (eqShock < 0 ? " (negative)" : "") + (shockSheet && shockSheet.nw > 0 ? "; property equity " + pct((shockSheet.re - shockSheet.reDebt) / shockSheet.nw, 0) + " of net worth" : ""),
      tests: [], saleShock,
    });

    // Rate rise
    if (m.financed) {
      if (m.floating) {
        const B12 = balanceAfter(m.L, m.rate, m.n, 12);
        const rem = m.n - 12;
        const E2 = emi(B12, m.rate + m.bump / 100, rem);
        const ext = monthsToClear(B12, m.rate + m.bump / 100, m.E) - rem;
        const out2 = hh.outflow + (E2 - m.E);
        const ds2 = m.income ? (m.existingDS + E2) / m.income : null;
        const sur2 = hh.surplus !== null ? hh.surplus - (E2 - m.E) : null;
        const liq12 = L1 !== null ? L1 - (sur2 !== null && sur2 < 0 ? -sur2 * 12 : 0) : null;
        rows.push({
          id: "rate", name: "Rate rise", desc: "+" + m.bump + " bps from year 2" + (m.rateType === "hybrid" ? " (hybrid treated as resetting)" : ""), illustrative: true,
          cash: "EMI " + $(m.E) + " → " + $(E2) + " (+" + $(E2 - m.E) + "/mo)" + (isFinite(ext) ? ", or tenure +" + (ext > 24 ? years(ext / 12) : months(Math.max(0, ext))) + " if EMI held" : ", EMI held would not cover interest"),
          liquidity: sur2 !== null ? (sur2 < 0 ? "Deficit " + $(-sur2) + "/mo; runway " + months(L1 / -sur2) : "Surplus stays positive (" + $(sur2) + "/mo)") : "Household surplus unknown (living expenses not entered)",
          equity: "No direct change",
          tests: testCash(m, { liquid: liq12, outflow: out2, dsPct: ds2 }), E2, out2,
        });
      } else {
        rows.push({ id: "rate", name: "Rate rise", desc: "Fixed-rate loan", cash: "Not applicable while the rate is fixed", liquidity: "—", equity: "—", tests: [], na: true });
      }
    }

    // Income interruption
    if (m.income !== null) {
      const burn = burnBase(hh.outflow);
      const draw = burn * m.incomeMonths;
      const liqAfter = L1 !== null ? L1 - draw : null;
      rows.push({
        id: "income", name: "Income interruption", desc: m.incomeMonths + " months without household income", illustrative: true,
        cash: "Monthly burn " + $(burn) + (m.living === null ? " (property + debts only: living expenses not entered)" : ""),
        liquidity: L1 !== null ? "Draw " + $(draw) + "; liquid falls to " + $(liqAfter) + "; runway " + months(burn > 0 ? L1 / burn : Infinity) : "—",
        equity: "No direct change",
        tests: testCash(m, { liquid: liqAfter }), external: liqAfter !== null && liqAfter < 0 ? -liqAfter : 0, burn,
      });
    }

    // Vacancy
    if (m.letting && m.R) {
      const V = m.vacStress;
      const lost = V * m.R;
      const draw = hh.surplus !== null ? sum(Array.from({ length: Math.ceil(V) }, () => Math.max(0, m.R - Math.max(0, hh.surplus)))) * (V / Math.max(1, Math.ceil(V))) : lost;
      const noiV = R.rental ? R.rental.noi - (V - m.vacBase) * m.R : null;
      const outV = hh.outflowGross;
      rows.push({
        id: "vacancy", name: "Rental vacancy", desc: V + " months empty", illustrative: true,
        cash: "Rent lost " + $(lost) + "; outflow while empty " + $(outV) + "/mo" + (noiV !== null ? "; year NOI " + $(noiV) + ", after debt " + $(noiV - m.E * 12) : ""),
        liquidity: L1 !== null ? "Reserve draw " + $(draw) + (hh.surplus === null ? " (assumes no spare income)" : "") + "; liquid " + $(L1 - draw) : "—",
        equity: "No direct change",
        tests: testCash(m, { liquid: L1 !== null ? L1 - draw : null, outflow: outV }),
      });
    }

    // Construction delay
    if (m.uc) {
      m.delays.forEach((D, i) => {
        const dc = delayCost(m, D);
        const cmp = R.uc.delays[i + 1].cmp;
        const draw = hh.surplusConstruction !== null ? Math.max(0, -hh.surplusConstruction) * D : dc.overlap + dc.financing;
        const liq = L1 !== null ? L1 - draw : null;
        const tests = testCash(m, { liquid: liq });
        // Within your stated tolerance, does the under-construction route still beat ready?
        if (m.k.maxDelay !== null && D <= m.k.maxDelay && cmp) tests.push({ id: "max_delay", breach: cmp.advantage < 0, detail: "inside your " + m.k.maxDelay + "-month tolerance, the advantage left is " + $(cmp.advantage) });
        if (m.k.minUcGap !== null && cmp) tests.push({ id: "min_uc_gap", breach: cmp.advantage < m.k.minUcGap, detail: "advantage " + $(cmp.advantage) });
        rows.push({
          id: "delay" + i, name: "Construction delay", desc: "+" + D + " months to possession" + (m.k.maxDelay !== null && D > m.k.maxDelay ? ": beyond the " + m.k.maxDelay + " months you'd tolerate" : ""), illustrative: true,
          cash: "Delay cost " + $(dc.total) + " (housing " + $(dc.overlap + dc.lostRent) + ", interest " + $(dc.financing) + (dc.opportunity !== null ? ", opportunity " + $(dc.opportunity) : "") + ")",
          liquidity: liq !== null ? "Liquid " + $(liq) + (hh.surplusConstruction === null ? " (assumes no spare income)" : "") : "—",
          equity: cmp ? "Uncertainty Discount left: " + $(cmp.advantage) : "Ready comparable not entered: discount erosion not measurable",
          tests,
        });
      });
    }

    // Liquidity shock
    if (m.shock) {
      const pathAt = R.liqPath ? (R.liqPath.pts.find((p) => p.y === Math.round(m.shockYear)) || R.liqPath.pts[R.liqPath.pts.length - 1]).L : L1;
      const liq = pathAt !== null ? pathAt - m.shock : null;
      let source = "—";
      if (liq !== null) {
        if (liq >= (m.reserve || 0)) source = "Covered from liquid assets";
        else if (hh.F1 !== null && hh.F1 >= -Math.min(0, liq) + (m.reserve || 0)) source = "Requires selling long-term financial assets";
        else source = "Would require selling or borrowing against property";
      }
      rows.push({
        id: "shock", name: "Liquidity shock", desc: $(m.shock) + " needed in year " + m.shockYear,
        cash: "One-off " + $(m.shock),
        liquidity: liq !== null ? "Liquid falls to " + $(liq) + " · " + source : "—",
        equity: "No direct change", source,
        tests: testCash(m, { liquid: liq }),
      });
    }

    // Compound stress
    const sel = m.compound.filter((x) => rows.some((r) => r.id === x || (x === "delay" && r.id === "delay0")));
    if (sel.length >= 2) {
      let outflow = hh.outflow, liquid = L1, dsPct = hh.dsPct, parts = [];
      let E2 = m.E;
      if (sel.indexOf("rate") >= 0) { const r = rows.find((x) => x.id === "rate"); if (r && r.E2) { E2 = r.E2; outflow += E2 - m.E; dsPct = m.income ? (m.existingDS + E2) / m.income : null; parts.push("rate +" + m.bump + " bps"); } }
      let draw = 0;
      if (sel.indexOf("income") >= 0) { draw += burnBase(outflow) * m.incomeMonths; parts.push(m.incomeMonths + " months no income"); }
      else if (hh.surplus !== null && E2 > m.E) { const s2 = hh.surplus - (E2 - m.E); if (s2 < 0) draw += -s2 * 12; }
      if (sel.indexOf("vacancy") >= 0 && m.R) { draw += m.vacStress * m.R; outflow = Math.max(outflow, hh.outflowGross + (E2 - m.E)); parts.push(m.vacStress + " months vacant"); }
      if (sel.indexOf("delay") >= 0 && m.uc) { const dc = delayCost(m, m.delays[0]); draw += dc.overlap + dc.financing; parts.push("+" + m.delays[0] + " months delay"); }
      if (sel.indexOf("shock") >= 0 && m.shock) { draw += m.shock; parts.push($(m.shock) + " shock"); }
      const fall = sel.indexOf("fall") >= 0;
      if (fall) parts.push("−" + Math.round(m.fall * 100) + "% price");
      liquid = L1 !== null ? L1 - draw : null;
      const eqC = (fall ? m.P * (1 - m.fall) : m.P) - m.L;
      rows.push({
        id: "compound", name: "Combined stress", desc: parts.join(" + "),
        cash: "Net property outflow " + $(outflow) + "/mo",
        liquidity: liquid !== null ? "Draw " + $(draw) + "; liquid " + $(liquid) : "—",
        equity: "Equity " + $(eqC),
        tests: testCash(m, { liquid, outflow, dsPct }), compound: true,
      });
    }

    rows.forEach((r) => {
      r.tests.forEach((t) => (t.label = RL[t.id]));
      const relevant = r.tests;
      r.status = r.na ? "na" : !relevant.length ? (anyRedLine(m) ? "within-none" : "unset") : relevant.some((t) => t.breach) ? "breach" : "within";
      r.breaches = relevant.filter((t) => t.breach);
    });
    return rows;
  }

  function sumPositive(eq, N) {
    let s = 0; for (let t = 0; t < N; t++) if (eq[t] > 0) s += eq[t];
    return s;
  }

  /* ---------- Local labels (spec §12) ------------------------------ */

  function leverageLabel(m, R) {
    if (!m.financed) return { label: "Not applicable", reason: "Bought without a loan." };
    if (!cashRedLines(m)) return { label: null, reason: "No liquidity, outflow or debt-service red line set, financing stresses are described, not labelled." };
    const by = (id) => R.stress.find((r) => r.id === id);
    const single = ["base", "rate", "income"].map(by).filter((r) => r && r.breaches && r.breaches.some((t) => ["min_liquid", "max_outflow", "max_ds"].indexOf(t.id) >= 0));
    const comp = by("compound");
    if (single.length) return { label: "High", reason: single.map((r) => r.name.toLowerCase() + " breaches your " + uniq(r.breaches.filter((t) => ["min_liquid", "max_outflow", "max_ds"].indexOf(t.id) >= 0).map((t) => t.label)).join(" and ")).join("; ") + "." };
    if (comp && comp.breaches.length) return { label: "Moderate", reason: "Single financing stresses stay within your red lines; the compound stress breaches your " + uniq(comp.breaches.map((t) => t.label)).join(" / ") + "." };
    return { label: "Low", reason: "Rate rise and income interruption" + (comp ? ", alone and combined," : "") + " stay within the red lines you set." };
  }
  const uniq = (a) => a.filter((x, i) => a.indexOf(x) === i);
  const flat = (a) => [].concat.apply([], a);

  function utilityLabel(m) {
    if (m.purpose === "investment" || m.purpose === "speculative") return { label: "Not the job of this purchase", reason: "Utility is not assessed for a financial purchase, and cannot be used to excuse weak economics." };
    if (!m.zat) return { label: null, reason: "Zero-Appreciation Test not answered." };
    const reasons = m.utility.map((u) => UTILITY[u]).filter(Boolean);
    if (m.zat === "yes" && reasons.length) return { label: "Strong", reason: "You would still choose this home without real appreciation, for " + list(reasons.slice(0, 3)) + "." };
    if (m.zat === "no") return { label: "Weak", reason: "By your own answer, you would not want this home if it never appreciated." };
    return { label: "Mixed", reason: m.zat === "unsure" ? "You are unsure whether you would want it without appreciation." : "You would want it anyway, but named no specific reasons." };
  }

  function executionLabel(m) {
    const items = m.diligenceItems;
    const res = items.filter((x) => x.status === "resolved").length, problem = items.filter((x) => x.status === "problem").length;
    const open = items.filter((x) => x.status === "open").length + problem, unk = items.filter((x) => x.status === "unknown").length;
    let label;
    if (res === items.length) label = "Resolved";
    else if (unk === items.length) label = "Unknown";
    else if (res > 0) label = "Partially resolved";
    else label = "Unresolved";
    return { label, res, open, unk, problem, total: items.length, items,
      reason: res + " of " + items.length + " checks resolved" + (problem ? ", " + problem + " with a problem found" : "") + (open - problem ? ", " + (open - problem) + " open" : "") + (unk ? ", " + unk + " unknown" : "") + ". The tool records status; it does not certify title." };
  }

  function cityContext(m) {
    const by = { tailwind: [], headwind: [], mixed: [], unknown: [] };
    CITY_SIGNALS.forEach((s) => { const v = (m.signals[s.id] || {}).status || "unknown"; (by[v] || by.unknown).push(s.label); });
    const provided = CITY_SIGNALS.length - by.unknown.length;
    return { ...by, provided, total: CITY_SIGNALS.length, stage: m.cityStage, insufficient: provided === 0 };
  }

  /* ---------- Access & dependency (v1.1) ---------------------------- */
  // Ownership rights and functional control are not identical. This records
  // what the user knows; it is a diligence layer, not a legal opinion.

  const blank = (v) => v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length);

  function gateOf(id, name, disq, conc, notes, notAssessed, rule) {
    const label = notAssessed ? "Not assessed" : disq.length ? "Potential disqualifier" : conc.length ? "Concern" : "Acceptable";
    return { id, name, label, disq, conc, notes: notes || [], reasons: disq.concat(conc), rule };
  }

  function accessProfile(m) {
    const a = m.access, legal = m.dil.legal_access || "unknown";
    const deps = Array.isArray(a.dependencies) ? a.dependencies : [];
    const services = SERVICES.map((x) => ({ ...x, provider: (a.services || {})[x.id] || "" })).filter((x) => x.provider);
    const assessed = legal !== "unknown" || ["type", "last_mile", "year_round"].some((k) => !blank(a[k])) || deps.length > 0 || services.length > 0;
    const disq = [], conc = [], notes = [];
    if (legal === "problem") disq.push("a problem has been found with the documented legal access");
    if (a.year_round === "no") disq.push("the property is not reachable year-round");
    if (a.type === "via_other_land" && legal !== "resolved") disq.push("access crosses another landowner's property without verified rights");
    if (legal === "open") conc.push("legal access documentation is still open");
    else if (legal === "unknown") conc.push("legal access not yet verified");
    if (a.year_round === "seasonal") conc.push("access has seasonal problems");
    else if (a.year_round === "unknown") conc.push("year-round usability unknown");
    if (a.last_mile === "poor") conc.push("the last-mile road is poor");
    if (a.type === "via_other_land" && legal === "resolved") conc.push("access runs through another landowner's property (rights documented)");
    if (a.type === "private_own" || a.type === "shared") notes.push("access is by " + ACCESS_TYPES[a.type] + ": its upkeep is not a public responsibility");
    const flaggedDeps = deps.filter((d) => ACCESS_DEPS_FLAGGED.indexOf(d) >= 0);
    if (flaggedDeps.length) conc.push("functional use depends on " + list(flaggedDeps.map((d) => ACCESS_DEPS[d])));
    const otherDeps = deps.filter((d) => ACCESS_DEPS_FLAGGED.indexOf(d) < 0);
    if (otherDeps.length) notes.push("relies on " + list(otherDeps.map((d) => ACCESS_DEPS[d])));
    const flaggedServ = services.filter((x) => PROVIDERS_FLAGGED.indexOf(x.provider) >= 0);
    if (flaggedServ.length) conc.push(list(flaggedServ.map((x) => x.label.toLowerCase() + " (" + PROVIDERS[x.provider].toLowerCase() + ")")) + " depend" + (flaggedServ.length === 1 ? "s" : "") + " on parties outside your control");
    const gate = gateOf("access", "Legal & physical access", disq, conc, notes, !assessed,
      "Potential disqualifier: a problem with legal access, no year-round access, or a route through another's land without verified rights. Concern: unverified or open legal access, seasonal or unknown usability, a poor last mile, or dependence on third parties you don't control.");
    return { assessed, legal, type: a.type || "", lastMile: a.last_mile || "", yearRound: a.year_round || "", deps, services, note: a.dependency_note || "", gate };
  }

  /* ---------- Water security (v1.1) --------------------------------- */
  // Water is part of the asset and its infrastructure, not just a maintenance line.

  function waterProfile(m) {
    const w = m.water, src = Array.isArray(w.sources) ? w.sources : [];
    const keys = ["primary", "dry_season", "shortages", "tanker_freq", "borewells", "borewell_status", "storage_days", "backup", "groundwater", "potable", "tanker_monthly", "treatment_annual", "pumping_annual"];
    const assessed = src.length > 0 || keys.some((k) => !blank(w[k]));
    const primary = w.primary || (src.length === 1 ? src[0] : "");
    const others = src.filter((x) => x !== primary);
    const disq = [], conc = [];
    const onlyTanker = src.length > 0 && src.every((x) => x === "tanker");
    if (onlyTanker || primary === "tanker") disq.push("tankers are the primary water source");
    if (w.dry_season === "frequent" && w.backup !== "yes") disq.push("frequent dry-season interruptions with no backup source");
    if (w.potable === "not_usable") disq.push("the water is not usable even with available treatment");
    if (src.length && src.every((x) => x === "borewell") && w.borewell_status === "all_failed") disq.push("the only source is borewell and the borewells have failed");
    if (src.length === 1 && !onlyTanker) conc.push("a single source");
    if (w.dry_season === "occasional" || (w.dry_season === "frequent" && w.backup === "yes")) conc.push((w.dry_season === "frequent" ? "frequent" : "occasional") + " dry-season interruptions");
    if (w.shortages === "yes") conc.push("a history of shortages");
    if ((w.tanker_freq === "regular" || w.tanker_freq === "occasional") && !(onlyTanker || primary === "tanker")) conc.push(w.tanker_freq + " tanker dependence");
    if (w.borewell_status === "some_failed") conc.push("some borewells have failed");
    if (w.groundwater === "declining") conc.push("groundwater reported as declining");
    if (w.potable === "after_treatment") conc.push("usable only after treatment: a dependence on treatment systems");
    if (w.backup === "no" && w.dry_season !== "frequent") conc.push("no backup source");
    const unknowns = [["dry_season", "dry-season reliability"], ["potable", "water quality"], ["backup", "backup source"]].filter((x) => !w[x[0]] || w[x[0]] === "unknown").map((x) => x[1]);
    if (assessed && unknowns.length) conc.push("unknown " + list(unknowns));
    const control = Array.isArray(w.controlled_by) ? w.controlled_by : [];
    const monthly = m.waterCostAnnual / 12;
    const yn = (v) => (v === "yes" ? "yes" : v === "no" ? "no" : "unknown");
    const bwStatus = { working: "all working", some_failed: "some failed", all_failed: "all failed", unknown: "status unknown" };
    const chain = [
      { step: "Source", status: !src.length ? "Not entered" : src.length > 1 ? "Multiple sources" : "Single source",
        text: primary ? WATER_SOURCES[primary] + " primary" + (others.length ? "; also " + others.map((x) => WATER_SOURCES[x].toLowerCase()).join(", ") : "") : src.map((x) => WATER_SOURCES[x]).join(", ") },
      { step: "Reliability", status: w.dry_season === "none" && w.shortages !== "yes" ? "No interruptions reported" : w.dry_season === "frequent" ? "Frequent interruptions" : w.dry_season === "occasional" ? "Occasional interruptions" : "Unknown",
        text: [w.shortages ? "past shortages: " + yn(w.shortages) : "", w.tanker_freq ? "tankers: " + w.tanker_freq : "",
          src.indexOf("borewell") >= 0 ? (num(w.borewells) ? w.borewells + " borewell" + (+w.borewells > 1 ? "s" : "") : "borewell") + (w.borewell_status ? ": " + bwStatus[w.borewell_status] : "") : "",
          w.groundwater && w.groundwater !== "unknown" ? "groundwater " + w.groundwater + (w.groundwater_note ? " (" + w.groundwater_note + ")" : "") : ""].filter(Boolean).join(" · ") },
      { step: "Quality", status: { direct: "Directly usable", after_treatment: "Needs treatment", not_usable: "Not usable", unknown: "Unknown" }[w.potable] || "Unknown",
        text: [w.treatment, w.quality_issues].filter(Boolean).join(" · ") },
      { step: "Cost", status: m.waterCostAnnual > 0 ? money(monthly, m.ccy) + "/mo" : "None entered",
        text: (m.waterCostAnnual > 0 ? "Tanker, treatment and pumping: added to owner costs. " : "") + (pos(w.maintenance_share) ? money(pos(w.maintenance_share), m.ccy) + "/yr is already inside maintenance. " : "") + "Low water cost today does not prove long-term water security." },
      { step: "Fallback", status: w.backup === "yes" ? "Backup source" : w.backup === "no" ? "No backup" : "Unknown",
        text: [num(w.storage_days) !== null ? w.storage_days + " days of storage" : "storage not recorded", w.contingency].filter(Boolean).join(" · ") },
      { step: "Dependency", status: control.length ? control.filter((x) => x !== "self").length + " external" : "Not recorded",
        text: control.length ? "Supply depends on " + list(control.map((x) => WATER_CONTROL[x])) + "." : "" },
    ];
    const borewellNote = src.indexOf("borewell") >= 0 ? "Deeper borewell does not automatically mean more secure water: depth alone says nothing reliable about recharge or the groundwater trend." : null;
    const gate = gateOf("water", "Water & basic infrastructure", disq, conc, [], !assessed,
      "Potential disqualifier: tankers as the primary source, frequent dry-season failure with no backup, water unusable after treatment, or failed borewells as the only source. Concern: a single source, interruptions, shortages, tanker reliance, failed borewells, declining groundwater, treatment dependence, no backup, or unknowns.");
    return { assessed, sources: src, primary, chain, borewellNote, monthly, gate, groundwaterUnknown: src.indexOf("borewell") >= 0 && (!w.groundwater || w.groundwater === "unknown") };
  }

  /* ---------- Effective access (v1.1) -------------------------------- */
  // Distance is not access: the property's relationship with the places the
  // household needs to reach — in time, reliability and alternatives.

  function effectiveAccess(m) {
    const rows = m.destinations.map((d) => {
      const km = pos(d.km), normal = pos(d.normal), peak = pos(d.peak);
      const ratio = normal && peak ? peak / normal : null;
      const flags = [];
      if (ratio !== null && ratio >= ACCESS_RULES.peakRatio && peak - normal >= ACCESS_RULES.peakExtraMin) flags.push("peak-sensitive (" + ratio.toFixed(1) + "× at peak)");
      if (d.alt === "no") flags.push("single route");
      if (d.last_mile === "poor") flags.push("poor last mile");
      return { kind: d.kind || "other", label: d.label || DEST_KINDS[d.kind] || "Destination", km, normal, peak, ratio, lastMile: d.last_mile || "", alt: d.alt || "", flags };
    });
    return { assessed: rows.length > 0, rows, flagged: rows.filter((r) => r.flags.length) };
  }

  /* ---------- Location-thesis scenarios (v1.1) ----------------------- */
  // A: the growth thesis works · B: the area develops but supply absorbs the
  // upside · C: the thesis disappoints. No probabilities — exposure only.

  function thesisScenarios(m, R) {
    const live = (g) => g && g.label !== "Acceptable" && g.label !== "Not assessed";
    const constrained = live(R.access.gate) || live(R.water.gate);
    const defs = [
      { id: "A", name: "Growth thesis works", desc: "Employment, infrastructure and demand deepen; absorption stays healthy; appreciation is supportive.", appr: m.upside, src: "your upside case" },
      { id: "B", name: "Area develops, supply absorbs the upside", desc: "Infrastructure improves and the area becomes more useful, but competing supply keeps appreciation modest.", appr: m.thesisB, src: "Scenario B" },
      { id: "C", name: "Thesis disappoints", desc: "Infrastructure or jobs underwhelm, " + (constrained ? "the water/access constraints you recorded persist" : "water/access constraints remain") + ", resale liquidity weakens and prices correct. Rents stop growing; selling costs " + pct(m.thesisCExit, 0) + " more.", appr: m.thesisC, rentGrowth: 0, exitPct: m.exitPct + m.thesisCExit, src: "Scenario C" },
    ];
    const rows = defs.map((d) => {
      const s = simulate(m, { appr: d.appr, rentGrowth: d.rentGrowth, exitPct: d.exitPct });
      const paidIn = s.totals.equityIn, back = s.eqSale + sumPositive(s.eq, s.months);
      return { id: d.id, name: d.name, desc: d.desc, appr: d.appr, V: s.V, eqSale: s.eqSale, eqIRR: s.eqIRR, paidIn, back, net: back - paidIn,
        externalToExit: Math.max(0, -s.eqSale),
        hurdleMet: m.k.minReturn !== null && m.purpose !== "home" ? s.eqIRR !== null && s.eqIRR * 100 >= m.k.minReturn : null };
    });
    const answered = !!(m.thesisBHappy || m.thesisCSurvive);
    const relevant = m.purpose !== "home" || answered || m.cityStage === "early" || m.cityStage === "mid" ||
      m.engines.some((e) => ["land", "infrastructure", "jobs", "redevelopment", "belief", "uc_discount"].indexOf(e) >= 0);
    return { rows, bHappy: m.thesisBHappy, cSurvive: m.thesisCSurvive, answered, relevant };
  }

  /* ---------- Layer 1: fundamental gates (v1.1) ---------------------- */
  // Non-compensatory: nothing in the comparative profile offsets a gate.

  function gates(m, R) {
    const titleIds = ["title_chain", "encumbrance", "approvals", "registration_docs", "occupancy_cert", "project_registration", "land_title"];
    const items = m.diligenceItems.filter((x) => titleIds.indexOf(x.id) >= 0);
    const tDisq = items.filter((x) => x.status === "problem").map((x) => "problem found: " + x.label.charAt(0).toLowerCase() + x.label.slice(1));
    const tOpen = items.filter((x) => x.status === "open").length, tUnk = items.filter((x) => x.status === "unknown").length;
    const tConc = [];
    if (tOpen) tConc.push(tOpen + " title/approval check" + (tOpen > 1 ? "s" : "") + " open");
    if (tUnk) tConc.push(tUnk + " title/approval check" + (tUnk > 1 ? "s" : "") + " not yet verified");
    const title = gateOf("title", "Title & approvals", tDisq, tConc, [], false,
      "Potential disqualifier: any title or approval check marked 'problem found'. Concern: any check open or unverified. Acceptable: all resolved. The tool records status; it does not certify title.");

    const base = R.stress.find((r) => r.id === "base");
    const cashIds = ["min_liquid", "max_outflow", "max_ds"];
    const fDisq = [], fConc = [];
    if (base && base.breaches.some((t) => cashIds.indexOf(t.id) >= 0)) fDisq.push("the base case already breaches your " + uniq(base.breaches.filter((t) => cashIds.indexOf(t.id) >= 0).map((t) => t.label)).join(" and "));
    if (R.hh.shortfall > 0) fDisq.push("the cash needed exceeds your liquid and financial assets by " + money(R.hh.shortfall, m.ccy));
    if (m.thesisCSurvive === "no") fDisq.push("you said your finances and plans would not survive Scenario C");
    const stressed = R.stress.filter((r) => r.id !== "base" && r.breaches && r.breaches.some((t) => cashIds.indexOf(t.id) >= 0));
    if (stressed.length) fConc.push(list(stressed.map((r) => r.name.toLowerCase())) + " breach" + (stressed.length === 1 ? "es" : "") + " a cash-flow red line");
    const c = R.thesis.rows.find((x) => x.id === "C");
    if (c && c.externalToExit > 0) fConc.push("selling under Scenario C would need " + money(c.externalToExit, m.ccy) + " of other cash to clear the loan");
    if (m.thesisCSurvive === "unsure") fConc.push("you are unsure your plans survive Scenario C");
    const finAssessed = cashRedLines(m) || fDisq.length > 0 || fConc.length > 0;
    const finance = gateOf("finance", "Financial survivability", fDisq, fConc, [], !finAssessed,
      "Potential disqualifier: the base case breaches a cash-flow red line, the purchase needs more cash than you have, or you said you couldn't survive Scenario C. Concern: a stress scenario breaches a cash-flow red line, exiting under Scenario C needs other cash, or you're unsure about Scenario C. Not assessed until you set a cash-flow red line.");
    return [title, R.access.gate, R.water.gate, finance];
  }

  /* ---------- Layer 2: comparative profile (v1.1) -------------------- */
  // Ranked by the user's own importance. Never summed into a score and never
  // allowed to offset a gate.

  function comparative(m, R) {
    const imp = { high: 0, medium: 1, low: 2 };
    const rows = COMPARE_DIMS.map((d) => {
      const v = m.compare[d.id] || {};
      const ev = d.dest ? R.effective.rows.filter((r) => d.dest.indexOf(r.kind) >= 0).map((r) => r.label + " " + (r.normal !== null ? r.normal + (r.peak !== null ? "–" + r.peak : "") + " min" : r.km !== null ? r.km + " km" : "") + (r.flags.length ? " (" + r.flags.join(", ") + ")" : "")) : [];
      return { id: d.id, label: d.label, rating: v.rating || "", importance: v.importance || "", evidence: ev.join("; ") };
    }).filter((r) => r.rating || r.importance);
    rows.sort((a, b) => (imp[a.importance] === undefined ? 3 : imp[a.importance]) - (imp[b.importance] === undefined ? 3 : imp[b.importance]));
    const fd = R.apprDep.primary;
    const financial = { label: "Financial attractiveness", text: R.assetCharacter + (fd && fd.label ? "; appreciation dependency " + fd.label.toLowerCase() : "") + (R.rental ? "; net yield " + pct(R.rental.netYield, 1) : "") + (R.rentVsOwn && m.purpose === "home" ? "; owning v renting at your base case: " + money(R.rentVsOwn.base.ownerWealth - R.rentVsOwn.base.renterWealth, m.ccy) : "") };
    return { rows, financial, assessed: rows.length > 0 };
  }

  /* ---------- Synthesis (spec §13–14) ------------------------------ */

  function list(a) {
    if (a.length <= 1) return a.join("");
    return a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  }

  function tradeoff(m, R) {
    const $ = (v) => money(v, m.ccy);
    const be = R.uc ? R.uc.breakEven : null;
    // 1. execution integrity
    if (m.uc && (R.execution.label !== "Resolved" || (be !== null && isFinite(be)))) {
      const d0 = R.uc.delays[0].cmp;
      return { id: "uc", pair: ["Lower under-construction price", "unresolved execution and delay risk"],
        text: "You are exchanging a lower price" + (d0 ? " (" + $(d0.sticker) + " below the ready comparable)" : "") + " for unresolved execution and delay risk" + (be !== null && isFinite(be) ? ": about " + months(be) + " of delay would consume the advantage." : ".") };
    }
    // 2. survivability
    if (m.financed && (R.leverage.label === "High" || R.leverage.label === "Moderate")) {
      return { id: "leverage", pair: ["Higher leverage", "greater cash-flow fragility"],
        text: "You are exchanging less capital upfront (a loan of " + pct(m.LTV, 0) + " of the price) for a thinner margin of error: " + R.leverage.reason.charAt(0).toLowerCase() + R.leverage.reason.slice(1) };
    }
    // 3. appreciation dependency
    const fd = R.apprDep.financial;
    if (fd && (fd.label === "High" || fd.label === "Moderate") && m.purpose !== "home") {
      return { id: "yield", pair: ["Low current yield", "dependence on future appreciation"],
        text: "You are accepting " + (R.rental ? "a " + pct(R.rental.netYield, 1) + " net yield today" : "little current income") + " in exchange for dependence on future appreciation: " + fd.reason.charAt(0).toLowerCase() + fd.reason.slice(1) };
    }
    // 4. liquidity / concentration
    const hh = R.hh;
    if (m.selfUse && R.utility.label === "Strong" && hh.before && hh.after) {
      return { id: "utility-liquidity", pair: ["Housing utility", "liquidity and financial optionality"],
        text: "You are deliberately exchanging liquid financial optionality (liquid assets " + $(hh.before.liquid) + " → " + $(hh.after.liquid) + ") for housing permanence you expect to use for " + years(m.H) + "." };
    }
    if (hh.before && hh.after && hh.after.equityShare !== null && (hh.before.equityShare === null || hh.after.equityShare > hh.before.equityShare + 0.05)) {
      return { id: "concentration", pair: ["Concentrated property wealth", "lower balance-sheet flexibility"],
        text: "You are concentrating wealth in property: real-estate equity moves from " + pct(hh.before.equityShare || 0, 0) + " to " + pct(hh.after.equityShare, 0) + " of net worth: in exchange for less balance-sheet flexibility." };
    }
    // 5. utility / consumption
    if (m.enoughPrice && m.enoughPrice < m.P) {
      return { id: "more-house", pair: ["More house", "a larger Housing-Consumption Premium" + (m.fi ? " and later financial independence" : "")],
        text: "You are choosing " + $(m.P - m.enoughPrice) + " more house than the home you said would be enough, buying " + (R.utility.label === "Strong" ? list(m.utility.map((u) => UTILITY[u]).slice(0, 2)) : "more space or location") + " with capital that would otherwise stay flexible." };
    }
    // 6. market context
    if (m.cityStage === "mature") return { id: "mature", pair: ["Mature, certain location", "higher starting valuation"], text: "You are paying for an established, certain location, which usually means a higher starting valuation and less transformational upside." };
    if (m.cityStage === "early") return { id: "early", pair: ["Early-stage location", "uncertain transformation"], text: "You are buying optionality in a location still being transformed: with more uncertainty about whether that transformation arrives, and when." };
    return { id: "none", pair: [], text: "No single dominant tension emerges from the inputs entered; the trade-offs below are spread across several dimensions." };
  }

  function worksIf(m, R) {
    const $ = (v) => money(v, m.ccy);
    const c = [];
    const hh = R.hh, base = R.stress.find((r) => r.id === "base");
    if (m.uc && R.uc && R.uc.breakEven !== null && R.uc.breakEven > 0)
      c.push({ pri: 1, text: "possession arrives within about " + (isFinite(R.uc.breakEven) ? months(R.uc.breakEven) : "ten years") + " of the promised date: the point at which delay costs consume the under-construction advantage." });
    if (R.execution.label !== "Resolved" && R.execution.total)
      c.push({ pri: 1, text: "the " + (R.execution.open + R.execution.unk) + " open or unknown legal/project checks come back clean before you commit." });
    if (hh.L1 !== null && m.reserve !== null && base && !base.breaches.some((t) => t.id === "min_liquid"))
      c.push({ pri: 2, text: "liquid assets stay above the " + $(m.reserve) + " floor you set: they start at " + $(hh.L1) + " after purchase." });
    const rate = R.stress.find((r) => r.id === "rate");
    if (rate && !rate.na && rate.status === "within")
      c.push({ pri: 2, text: "rates rise no more than the tested " + m.bump + " bps; even then the EMI of " + $(rate.E2) + " stays within your limits." });
    const fd = R.apprDep.financial;
    if (fd && fd.required && fd.required.bound === null && fd.required.value > 0)
      c.push({ pri: 3, text: "prices grow at least about " + pct(fd.required.value) + " a year: what " + fd.objective + " requires." });
    if (R.rentVsOwn && m.purpose === "home" && R.rentVsOwn.base.ownerWealth >= R.rentVsOwn.base.renterWealth)
      c.push({ pri: 3, text: "appreciation reaches roughly your base case: at that rate owning ends at least as wealthy as renting the equivalent home" + (R.rentVsOwn.breakEven && R.rentVsOwn.breakEven.bound === null ? " (break-even about " + pct(R.rentVsOwn.breakEven.value) + " a year)" : "") + "." });
    if (R.rental && R.rental.afterDebt >= 0)
      c.push({ pri: 3, text: "rent keeps covering costs and debt service: after-debt cash flow is " + $(R.rental.afterDebt) + " a year, so appreciation is not needed just to carry it." });
    if (isFinite(R.frictionYears) && m.H >= R.frictionYears)
      c.push({ pri: 4, text: "you really do hold for " + years(m.H) + ": at your base appreciation it takes about " + years(R.frictionYears) + " for the sale price to absorb the " + pct(R.roundTripFriction, 0) + " round-trip transaction cost." });
    if (R.utility.label === "Strong")
      c.push({ pri: 5, text: "you keep valuing " + list(m.utility.map((u) => UTILITY[u]).slice(0, 3)) + " even if the home only keeps pace with inflation: as you said in the Zero-Appreciation Test." });
    const gA = R.gates.find((x) => x.id === "access"), gW = R.gates.find((x) => x.id === "water");
    if (gA.label === "Acceptable" && gW.label === "Acceptable")
      c.push({ pri: 4, text: "the access and water arrangements you've recorded keep holding: documented, year-round access and a water supply with a fallback." });
    const tc = R.thesis.rows.find((x) => x.id === "C");
    if (m.thesisCSurvive === "yes" && tc && tc.externalToExit === 0)
      c.push({ pri: 3, text: "even if the location thesis disappoints (Scenario C, " + pct(m.thesisC) + " a year, weaker resale), you could exit without adding cash, and you've said your plans survive it." });
    if (m.thesisBHappy === "yes")
      c.push({ pri: 5, text: "you stay content owning it even if the area develops but new supply caps appreciation (Scenario B, " + pct(m.thesisB) + " a year): as you said." });
    if (R.city && R.city.tailwind.length && (m.engines.indexOf("jobs") >= 0 || m.engines.indexOf("infrastructure") >= 0))
      c.push({ pri: 6, text: "the local " + R.city.tailwind.slice(0, 2).join(" and ").toLowerCase() + " you see as tailwinds keep supporting this micro-market, and are not already fully in today's price." });
    return c.sort((a, b) => a.pri - b.pri).slice(0, 3);
  }

  function strugglesIf(m, R) {
    const $ = (v) => money(v, m.ccy);
    const c = [];
    const ex = R.execution;
    if (ex.open + ex.unk > 0) c.push({ pri: 1, text: "any of the " + (ex.open + ex.unk) + " unresolved legal/project checks turns out badly; they remain open or unknown today." });
    if (m.uc && R.uc && R.uc.breakEven !== null && isFinite(R.uc.breakEven))
      c.push({ pri: 1, text: (R.uc.breakEven === 0 ? "you value the price gap alone; even on time, waiting costs exceed the advantage over a ready comparable." : "possession slips beyond about " + months(R.uc.breakEven) + ": the delay costs then exceed the price advantage over a ready comparable" + (m.k.maxDelay !== null && R.uc.breakEven <= m.k.maxDelay ? ", inside the " + m.k.maxDelay + "-month delay you said you would tolerate" : "") + ".") });
    const fdx = R.apprDep.financial;
    R.stress.filter((r) => r.status === "breach" && r.id !== "base" && !r.compound).forEach((r) => {
      const apprOnly = r.id === "flat" || r.id === "zeroReal";
      if (apprOnly && fdx && (fdx.label === "High" || fdx.label === "Moderate")) return; // covered by the appreciation condition
      c.push({ pri: apprOnly ? 3 : 2, text: r.name.toLowerCase() + " (" + r.desc.toLowerCase() + "): it breaches your " + uniq(r.breaches.map((t) => t.label)).join(" and ") + " (" + r.breaches[0].detail + ")." });
    });
    const base = R.stress.find((r) => r.id === "base");
    if (base && base.status === "breach" && base.breaches.some((t) => t.id !== "legal")) c.unshift({ pri: 2, text: "nothing changes at all: the base case already breaches your " + uniq(base.breaches.filter((t) => t.id !== "legal").map((t) => t.label)).join(" and ") + " (" + base.breaches.filter((t) => t.id !== "legal")[0].detail + ")." });
    const comp = R.stress.find((r) => r.compound);
    if (comp && comp.status === "breach" && !R.stress.some((r) => r.status === "breach" && !r.compound && r.id !== "base"))
      c.push({ pri: 2, text: "ordinary disappointments arrive together (" + comp.desc + "); combined, they breach your " + uniq(comp.breaches.map((t) => t.label)).join(" and ") + "." });
    const fd = R.apprDep.financial;
    if (fd && (fd.label === "High" || fd.label === "Moderate"))
      c.push({ pri: 3, text: "appreciation disappoints: " + (fd.required && fd.required.bound === null ? "below about " + pct(fd.required.value) + " a year the case misses " + fd.objective : fd.reason.toLowerCase()) + "." });
    if (R.rentVsOwn && m.purpose === "home") {
      const rb = R.rentVsOwn.base, be = R.rentVsOwn.breakEven;
      if (rb.renterWealth > rb.ownerWealth)
        c.push({ pri: 3, text: "you judge it purely financially: at your base appreciation, renting the equivalent home" + (m.altInvests ? " and investing the difference" : "") + " ends about " + $(rb.renterWealth - rb.ownerWealth) + " wealthier" + (be && be.bound === null ? "; owning catches up only at about " + pct(be.value) + " a year" : "") + ". That gap is what the utility is costing you." });
    }
    if (R.rental && R.rental.afterDebt < 0)
      c.push({ pri: 3, text: "rent alone has to carry the property, and it doesn't: after-debt cash flow is " + $(R.rental.afterDebt) + " a year, funded from your income." });
    if (isFinite(R.frictionYears) ? m.H < R.frictionYears : true)
      c.push({ pri: 4, text: "you sell within " + (isFinite(R.frictionYears) ? "about " + years(R.frictionYears) : "your holding period") + ": before then, transaction friction of " + pct(R.roundTripFriction, 0) + " of the price dominates the outcome" + (m.moveRisk === "likely" || m.moveRisk === "plausible" ? ", and you rate a move as " + m.moveRisk : "") + "." });
    else if (m.moveRisk === "likely" || m.moveRisk === "plausible")
      c.push({ pri: 4, text: "the move you rate as " + m.moveRisk + " forces an early sale into whatever market exists then." });
    R.gates.filter((g) => g.id === "access" || g.id === "water").forEach((g) => {
      if (g.label === "Potential disqualifier") c.push({ pri: 1, text: (g.id === "access" ? "access can't be relied on: " : "water can't be relied on: ") + list(g.disq) + ". No other strength in the profile offsets this." });
      else if (g.label === "Concern") c.push({ pri: 4, text: (g.id === "access" ? "the access you depend on fails you: " : "the water supply fails you: ") + g.conc.slice(0, 2).join("; ") + "." });
    });
    const tC = R.thesis.rows.find((x) => x.id === "C");
    if (tC && (m.thesisCSurvive === "no" || m.thesisCSurvive === "unsure" || tC.externalToExit > 0))
      c.push({ pri: m.thesisCSurvive === "no" ? 1 : 2, text: "the location thesis disappoints (Scenario C: " + pct(m.thesisC) + " a year, weaker resale): equity at sale would be " + money(tC.eqSale, m.ccy) + (tC.externalToExit > 0 ? ", so exiting needs " + money(tC.externalToExit, m.ccy) + " of other cash" : "") + (m.thesisCSurvive ? "; you said you " + (m.thesisCSurvive === "no" ? "could not survive it" : "are unsure you'd survive it") : "") + "." });
    if (m.thesisBHappy === "no")
      c.push({ pri: 3, text: "the area develops but new supply absorbs the upside (Scenario B, " + pct(m.thesisB) + " a year): you said you would not be happy owning it then." });
    const shock = R.stress.find((r) => r.id === "shock");
    if (shock && /^(Requires|Would)/.test(shock.source || ""))
      c.push({ pri: 4, text: "you need " + $(m.shock) + " in year " + m.shockYear + ": " + shock.source.toLowerCase() + "." });
    if (R.utility.label === "Weak" || R.utility.label === "Mixed")
      c.push({ pri: 5, text: "the home's appeal fades without price gains: your Zero-Appreciation answer suggests the utility case alone may not hold it." });
    return dedupe(c.sort((a, b) => a.pri - b.pri)).slice(0, 3);
  }
  const dedupe = (a) => a.filter((x, i) => a.findIndex((y) => y.text === x.text) === i);

  function openQuestions(m, R) {
    const q = [];
    R.execution.items.filter((x) => x.status !== "resolved").forEach((x) => q.push({ kind: "Diligence", text: x.label + ": " + (x.status === "problem" ? "problem found" : x.status === "open" ? "open" : "status unknown") }));
    if (!R.water.assessed) q.push({ kind: "Water", text: "Water security not recorded: source, reliability, quality, fallback and dependency are unknown, not assumed." });
    else {
      R.water.chain.filter((x) => x.status === "Unknown").forEach((x) => q.push({ kind: "Water", text: x.step + " unknown." }));
      if (R.water.groundwaterUnknown) q.push({ kind: "Water", text: "Groundwater trend unknown: borewell depth alone cannot establish water security." });
    }
    if (!R.access.assessed) q.push({ kind: "Access", text: "Physical access not recorded: road type, last-mile quality and year-round use." });
    if (!R.effective.assessed && m.selfUse) q.push({ kind: "Access", text: "Effective access not assessed: travel times to the places your household needs to reach." });
    if (m.zat === "yes" && m.thesisBHappy === "no") q.push({ kind: "Objective", text: "You'd want the home without real appreciation, but not under Scenario B: worth reconciling which is true." });
    if (R.thesis.relevant && !R.thesis.answered) q.push({ kind: "Scenario", text: "Location-thesis questions unanswered: would you be happy under Scenario B, and can you survive Scenario C?" });
    if (R.evidence.label === "Insufficient" || R.evidence.label === "Weak") q.push({ kind: "Price", text: "Comparable evidence is " + R.evidence.label.toLowerCase() + ": add completed transactions to test the price." });
    else if (R.evidence.oldest > EVIDENCE_RULES.recentMonths) q.push({ kind: "Price", text: "Some comparables are over " + EVIDENCE_RULES.recentMonths + " months old (Time Spread)." });
    if (!m.acqKnown) q.push({ kind: "Costs", text: "Acquisition costs not entered: returns and housing cost are incomplete." });
    if (!m.ownerKnown) q.push({ kind: "Costs", text: "Annual owner costs not entered: returns and housing cost are incomplete." });
    if (!m.exitKnown) q.push({ kind: "Costs", text: "Exit / selling costs not entered: sale proceeds overstated." });
    if (m.selfUse && !m.Req) q.push({ kind: "Rent", text: "Equivalent market rent not entered: rent-v-own and imputed-housing comparisons withheld." });
    if (m.letting && !m.R) q.push({ kind: "Rent", text: "Expected rent not entered: rental P&L withheld." });
    if (m.living === null) q.push({ kind: "Household", text: "Monthly living expenses not entered: household surplus and income-interruption burn are incomplete." });
    if (m.liquid0 === null || m.fin0 === null) q.push({ kind: "Household", text: "Liquid and financial assets needed for the balance sheet." });
    if (R.city.insufficient) q.push({ kind: "City", text: "No city signals entered: the City layer is shown as insufficient data, not inferred." });
    if (m.infl === null) q.push({ kind: "Scenario", text: "No inflation scenario: real returns and the zero-real test withheld." });
    if (m.uc && !m.Rp) q.push({ kind: "Under construction", text: "No ready comparable price: the Uncertainty Discount cannot be measured." });
    if (m.uc && !m.scheduleEntered) q.push({ kind: "Under construction", text: "Payment schedule not entered: an illustrative construction-linked plan is used." });
    if (m.uc && !m.developer) q.push({ kind: "Under construction", text: "Developer not named: delivery record cannot be reviewed." });
    if (R.fire.status === "Not assessed" && m.fi) q.push({ kind: "FI", text: R.fire.reason });
    q.push({ kind: "Tax", text: "Taxes on rent and capital gains are not modelled unless you entered them as exit tax." });
    return q;
  }

  function statement(m, R) {
    const $ = (v) => money(v, m.ccy);
    const parts = [];
    let what;
    if (m.purpose === "home") {
      what = R.utility.label === "Strong" ? "primarily a high-utility housing purchase" : R.utility.label === "Weak" ? "a home purchase in which, by your own Zero-Appreciation answer, the financial case is doing much of the work" : "primarily a housing purchase whose utility case is still " + (R.utility.label ? R.utility.label.toLowerCase() : "unstated");
    } else if (m.purpose === "investment") {
      what = (R.assetCharacter === "Income-led" ? "an income-led" : R.assetCharacter === "Appreciation-led" ? "an appreciation-led" : "a rent-plus-appreciation") + " investment property";
    } else if (m.purpose === "mixed") what = "a mixed purchase: a home with a material investment objective";
    else what = "an appreciation-led, resale-oriented purchase";
    let s1 = "This is " + what + (m.uc ? ", bought under construction" : "") + ", " + (m.financed ? "financed with a loan of " + pct(m.LTV, 0) + " of the price" : "bought without a loan");
    if (R.rental) s1 += ", with a net rental yield of " + pct(R.rental.netYield, 1) + " at today's price";
    parts.push(s1 + ".");

    const gd = R.gates.filter((g) => g.label === "Potential disqualifier"), gc = R.gates.filter((g) => g.label === "Concern");
    if (gd.length) parts.push("Fundamental gate" + (gd.length > 1 ? "s" : "") + ": " + list(gd.map((g) => g.name.toLowerCase())) + (gd.length > 1 ? " are potential disqualifiers" : " is a potential disqualifier") + " (" + gd[0].disq[0] + "): nothing else in this profile offsets " + (gd.length > 1 ? "them" : "it") + ".");
    else if (gc.length === R.gates.length) parts.push("No fundamental gate is a potential disqualifier, but all four carry concerns.");
    else if (gc.length) parts.push("No fundamental gate is a potential disqualifier; " + list(gc.map((g) => g.name.toLowerCase())) + (gc.length > 1 ? " carry concerns" : " carries a concern") + ".");

    const base = R.stress.find((r) => r.id === "base");
    const breached = R.stress.filter((r) => r.status === "breach" && r.id !== "base");
    if (!R.redLinesSet) parts.push("You have not set any red lines, so the stress results are described rather than tested against your own limits.");
    else if (base.status === "breach") {
      const legal = base.breaches.find((t) => t.id === "legal"), other = base.breaches.filter((t) => t.id !== "legal");
      if (legal) { const n = m.diligenceItems.filter((x) => m.k.legal.indexOf(x.id) >= 0 && x.status !== "resolved").length; parts.push("Before anything else: " + n + " item" + (n > 1 ? "s" : "") + " you said must be resolved before proceeding " + (n > 1 ? "are" : "is") + " still open."); }
      if (other.length) parts.push((legal ? "And even" : "Even") + " the base case breaches your " + uniq(other.map((t) => t.label)).join(" and ") + ".");
      if (!other.length && breached.length) parts.push("Beyond that, the " + list(breached.slice(0, 2).map((r) => r.name.toLowerCase() + " scenario")) + " breach" + (breached.length === 1 ? "es" : "") + " your " + uniq(flat(breached.slice(0, 2).map((r) => r.breaches.map((t) => t.label)))).join(" and ") + ".");
    }
    else if (breached.length) parts.push("In the base case it stays within the red lines you set, but the " + list(breached.slice(0, 2).map((r) => r.name.toLowerCase() + " scenario")) + (breached.length > 2 ? " (and " + (breached.length - 2) + " more)" : "") + " breach" + (breached.length === 1 ? "es" : "") + " your " + uniq(flat(breached.slice(0, 2).map((r) => r.breaches.map((t) => t.label)))).join(" and ") + ".");
    else parts.push("It stays within every red line you set across the tested scenarios.");

    const dep = R.apprDep.primary;
    if (dep && dep.label) parts.push("Appreciation dependency is " + dep.label.toLowerCase() + ": " + dep.reason.charAt(0).toLowerCase() + dep.reason.slice(1));
    if (m.purpose === "mixed" && R.apprDep.home && R.apprDep.financial && R.apprDep.home.label) parts.push("Separately, the utility case is " + (R.utility.label || "unstated").toLowerCase() + ": the two are not netted against each other.");
    if (R.tradeoff && R.tradeoff.id !== "none") parts.push("The main trade-off: " + R.tradeoff.text.charAt(0).toLowerCase() + R.tradeoff.text.slice(1));
    const unresolved = [];
    if (R.execution.open + R.execution.unk) unresolved.push((R.execution.open + R.execution.unk) + " legal/project check" + (R.execution.open + R.execution.unk > 1 ? "s" : ""));
    if (R.evidence.label === "Insufficient" || R.evidence.label === "Weak") unresolved.push("the strength of the price evidence");
    if (R.city.insufficient) unresolved.push("city fundamentals");
    if (unresolved.length) parts.push("Still unresolved: " + list(unresolved) + ".");
    return parts.join(" ");
  }

  function completeness(m, R) {
    const withheld = [];
    if (R.evidence.label === "Insufficient") withheld.push("price-confidence conclusion");
    if (m.selfUse && !m.Req) withheld.push("rent-v-own comparison");
    if (!m.acqKnown || !m.ownerKnown || !m.exitKnown) withheld.push("complete return and housing-cost figures");
    if (R.fire.status === "Not assessed") withheld.push("FIRE impact");
    if (R.city.insufficient) withheld.push("city layer");
    if (m.infl === null) withheld.push("real returns");
    if (m.living === null) withheld.push("full household cash-flow stress");
    if (m.liquid0 === null || m.fin0 === null) withheld.push("balance sheet");
    return { complete: withheld.length === 0, withheld };
  }

  return {
    run, model, simulate, coreMissing, emi, balanceAfter, monthsToClear, irr, npv, solveIncreasing,
    rentVsOwn, delayCost, ucCompare, frictionYears, evidence, household, money, pct, months, years,
    DILIGENCE, UTILITY, ENGINES, CITY_SIGNALS, EVIDENCE_RULES, FI_NEUTRAL_YEARS, CCY,
    WATER_SOURCES, WATER_CONTROL, ACCESS_TYPES, ACCESS_DEPS, SERVICES, PROVIDERS, DEST_KINDS, ACCESS_RULES, COMPARE_DIMS, GATE_LABELS,
  };
});
