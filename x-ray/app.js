/* ============================================================
   Property Decision X-Ray — interface
   Vanilla JS, no dependencies, no build step.
   One Decision Case object (spec §7) drives every step and the
   report; the engine (engine.js) does all the arithmetic.
   ============================================================ */

(function () {
  "use strict";

  const E = window.XRayEngine, D = window.XRayData;
  const app = document.getElementById("app");
  const STORE = "zenca.xray.v1";

  /* ---------- Small utilities -------------------------------------- */

  const esc = (s) => String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uid = () => "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const isBlank = (v) => v === null || v === undefined || v === "" || (Array.isArray(v) && !v.length);

  function get(obj, path) {
    return path.split(".").reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj);
  }
  function set(obj, path, val) {
    const ks = path.split(".");
    let o = obj;
    ks.slice(0, -1).forEach((k) => { if (o[k] === undefined || o[k] === null || typeof o[k] !== "object") o[k] = {}; o = o[k]; });
    o[ks[ks.length - 1]] = val;
  }

  // Money shorthand: 3cr, 45L, 1.2m, 850k, 30,00,000
  function parseMoney(s) {
    if (s === null || s === undefined) return "";
    s = String(s).trim().toLowerCase().replace(/[₹$€£¥,\s]/g, "").replace(/^(inr|usd|rs\.?)/, "");
    if (!s) return "";
    const m = s.match(/^(-?\d*\.?\d+)(cr|crore|crores|l|lac|lakh|lakhs|k|m|mn|b|bn)?$/);
    if (!m) return NaN;
    const mult = { cr: 1e7, crore: 1e7, crores: 1e7, l: 1e5, lac: 1e5, lakh: 1e5, lakhs: 1e5, k: 1e3, m: 1e6, mn: 1e6, b: 1e9, bn: 1e9 }[m[2]] || 1;
    return Math.round(parseFloat(m[1]) * mult);
  }

  /* ---------- State & persistence ---------------------------------- */

  let state = load();
  function load() {
    try { const s = JSON.parse(localStorage.getItem(STORE)); if (s && s.cases) return s; } catch (e) { /* storage unavailable */ }
    return { cases: {}, current: null };
  }
  let saveT = null;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* ignore */ } }, 250);
  }
  // A shared link renders someone else's case read-only. While it is on
  // screen it is the "current" case for rendering, but it is never stored.
  let viewCase = null;
  const cur = () => viewCase || state.cases[state.current];
  function flushSave() { clearTimeout(saveT); try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* ignore */ } }

  const SCEN_DEFAULTS = {
    base_appr: 5, upside_appr: 8, inflation: 5, rent_growth: "", vacancy_base_months: 1,
    flat_years: 5, price_fall_pct: 20, rate_rise_bps: 200, income_months: 6, vacancy_months: 6,
    delay_a: 12, delay_b: 24, shock_amount: "", shock_year: 3, compound: ["rate", "income"],
    thesis_b_appr: 2, thesis_c_appr: -2, thesis_c_exit_extra: 3,
  };

  function blankCase() {
    return {
      meta: { name: "New property case", created: new Date().toISOString() },
      decision: { purpose: "", status: "", occupancy: "", holding_years: "", move_risk: "" },
      market: { country: "IN", currency: "INR", city: "", micro_market: "", city_stage: "", signals: {} },
      property: { acq: {}, owner: {}, comps: [], return_engine: [] },
      diligence: { items: {}, schedule: [] },
      financing: { mode: "", rate_type: "floating" },
      household: { outlays: [], fi_active: false },
      life: { utility: [], alt_invests: "yes" },
      constraints: { min_liquid_mode: "amount", max_outflow_mode: "amount", legal_required: [] },
      scenarios: Object.assign(clone(SCEN_DEFAULTS), { _touched: {} }),
    };
  }

  // Cases can arrive from elsewhere on the same origin (the Worksheet writes
  // into this tool's storage) or from older versions of this tool, with
  // fields missing. Merge every stored case over a blank case so the
  // interface never meets an undefined branch.
  const isPlain = (v) => v && typeof v === "object" && !Array.isArray(v);
  function mergeOver(base, incoming) {
    Object.keys(incoming || {}).forEach((k) => {
      const v = incoming[k];
      if (v === undefined) return;
      base[k] = isPlain(v) && isPlain(base[k]) ? mergeOver(base[k], v) : v;
    });
    return base;
  }
  const normaliseCase = (c) => mergeOver(blankCase(), c || {});
  Object.keys(state.cases).forEach((k) => { state.cases[k] = normaliseCase(state.cases[k]); });

  // Optional site services (analytics, sibling-tool links) from the shared
  // site script. Absent when the tool is opened on its own — then a no-op.
  const site = () => window.ZencaSite || null;
  function track(name) { try { const s = site(); if (s && s.track) s.track(name, true); } catch (e) { /* analytics never breaks the tool */ } }
  let reportTracked = null;

  function openCase(c) {
    c = normaliseCase(c);
    const id = uid();
    c.meta = c.meta || {};
    c.meta.created = c.meta.created || new Date().toISOString();
    c.meta.updated = new Date().toISOString();
    state.cases[id] = c; state.current = id; save();
    return id;
  }

  /* ---------- Option lists ----------------------------------------- */

  const O = {
    purpose: [["home", "Primary home", "Housing and life utility; investment characteristics still matter."], ["investment", "Investment property", "Income plus capital return."], ["mixed", "Mixed", "A home with a material investment objective."], ["speculative", "Appreciation-led", "A resale or transformation thesis dominates."]],
    status: [["ready", "Ready / completed"], ["uc", "Under construction"]],
    occupancy: [["self", "Live in it"], ["rent", "Rent it out"], ["mixed", "Live in part / let part"], ["resale", "Hold for resale"]],
    move: [["low", "Low"], ["plausible", "Plausible"], ["likely", "Likely"]],
    country: Object.keys(D.COUNTRIES).map((k) => [k, D.COUNTRIES[k].name]),
    currency: Object.keys(E.CCY).map((k) => [k, k]),
    ptype: [["apartment", "Apartment"], ["house", "House"], ["plot", "Plot + structure"], ["other", "Other residential"]],
    areaBasis: [["carpet", "Carpet / usable"], ["builtup", "Built-up"], ["superbuiltup", "Super built-up"], ["other", "Other / unsure"]],
    cityStage: [["early", "Early transformation"], ["mid", "Mid-transformation"], ["mature", "Mature"], ["declining", "Declining / bypassed"]],
    signal: [["unknown", "Unknown"], ["tailwind", "Tailwind"], ["headwind", "Headwind"], ["mixed", "Mixed"]],
    compType: [["transaction", "Transaction"], ["listing", "Listing"], ["lender", "Lender valuation"], ["broker", "Broker estimate"], ["reference", "Reference / circle rate"]],
    similarity: [["high", "High"], ["medium", "Medium"], ["low", "Low"]],
    projectStage: [["launch", "Launch"], ["early", "Early"], ["structure", "Structure"], ["finishing", "Finishing"], ["near", "Near completion"]],
    regStatus: [["registered", "Registered"], ["pending", "Pending"], ["not", "Not registered"], ["na", "Not applicable"], ["unknown", "Unknown"]],
    fundMode: [["cash", "Cash: no loan"], ["loan", "With a loan"]],
    rateType: [["floating", "Floating"], ["fixed", "Fixed"], ["hybrid", "Hybrid"]],
    stability: [["stable", "Stable"], ["variable", "Variable"], ["concentrated", "Concentrated"], ["uncertain", "Uncertain"]],
    zat: [["yes", "Yes, I'd still want it"], ["unsure", "Unsure"], ["no", "No, I'm counting on appreciation"]],
    utility: Object.keys(E.UTILITY).map((k) => [k, E.UTILITY[k].replace(/^./, (c) => c.toUpperCase())]),
    engines: Object.keys(E.ENGINES).map((k) => [k, E.ENGINES[k].replace(/^./, (c) => c.toUpperCase())]),
    alt: [["rent", "Rent the same home"], ["cheaper", "Buy a cheaper home"], ["ready", "Buy a ready alternative"], ["wait", "Wait"], ["invest", "Invest elsewhere"], ["larger_down", "Larger down payment"], ["custom", "Something else"]],
    yesno: [["yes", "Yes"], ["no", "No"]],
    liqMode: [["amount", "Amount"], ["months", "Months of living expenses"]],
    outMode: [["amount", "Amount / month"], ["pct", "% of after-tax income"]],
    apprMax: [["zero", "Must work at zero appreciation"], ["base", "Must work within my base case"], ["", "No limit set"]],
    accessType: [["public", "Public road"], ["private_own", "Own private road"], ["shared", "Shared / association road"], ["via_other_land", "Through another landowner's property"], ["unknown", "Unknown"]],
    lastMile: [["good", "Good"], ["fair", "Fair"], ["poor", "Poor"], ["unknown", "Unknown"]],
    yearRound: [["yes", "Year-round"], ["seasonal", "Seasonal problems"], ["no", "Not year-round"], ["unknown", "Unknown"]],
    accessDeps: [["neighbour_land", "A neighbouring landowner"], ["private_road", "A private road owner"], ["shared_infra", "Shared infrastructure (STP, pumps, generator)"], ["association", "Association-run services"], ["developer", "The developer (before handover)"], ["pending_connection", "A utility connection still pending"], ["other", "Another third party"]],
    waterSources: Object.keys(E.WATER_SOURCES).map((k) => [k, E.WATER_SOURCES[k]]),
    drySeason: [["none", "None"], ["occasional", "Occasional"], ["frequent", "Frequent"], ["unknown", "Unknown"]],
    ynu: [["yes", "Yes"], ["no", "No"], ["unknown", "Unknown"]],
    tankerFreq: [["never", "Never"], ["occasional", "Occasional"], ["regular", "Regular"], ["unknown", "Unknown"]],
    borewellStatus: [["working", "All working"], ["some_failed", "Some failed / dry"], ["all_failed", "All failed / dry"], ["unknown", "Unknown"]],
    groundwater: [["stable", "Stable"], ["declining", "Declining"], ["unknown", "Unknown / no credible source"]],
    potable: [["direct", "Directly usable"], ["after_treatment", "Usable after treatment"], ["not_usable", "Not usable"], ["unknown", "Unknown"]],
    waterControl: [["utility", "Municipal utility"], ["association", "Owners' association"], ["developer", "Developer"], ["tanker_vendors", "Private tanker vendors"], ["neighbour", "Neighbour / shared borewell"], ["self", "Self-owned"]],
    rating: [["strong", "Strong"], ["adequate", "Adequate"], ["weak", "Weak"]],
    importance: [["high", "High"], ["medium", "Medium"], ["low", "Low"]],
    happy: [["yes", "Yes"], ["unsure", "Unsure"], ["no", "No"]],
    dilStatus: [["resolved", "Resolved"], ["open", "Open"], ["unknown", "Unknown"], ["problem", "Problem found"]],
    compound: [["rate", "Rate rise"], ["income", "Income interruption"], ["vacancy", "Vacancy"], ["delay", "Construction delay"], ["fall", "Price fall"], ["shock", "Liquidity shock"]],
  };

  /* ---------- Field schema (spec §8) ------------------------------- */
  // t: choice | select | money | num | pct | text | textarea | multi | toggle | custom
  const C = () => cur() || blankCase();
  const P = (c) => (c.decision || {}).purpose;
  const isUC = (c) => (c.decision || {}).status === "uc";
  const letting = (c) => ["rent", "mixed"].indexOf((c.decision || {}).occupancy) >= 0;
  const selfUse = (c) => ["self", "mixed"].indexOf((c.decision || {}).occupancy) >= 0;
  const loan = (c) => (c.financing || {}).mode === "loan";
  const homeish = (c) => P(c) === "home" || P(c) === "mixed";
  const finObjective = (c) => P(c) && P(c) !== "home";

  const STEPS = [
    { id: "frame", title: "Frame the decision", short: "Frame", groups: [
      { title: "What job is this property meant to do?", intro: "The same property needs different analysis depending on the job you expect it to perform.", fields: [
        { k: "decision.purpose", t: "choice", label: "Purpose", opts: O.purpose, req: true, wide: true },
        { k: "decision.status", t: "choice", label: "Property status", opts: O.status, req: true },
        { k: "decision.occupancy", t: "choice", label: "Occupancy intent", opts: O.occupancy, req: true },
        { k: "decision.holding_years", t: "num", label: "Expected holding period", unit: "years", req: true, help: "Core input: transaction friction is time-sensitive." },
        { k: "decision.move_risk", t: "choice", label: "Chance you'll need to move", opts: O.move },
      ], more: [{ k: "decision.move_note", t: "text", label: "Why might you move?", wide: true }] },
      { title: "Where is it?", intro: "Country gives the prior; the city modifies it.", fields: [
        { k: "market.country", t: "select", label: "Country", opts: O.country, req: true, onChange: (c) => { const cc = D.COUNTRIES[c.market.country]; if (cc && cc.currency) c.market.currency = cc.currency; } },
        { k: "market.currency", t: "select", label: "Currency", opts: O.currency, req: true, help: "All cash flows are stored in this currency." },
        { k: "market.city", t: "text", label: "City", req: true },
        { k: "market.micro_market", t: "text", label: "Micro-market", placeholder: "Neighbourhood, corridor or project cluster" },
        { t: "custom", render: renderFingerprintPreview, wide: true },
      ] },
      { title: "City context", intro: "What local economic machine supports this location? Mark only what you have evidence for: everything else stays unknown, and an unknown city layer is reported as insufficient data, never inferred.", fields: [
        { k: "market.city_stage", t: "choice", label: "Where is this location in its economic life?", opts: O.cityStage, wide: true, help: "Early does not mean good. Mature does not mean bad. Price matters." },
        { t: "custom", render: renderSignals, wide: true },
      ] },
    ] },
    { id: "property", title: "Property and price", short: "Property", groups: [
      { title: "The asset", fields: [
        { k: "property.purchase_price", t: "money", label: "Purchase price being evaluated", req: true },
        { k: "property.property_type", t: "select", label: "Property type", opts: O.ptype, req: true },
        { k: "property.expected_monthly_rent", t: "money", label: "Expected monthly rent", show: letting, req: letting, help: "What you expect a tenant to pay, before vacancy." },
        { k: "property.equivalent_market_rent", t: "money", label: "Rent for an equivalent home", show: selfUse, help: "What it would cost to rent this or a genuinely comparable home. Enables rent-v-own." },
      ], more: [
        { k: "property.area", t: "num", label: "Area", unit: "sq ft / m²" },
        { k: "property.area_basis", t: "select", label: "Area definition", opts: O.areaBasis, help: "Kept explicit: no carpet-to-saleable conversion is assumed." },
        { k: "property.age_years", t: "num", label: "Age of building", unit: "years" },
      ] },
      { title: "Costs", intro: "Optional but material. Leave blank if unknown: the report will label returns incomplete rather than guess a percentage.", fields: [
        { k: "property.acq.stamp", t: "money", label: "Stamp duty / transfer tax" },
        { k: "property.acq.registration", t: "money", label: "Registration" },
        { k: "property.acq.brokerage", t: "money", label: "Brokerage" },
        { k: "property.acq.legal", t: "money", label: "Legal / due diligence" },
        { k: "property.owner.maintenance", t: "money", label: "Maintenance / society charges", unit: "/ year" },
        { k: "property.owner.property_tax", t: "money", label: "Property tax", unit: "/ year" },
        { k: "property.owner.repairs", t: "money", label: "Repairs reserve", unit: "/ year" },
        { k: "property.exit_cost_pct", t: "pct", label: "Selling costs at exit", unit: "% of sale price" },
      ], more: [
        { k: "property.acq.other", t: "money", label: "Other acquisition costs" },
        { k: "property.owner.insurance", t: "money", label: "Insurance", unit: "/ year" },
        { k: "property.initial_work", t: "money", label: "Renovation / fit-out / furnishing" },
        { k: "property.mgmt_pct", t: "pct", label: "Management fee", unit: "% of rent collected", show: letting },
        { k: "property.letting_costs_annual", t: "money", label: "Tenant turnover / letting costs", unit: "/ year", show: letting, help: "Kept separate from vacancy so the Vacancy Tax doesn't swallow other costs." },
        { k: "property.exit_tax", t: "money", label: "Tax payable on sale (if you know it)" },
      ] },
      { title: "Price evidence", intro: "What is today's price actually based on? Transactions and listings are kept separate: one recent sale is evidence, not a valuation (the Last-Deal Fallacy).", fields: [
        { t: "custom", render: renderComps, wide: true },
        { k: "property.price_evidence_note", t: "textarea", label: "Why do you believe this price is supported?", wide: true },
        { k: "property.return_engine", t: "multi", label: "Which part of this property do you expect to create the return?", opts: O.engines, wide: true, help: "Every price forecast is a driver forecast in disguise. If you can't name one, that's useful information." },
      ] },
      { title: "Access and dependency", intro: "Ownership rights and functional control are not identical. A property can be legally yours and still depend on roads, neighbours or services you don't control. Record what you know: this is a diligence checklist, not a legal opinion.", fields: [
        { t: "custom", render: renderLegalAccess, wide: true },
        { k: "property.access.type", t: "choice", label: "How is the property reached?", opts: O.accessType, wide: true },
        { k: "property.access.last_mile", t: "choice", label: "Last-mile road quality", opts: O.lastMile },
        { k: "property.access.year_round", t: "choice", label: "Usable year-round?", opts: O.yearRound },
      ], more: [
        { k: "property.access.dependencies", t: "multi", label: "Day-to-day use depends on…", opts: O.accessDeps, wide: true },
        { k: "property.access.dependency_note", t: "text", label: "Notes on these dependencies", wide: true },
        { t: "custom", render: renderServices, wide: true },
      ] },
      { title: "Water security", intro: "Water is part of the asset and its infrastructure, not just a line in the maintenance bill. Low water cost today does not prove long-term water security.", fields: [
        { k: "property.water.sources", t: "multi", label: "Water sources", opts: O.waterSources, wide: true },
        { k: "property.water.primary", t: "select", label: "Primary source", opts: (c) => { const s = ((c.property.water || {}).sources || []); return (s.length ? s : Object.keys(E.WATER_SOURCES)).map((k) => [k, E.WATER_SOURCES[k]]); } },
        { k: "property.water.storage_days", t: "num", label: "Storage capacity", unit: "days of normal use" },
        { k: "property.water.dry_season", t: "choice", label: "Dry-season interruptions", opts: O.drySeason },
        { k: "property.water.tanker_freq", t: "choice", label: "Reliance on tankers", opts: O.tankerFreq },
        { k: "property.water.potable", t: "choice", label: "Is the water directly usable?", opts: O.potable },
        { k: "property.water.backup", t: "choice", label: "Backup if the primary source fails?", opts: O.ynu },
      ], more: [
        { k: "property.water.shortages", t: "choice", label: "History of shortages", opts: O.ynu },
        { k: "property.water.borewells", t: "num", label: "Number of borewells", show: (c) => ((c.property.water || {}).sources || []).indexOf("borewell") >= 0 },
        { k: "property.water.borewell_status", t: "choice", label: "Borewell status", opts: O.borewellStatus, show: (c) => ((c.property.water || {}).sources || []).indexOf("borewell") >= 0, help: "Deeper borewell does not automatically mean more secure water. Depth alone says nothing reliable about recharge or the groundwater trend." },
        { k: "property.water.groundwater", t: "choice", label: "Groundwater trend: only with credible information", opts: O.groundwater, wide: true, help: "The X-Ray does not infer groundwater security. Leave unknown unless you have a credible source." },
        { k: "property.water.groundwater_note", t: "text", label: "Source for that view" },
        { k: "property.water.contingency", t: "text", label: "What happens if the primary source fails?" },
        { k: "property.water.treatment", t: "text", label: "Treatment / filtration in place or needed" },
        { k: "property.water.quality_issues", t: "text", label: "Known quality issues (hardness, TDS…)" },
        { k: "property.water.controlled_by", t: "multi", label: "Who controls the supply?", opts: O.waterControl, wide: true },
        { k: "property.water.tanker_monthly", t: "money", label: "Tanker cost", unit: "/ month, average", help: "Added to owner costs." },
        { k: "property.water.treatment_annual", t: "money", label: "Treatment / filtration upkeep", unit: "/ year", help: "Added to owner costs." },
        { k: "property.water.pumping_annual", t: "money", label: "Pumping / water common-area cost", unit: "/ year", help: "Only if not already in maintenance. Added to owner costs." },
        { k: "property.water.maintenance_share", t: "money", label: "Water share of maintenance, if identifiable", unit: "/ year", help: "For information: already inside maintenance, not added again." },
      ] },
      { title: "Effective access", intro: "Distance is not access. Economic location is the property's actual relationship with the places your household needs to reach: measured in time, reliability and alternatives, not kilometres. Add only the destinations that matter to you.", fields: [
        { t: "custom", render: renderDestinations, wide: true },
      ] },
      { title: "Under construction", show: isUC, intro: "The less finished the asset, the more of the purchase belongs to underwriting rather than inspection.", fields: [
        { k: "diligence.months_to_possession", t: "num", label: "Months to promised possession", unit: "months", req: isUC },
        { k: "diligence.ready_comparable_price", t: "money", label: "Price of a genuinely comparable ready home", help: "Needed to measure the Uncertainty Discount / Certainty Tax." },
        { k: "diligence.developer", t: "text", label: "Developer" },
        { k: "diligence.project_stage", t: "choice", label: "Project stage", opts: O.projectStage, wide: true },
        { k: "diligence.registration_status", t: "choice", label: "Project registration (RERA or equivalent)", opts: O.regStatus, wide: true },
      ], more: [
        { k: "diligence.registration_id", t: "text", label: "Registration ID" },
        { k: "diligence.developer_evidence", t: "textarea", label: "Developer execution evidence", placeholder: "Past delivery, current project load, anything you've verified", wide: true },
        { t: "custom", render: renderSchedule, wide: true },
      ] },
      { title: "Legal and documentation status", intro: "Record what you know. The X-Ray records status; it does not certify title, approvals or a developer. Unknown is a valid answer, and it stays visible.", fields: [
        { t: "custom", render: renderDiligence, wide: true },
      ] },
    ] },
    { id: "financing", title: "Financing", short: "Financing", groups: [
      { title: "How is it funded?", intro: "Use the terms you have actually been offered; no generic mortgage rate is assumed.", fields: [
        { k: "financing.mode", t: "choice", label: "Funding", opts: O.fundMode, req: true, wide: true },
        { k: "financing.loan_amount", t: "money", label: "Loan amount", show: loan, req: loan, echo: loanEcho },
        { k: "financing.rate", t: "pct", label: "Interest rate", unit: "% a year", show: loan, req: loan },
        { k: "financing.rate_type", t: "choice", label: "Rate type", opts: O.rateType, show: loan },
        { k: "financing.tenure_years", t: "num", label: "Tenure", unit: "years", show: loan, req: loan },
        { k: "financing.loan_fees", t: "money", label: "Loan fees", show: loan, help: "Kept separate from the purchase price." },
        { t: "custom", show: (c) => loan(c) && isUC(c), render: () => '<p class="field-note wide">Under construction: interest-only (pre-EMI) is charged on disbursed amounts until possession; the full EMI starts at possession. Your own contribution is paid first, then the loan funds the remaining instalments.</p>', wide: true },
      ] },
    ] },
    { id: "household", title: "The household", short: "Household", groups: [
      { title: "Income and obligations", intro: "The asset is only half the decision. The buyer is the other half.", fields: [
        { k: "household.income", t: "money", label: "Household after-tax income", unit: "/ month", req: true, help: "Cash income after tax, not gross salary." },
        { k: "household.stability", t: "choice", label: "Income stability", opts: O.stability, req: true },
        { k: "household.existing_debt_service", t: "money", label: "Existing debt payments", unit: "/ month", req: true, help: "All other loan payments. Zero is fine." },
        { k: "household.living_expenses", t: "money", label: "Living expenses, excluding housing", unit: "/ month", help: "Recommended: without it, household surplus and income-interruption tests are incomplete." },
        { k: "household.current_housing_cost", t: "money", label: "Rent you pay today", unit: "/ month", help: "Stops when you move in; continues while you wait for an under-construction home." },
      ], more: [{ k: "household.stability_note", t: "text", label: "Notes on income stability", wide: true }] },
      { title: "Assets", fields: [
        { k: "household.liquid", t: "money", label: "Liquid assets", req: true, help: "Cash and readily accessible assets, including what you've set aside for this purchase." },
        { k: "household.financial", t: "money", label: "Long-term financial assets", req: true, help: "Investments, separate from cash." },
        { k: "household.funding_from_financial", t: "money", label: "Of the cash needed, how much comes from selling long-term investments?", echo: cashNeedEcho, wide: true },
        { k: "household.existing_re_value", t: "money", label: "Existing real estate (value)", req: true, help: "Zero is fine." },
        { k: "household.existing_re_debt", t: "money", label: "Loans against existing real estate", req: true, help: "Zero is fine." },
      ], more: [
        { k: "household.existing_primary_value", t: "money", label: "…of which your current home" },
        { k: "household.existing_re_same_city", t: "money", label: "…of which in this same city" },
        { k: "household.income_same_city", t: "toggle", label: "Our income depends materially on this city's economy" },
        { k: "household.retirement", t: "money", label: "Retirement-restricted assets" },
        { t: "custom", render: renderOutlays, wide: true },
      ] },
      { title: "Financial independence (optional)", intro: "Only if you want the purchase tested against an explicit FI plan. Otherwise FIRE impact is reported as not assessed.", fields: [
        { k: "household.fi_active", t: "toggle", label: "Test this purchase against my FI plan", wide: true },
        { k: "household.fi_target", t: "money", label: "Usable wealth your plan needs", show: (c) => c.household.fi_active },
        { k: "household.fi_target_with_home", t: "money", label: "…needed if you own this home", show: (c) => c.household.fi_active && selfUse(c), help: "Owning may lower the spending your plan must fund." },
        { k: "household.fi_return", t: "pct", label: "Return on usable assets", unit: "% a year", show: (c) => c.household.fi_active, help: "Your scenario, not a forecast." },
        { k: "household.fi_monthly_invest", t: "money", label: "Invested each month today", show: (c) => c.household.fi_active },
        { k: "household.fi_monetise", t: "toggle", label: "My plan will sell or downsize this property", show: (c) => c.household.fi_active, help: "Otherwise its equity counts toward net worth, not withdrawal capital.", wide: true },
      ] },
    ] },
    { id: "life", title: "Life objective and alternative", short: "Objective", groups: [
      { title: "The Zero-Appreciation Test", show: homeish, intro: "The test tells you why you are buying, not whether you should.", fields: [
        { k: "life.zat", t: "choice", label: "If this home never increased your purchasing power in real terms, would you still want to own it?", opts: O.zat, req: homeish, wide: true },
        { k: "life.zat_note", t: "textarea", label: "Why?", wide: true },
        { k: "life.utility", t: "multi", label: "What are you buying for your life?", opts: O.utility, wide: true, req: homeish },
      ] },
      { title: "The Enough-House", show: homeish, intro: "What is the least expensive home that would genuinely satisfy your household? The gap is the Housing-Consumption Premium; it may be worth paying, but it is paid with something.", fields: [
        { k: "life.enough_price", t: "money", label: "Price of a home that would be enough" },
        { k: "life.enough_rent", t: "money", label: "…or its monthly rent" },
      ] },
      { title: "How it compares on what matters to you", intro: "Rate only what you have a view on, and say how much each matters. These are ranked by your importance, never added up into a score, and never allowed to offset a fundamental gate such as title, access, water or financial survivability.", fields: [
        { t: "custom", render: renderCompare, wide: true },
      ] },
      { title: "Your realistic alternative", intro: "Compare against what you would actually do, not a theoretically perfect alternative. Equities are never assumed.", fields: [
        { k: "life.alt_type", t: "choice", label: "If you don't buy this, you would most likely…", opts: O.alt, req: true, wide: true },
        { k: "life.alt_rent", t: "money", label: "Rent you'd pay", unit: "/ month", show: (c) => c.life.alt_type === "rent", help: "Defaults to the equivalent rent you entered." },
        { k: "life.alt_invests", t: "choice", label: "Would you genuinely invest the money you didn't put into the home?", opts: O.yesno, show: (c) => ["rent", "invest", "wait"].indexOf(c.life.alt_type) >= 0, help: "If the real answer is 'rent and spend the difference', compare against that." },
        { k: "life.enough_price", t: "money", label: "Price of the cheaper home", show: (c) => c.life.alt_type === "cheaper" && !homeish(c) },
        { k: "life.alt_wait_months", t: "num", label: "How long would you wait?", unit: "months", show: (c) => c.life.alt_type === "wait" },
        { k: "life.alt_extra_down", t: "money", label: "Extra down payment", show: (c) => c.life.alt_type === "larger_down" },
        { k: "life.alt_custom", t: "textarea", label: "Describe the alternative", show: (c) => c.life.alt_type === "custom", wide: true },
        { k: "life.opp_rate", t: "pct", label: "Return you'd expect on capital kept elsewhere", unit: "% a year", help: "A scenario assumption for comparisons. Leave blank and no opportunity cost is computed." },
      ] },
    ] },
    { id: "redlines", title: "Your red lines", short: "Red lines", groups: [
      { title: "Decide your walk-away conditions now", intro: "Set these before you see the result: the best time to define a walk-away condition is before you fall in love with the house. Nothing here is pre-filled; no universal threshold is applied. Leave a line blank and it simply isn't tested.", fields: [
        { k: "constraints.min_liquid_mode", t: "choice", label: "Minimum liquidity to keep, as", opts: O.liqMode },
        { k: "constraints.min_liquid", t: (c) => (c.constraints.min_liquid_mode === "months" ? "num" : "money"), label: "Minimum liquidity after purchase", unit: (c) => (c.constraints.min_liquid_mode === "months" ? "months" : "") },
        { k: "constraints.max_outflow_mode", t: "choice", label: "Maximum monthly property outflow, as", opts: O.outMode },
        { k: "constraints.max_outflow", t: (c) => (c.constraints.max_outflow_mode === "pct" ? "pct" : "money"), label: "Maximum monthly property outflow", unit: (c) => (c.constraints.max_outflow_mode === "pct" ? "% of income" : "/ month"), help: "Loan payment plus owner costs, net of any rent received." },
        { k: "constraints.max_debt_service_pct", t: "pct", label: "Maximum total debt payments", unit: "% of income" },
        { k: "constraints.min_return", t: "pct", label: "Minimum return on your equity", unit: "% a year", show: finObjective, help: "If omitted, investment economics are described but never called adequate or inadequate." },
        { k: "constraints.min_net_yield", t: "pct", label: "Minimum net rental yield", unit: "%", show: letting },
        { k: "constraints.max_appr_dependency", t: "choice", label: "Maximum appreciation dependency", opts: O.apprMax, wide: true },
        { k: "constraints.max_delay_months", t: "num", label: "Maximum construction delay you'd tolerate", unit: "months", show: isUC },
        { k: "constraints.min_uc_gap", t: "money", label: "Minimum advantage over a ready home", show: isUC },
        { k: "constraints.max_fi_delay_years", t: "num", label: "Don't move my FI date later by more than", unit: "years", show: (c) => c.household.fi_active },
        { k: "constraints.legal_required", t: "multi", label: "Items that must be resolved before proceeding", opts: (c) => E.DILIGENCE.filter((x) => x.when === "all" || x.when === ((c.decision || {}).status || "ready")).map((x) => [x.id, x.label]), wide: true },
      ] },
    ] },
    { id: "scenarios", title: "Scenarios", short: "Scenarios", groups: [
      { title: "Scenarios, not forecasts", intro: "These test what you can survive, not what will happen. Values marked illustrative are editable placeholders, not expectations: replace them with your own view. Each one is listed in the report's provenance.", fields: [
        { k: "scenarios.base_appr", t: "pct", label: "Your base-case appreciation", unit: "% a year", scen: true },
        { k: "scenarios.upside_appr", t: "pct", label: "Your upside appreciation", unit: "% a year", scen: true },
        { k: "scenarios.inflation", t: "pct", label: "Inflation", unit: "% a year", scen: true, help: "Leave blank and real returns are not shown." },
        { k: "scenarios.rent_growth", t: "pct", label: "Rent growth", unit: "% a year", scen: true, help: "Blank = same as inflation." },
        { k: "scenarios.vacancy_base_months", t: "num", label: "Normal vacancy", unit: "months / year", scen: true, show: letting },
      ] },
      { title: "Location-thesis scenarios", intro: "If part of the case is that this location will grow, test three versions of that story. No probabilities: the point is how much of the decision depends on the first one, and whether you can live with the other two.", fields: [
        { t: "custom", render: (c) => '<p class="field-note"><b>A · Growth thesis works</b>: employment, infrastructure and demand deepen; absorption stays healthy. Uses your upside appreciation (' + (isBlank(c.scenarios.upside_appr) ? "not set" : c.scenarios.upside_appr + "% a year") + ').</p>', wide: true },
        { k: "scenarios.thesis_b_appr", t: "pct", label: "B · Area develops, but supply absorbs the upside", unit: "% a year", scen: true, help: "Infrastructure improves and the area becomes more useful, but competing supply keeps appreciation modest." },
        { k: "scenarios.thesis_c_appr", t: "pct", label: "C · Thesis disappoints", unit: "% a year", scen: true, help: "Jobs or infrastructure underwhelm, water/access constraints remain, prices correct. Rents also stop growing." },
        { k: "scenarios.thesis_c_exit_extra", t: "pct", label: "C · Extra cost of selling into a weak resale market", unit: "% of sale price", scen: true },
        { k: "life.thesis_b_happy", t: "choice", label: "Would you still be happy owning this property under Scenario B?", opts: O.happy, wide: true },
        { k: "life.thesis_c_survive", t: "choice", label: "Can your finances and life plans survive Scenario C?", opts: O.happy, wide: true },
        { k: "life.thesis_note", t: "textarea", label: "Why?", wide: true },
      ] },
      { title: "Stress tests", fields: [
        { k: "scenarios.flat_years", t: "num", label: "Flat market for", unit: "years", scen: true },
        { k: "scenarios.price_fall_pct", t: "pct", label: "Price fall", unit: "% of value", scen: true },
        { k: "scenarios.rate_rise_bps", t: "num", label: "Rate rise", unit: "basis points", scen: true, show: loan },
        { k: "scenarios.income_months", t: "num", label: "Income interruption", unit: "months", scen: true },
        { k: "scenarios.vacancy_months", t: "num", label: "Rental vacancy", unit: "months", scen: true, show: letting },
        { k: "scenarios.delay_a", t: "num", label: "Construction delay A", unit: "months", scen: true, show: isUC },
        { k: "scenarios.delay_b", t: "num", label: "Construction delay B", unit: "months", scen: true, show: isUC },
        { k: "scenarios.shock_amount", t: "money", label: "Liquidity shock: amount", scen: true },
        { k: "scenarios.shock_year", t: "num", label: "…in year", scen: true },
        { k: "scenarios.compound", t: "multi", label: "Combine into one compound stress (pick two or more)", opts: O.compound, wide: true, scen: true },
      ] },
    ] },
    { id: "review", title: "Review assumptions and evidence", short: "Review" },
    { id: "report", title: "The X-Ray", short: "X-Ray" },
  ];

  /* ---------- Echo helpers ----------------------------------------- */

  function ccy() { const c = cur(); return (c && c.market && c.market.currency) || "INR"; }
  const $m = (v) => E.money(v, ccy());

  function loanEcho(c) {
    const p = +c.property.purchase_price, l = +c.financing.loan_amount;
    if (!p || !l) return "";
    return "Loan is " + E.pct(l / p, 0) + " of the price; your down payment " + $m(p - l) + ".";
  }
  function cashNeedEcho(c) {
    try {
      const m = E.model(c), hh = E.household(m);
      if (!m.P) return "";
      return "Cash needed at purchase: " + $m(hh.cashNeed) + " (down payment, costs, fees, work)." + (hh.L1 !== null ? " Liquid after purchase: " + $m(hh.L1) + "." : "");
    } catch (e) { return ""; }
  }

  /* ---------- Field rendering -------------------------------------- */

  const resolve = (x, c) => (typeof x === "function" ? x(c) : x);
  const visible = (f, c) => (f.show ? !!f.show(c) : true);
  const required = (f, c) => !!resolve(f.req, c);

  function fieldHTML(f, c) {
    if (!visible(f, c)) return "";
    if (f.t === "custom") return '<div class="field' + (f.wide ? " wide" : "") + '">' + f.render(c) + "</div>";
    const t = resolve(f.t, c), v = get(c, f.k), id = "f-" + f.k.replace(/\./g, "-");
    const unit = resolve(f.unit, c);
    const req = required(f, c) ? '<span class="req" title="Needed for a complete X-Ray of this branch">Required</span>' : "";
    const illus = f.scen && !(c.scenarios._touched || {})[f.k.split(".")[1]] && !isBlank(v) ? '<span class="tag-illus">Illustrative</span>' : "";
    const lab = '<label class="field-label" for="' + id + '">' + esc(f.label) + req + illus + "</label>";
    let ctl = "";
    const opts = resolve(f.opts, c) || [];
    if (t === "choice") {
      ctl = '<div class="choices" role="group" aria-label="' + esc(f.label) + '">' + opts.map((o) =>
        '<button type="button" class="choice' + (o[2] ? " has-desc" : "") + (v === o[0] ? " is-on" : "") + '" data-k="' + f.k + '" data-v="' + esc(o[0]) + '" aria-pressed="' + (v === o[0]) + '"><span>' + esc(o[1]) + "</span>" + (o[2] ? '<small>' + esc(o[2]) + "</small>" : "") + "</button>").join("") + "</div>";
      return '<div class="field' + (f.wide ? " wide" : "") + '"><span class="field-label">' + esc(f.label) + req + illus + "</span>" + ctl + help(f) + "</div>";
    }
    if (t === "multi") {
      const arr = Array.isArray(v) ? v : [];
      ctl = '<div class="chips" role="group" aria-label="' + esc(f.label) + '">' + opts.map((o) =>
        '<button type="button" class="chip' + (arr.indexOf(o[0]) >= 0 ? " is-on" : "") + '" data-multi="' + f.k + '" data-v="' + esc(o[0]) + '" aria-pressed="' + (arr.indexOf(o[0]) >= 0) + '">' + esc(o[1]) + "</button>").join("") + "</div>";
      return '<div class="field' + (f.wide ? " wide" : "") + '"><span class="field-label">' + esc(f.label) + req + illus + "</span>" + ctl + help(f) + "</div>";
    }
    if (t === "toggle") {
      return '<div class="field' + (f.wide ? " wide" : "") + '"><label class="switch"><input type="checkbox" id="' + id + '" data-toggle="' + f.k + '"' + (v ? " checked" : "") + ' /><span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span><span class="switch-label">' + esc(f.label) + "</span></label>" + help(f) + "</div>";
    }
    if (t === "select") {
      ctl = '<select id="' + id + '" data-k="' + f.k + '" data-sel="1"><option value="">Choose…</option>' + opts.map((o) => '<option value="' + esc(o[0]) + '"' + (v === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>").join("") + "</select>";
    } else if (t === "textarea") {
      ctl = '<textarea id="' + id + '" data-k="' + f.k + '" rows="2" placeholder="' + esc(f.placeholder || "") + '">' + esc(v) + "</textarea>";
    } else {
      const inputmode = t === "text" ? "text" : "decimal";
      const shown = t === "money" && !isBlank(v) ? Number(v).toLocaleString(E.CCY[ccy()] ? E.CCY[ccy()].locale : "en-US") : esc(v === undefined || v === null ? "" : v);
      ctl = '<div class="input-wrap">' + (t === "money" ? '<span class="pre">' + esc((E.CCY[ccy()] || {}).sym || "") + "</span>" : "") +
        '<input id="' + id + '" type="text" inputmode="' + inputmode + '" autocomplete="off" data-k="' + f.k + '" data-type="' + t + '" value="' + shown + '" placeholder="' + esc(f.placeholder || (t === "money" ? (ccy() === "INR" ? "e.g. 3cr, 45L" : "e.g. 1.2m, 850k") : "")) + '" />' +
        (unit ? '<span class="post">' + esc(unit) + "</span>" : "") + "</div>";
    }
    const echo = '<div class="echo" data-echo="' + f.k + '">' + esc(echoText(f, c)) + "</div>";
    return '<div class="field' + (f.wide ? " wide" : "") + '">' + lab + ctl + echo + help(f) + "</div>";
  }
  const help = (f) => (f.help ? '<p class="help">' + esc(f.help) + "</p>" : "");
  function echoText(f, c) {
    const t = resolve(f.t, c), v = get(c, f.k);
    if (f.echo) return f.echo(c) || "";
    if (t === "money" && !isBlank(v)) return "= " + $m(+v);
    return "";
  }

  function groupHTML(g, c) {
    if (g.show && !g.show(c)) return "";
    const main = g.fields.map((f) => fieldHTML(f, c)).join("");
    const more = g.more && g.more.some((f) => visible(f, c))
      ? '<details class="more"' + (g.more.some((f) => f.k && !isBlank(get(c, f.k))) ? " open" : "") + '><summary>More detail (optional)</summary><div class="grid">' + g.more.map((f) => fieldHTML(f, c)).join("") + "</div></details>" : "";
    return '<section class="card group"><h3>' + esc(g.title) + "</h3>" + (g.intro ? '<p class="group-intro">' + esc(g.intro) + "</p>" : "") + '<div class="grid">' + main + "</div>" + more + "</section>";
  }

  /* ---------- Custom field renderers -------------------------------- */

  function renderFingerprintPreview(c) {
    const cc = D.COUNTRIES[c.market.country];
    if (!cc || !cc.fingerprint) return '<p class="field-note">No curated Housing System Fingerprint is bundled for this country. The Country layer will be shown as unavailable; the financial core still works.</p>';
    return '<div class="fp-mini"><span class="eyebrow-sm">Housing System Fingerprint · ' + esc(cc.name) + '</span><strong>' + esc(cc.fingerprint) + "</strong><p>" + esc(cc.meaning) + "</p></div>";
  }

  function renderSignals(c) {
    const sig = c.market.signals || {};
    return '<div class="signals">' + E.CITY_SIGNALS.map((s) => {
      const v = (sig[s.id] || {}).status || "unknown";
      return '<div class="signal"><span class="signal-name">' + esc(s.label) + '</span><div class="seg" role="group" aria-label="' + esc(s.label) + '">' +
        O.signal.map((o) => '<button type="button" class="seg-btn' + (v === o[0] ? " is-on" : "") + '" data-signal="' + s.id + '" data-v="' + o[0] + '" aria-pressed="' + (v === o[0]) + '">' + o[1] + "</button>").join("") +
        '</div><input type="text" class="signal-note" data-k="market.signals.' + s.id + '.note" value="' + esc((sig[s.id] || {}).note || "") + '" placeholder="Evidence / source (optional)" /></div>';
    }).join("") + "</div>";
  }

  function renderComps(c) {
    const rows = c.property.comps || [];
    const sel = (i, key, opts, v) => '<select data-row="property.comps" data-i="' + i + '" data-f="' + key + '">' + opts.map((o) => '<option value="' + o[0] + '"' + (v === o[0] ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select>";
    const inp = (i, key, v, ph, mode) => '<input type="text" inputmode="' + (mode || "decimal") + '" data-row="property.comps" data-i="' + i + '" data-f="' + key + '" value="' + esc(v === undefined ? "" : v) + '" placeholder="' + ph + '" />';
    return '<span class="field-label">Comparable evidence</span><p class="help">Add what you actually have. Area is optional; prices per area are shown only when every record has one.</p>' +
      '<div class="rows">' + rows.map((r, i) => '<div class="row comp-row">' +
        '<label>Price' + inp(i, "price", r.price !== undefined && r.price !== "" ? Number(r.price).toLocaleString((E.CCY[ccy()] || {}).locale) : "", "price") + "</label>" +
        '<label>Area' + inp(i, "area", r.area, "optional") + "</label>" +
        '<label>Month' + '<input type="month" data-row="property.comps" data-i="' + i + '" data-f="date" value="' + esc(r.date || "") + '" /></label>' +
        '<label>Source type' + sel(i, "type", O.compType, r.type || "transaction") + "</label>" +
        '<label>Similarity' + sel(i, "similarity", O.similarity, r.similarity || "medium") + "</label>" +
        '<label class="row-note">Note' + inp(i, "note", r.note, "optional", "text") + "</label>" +
        '<button type="button" class="row-del" data-del="property.comps" data-i="' + i + '" aria-label="Remove comparable">×</button></div>').join("") +
      '</div><button type="button" class="btn-ghost" data-add="property.comps">+ Add a comparable</button>';
  }

  function renderSchedule(c) {
    const rows = c.diligence.schedule || [];
    return '<span class="field-label">Payment schedule</span><p class="help">Month from booking and % of price. Payments at or after the promised possession month move with any delay. Leave empty to use an illustrative construction-linked plan (20% at booking, the rest evenly to possession): flagged in the report.</p><div class="rows">' +
      rows.map((r, i) => '<div class="row sched-row"><label>Month<input type="text" inputmode="numeric" data-row="diligence.schedule" data-i="' + i + '" data-f="month" value="' + esc(r.month) + '" /></label><label>% of price<input type="text" inputmode="decimal" data-row="diligence.schedule" data-i="' + i + '" data-f="pct" value="' + esc(r.pct) + '" /></label><button type="button" class="row-del" data-del="diligence.schedule" data-i="' + i + '" aria-label="Remove instalment">×</button></div>').join("") +
      '</div><button type="button" class="btn-ghost" data-add="diligence.schedule">+ Add an instalment</button>';
  }

  function renderOutlays(c) {
    const rows = c.household.outlays || [];
    return '<span class="field-label">Known future outlays</span><p class="help">Education, caregiving, a business, anything material and dated.</p><div class="rows">' +
      rows.map((r, i) => '<div class="row outlay-row"><label class="row-note">What<input type="text" data-row="household.outlays" data-i="' + i + '" data-f="label" value="' + esc(r.label) + '" /></label><label>Amount<input type="text" inputmode="decimal" data-row="household.outlays" data-i="' + i + '" data-f="amount" value="' + esc(r.amount !== undefined && r.amount !== "" ? Number(r.amount).toLocaleString((E.CCY[ccy()] || {}).locale) : "") + '" /></label><label>In year<input type="text" inputmode="numeric" data-row="household.outlays" data-i="' + i + '" data-f="year" value="' + esc(r.year) + '" /></label><button type="button" class="row-del" data-del="household.outlays" data-i="' + i + '" aria-label="Remove outlay">×</button></div>').join("") +
      '</div><button type="button" class="btn-ghost" data-add="household.outlays">+ Add an outlay</button>';
  }

  function renderLegalAccess(c) {
    const v = (c.diligence.items || {}).legal_access || "unknown";
    return '<span class="field-label">Legally documented road / right-of-way access</span><div class="seg" role="group" aria-label="Legal access">' +
      O.dilStatus.map((o) => '<button type="button" class="seg-btn' + (v === o[0] ? " is-on" : "") + '" data-dil="legal_access" data-v="' + o[0] + '" aria-pressed="' + (v === o[0]) + '">' + o[1] + "</button>").join("") +
      '</div><p class="help">A road that exists is not the same as a right to use it. Recorded, not certified.</p>';
  }

  function renderServices(c) {
    const sv = (c.property.access || {}).services || {};
    return '<span class="field-label">Who provides essential services?</span><p class="help">Water is covered in the next section. Services run by a developer, private vendor or neighbour are dependencies you don\'t control.</p><div class="svc-grid">' +
      E.SERVICES.map((x) => '<label class="svc"><span>' + esc(x.label) + '</span><select data-k="property.access.services.' + x.id + '" data-sel="1"><option value="">—</option>' +
        Object.keys(E.PROVIDERS).map((k) => '<option value="' + k + '"' + (sv[x.id] === k ? " selected" : "") + ">" + esc(E.PROVIDERS[k]) + "</option>").join("") + "</select></label>").join("") + "</div>";
  }

  function renderDestinations(c) {
    const rows = c.property.destinations || [];
    const sel = (i, f, opts, v) => '<select data-row="property.destinations" data-i="' + i + '" data-f="' + f + '"><option value="">—</option>' + opts.map((o) => '<option value="' + o[0] + '"' + (v === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>").join("") + "</select>";
    const inp = (i, f, v, ph, mode) => '<input type="text" inputmode="' + (mode || "decimal") + '" data-row="property.destinations" data-i="' + i + '" data-f="' + f + '" value="' + esc(v === undefined ? "" : v) + '" placeholder="' + ph + '" />';
    const kinds = Object.keys(E.DEST_KINDS).map((k) => [k, E.DEST_KINDS[k]]);
    return '<div class="rows">' + rows.map((r, i) => '<div class="row dest-row">' +
        "<label>Destination" + sel(i, "kind", kinds, r.kind) + "</label>" +
        '<label class="row-note">Name' + inp(i, "label", r.label, "optional", "text") + "</label>" +
        "<label>Km" + inp(i, "km", r.km, "km") + "</label>" +
        "<label>Normal min" + inp(i, "normal", r.normal, "min") + "</label>" +
        "<label>Peak min" + inp(i, "peak", r.peak, "min") + "</label>" +
        "<label>Last mile" + sel(i, "last_mile", O.lastMile, r.last_mile) + "</label>" +
        "<label>Other route?" + sel(i, "alt", O.ynu, r.alt) + "</label>" +
        '<button type="button" class="row-del" data-del="property.destinations" data-i="' + i + '" aria-label="Remove destination">×</button></div>').join("") +
      '</div><div class="chips">' + kinds.map((k) => '<button type="button" class="chip" data-add-dest="' + k[0] + '">+ ' + esc(k[1]) + "</button>").join("") + "</div>";
  }

  function renderCompare(c) {
    const cmp = c.life.compare || {};
    const seg = (d, f, opts, v) => '<div class="seg" role="group">' + opts.map((o) => '<button type="button" class="seg-btn' + (v === o[0] ? " is-on" : "") + '" data-cmp="' + d + '" data-f="' + f + '" data-v="' + o[0] + '" aria-pressed="' + (v === o[0]) + '">' + o[1] + "</button>").join("") + "</div>";
    return '<div class="cmp"><div class="cmp-row cmp-head"><span></span><span>How this home does</span><span>How much it matters</span></div>' + E.COMPARE_DIMS.map((d) => {
      const v = cmp[d.id] || {};
      return '<div class="cmp-row"><span class="cmp-label">' + esc(d.label) + "</span>" + seg(d.id, "rating", O.rating, v.rating) + seg(d.id, "importance", O.importance, v.importance) + "</div>";
    }).join("") + '</div><p class="help">Financial attractiveness isn\'t rated here: the X-Ray derives it from the economics, separately.</p>';
  }

  function renderDiligence(c) {
    const st = (c.decision || {}).status || "ready";
    const items = E.DILIGENCE.filter((x) => (x.when === "all" || x.when === st) && x.id !== "legal_access");
    const vals = c.diligence.items || {};
    return '<div class="dil">' + items.map((x) => {
      const v = vals[x.id] || "unknown";
      return '<div class="dil-row"><span class="dil-label">' + esc(x.label) + '</span><div class="seg" role="group" aria-label="' + esc(x.label) + '">' +
        O.dilStatus.map((o) => '<button type="button" class="seg-btn' + (v === o[0] ? " is-on" : "") + '" data-dil="' + x.id + '" data-v="' + o[0] + '" aria-pressed="' + (v === o[0]) + '">' + o[1] + "</button>").join("") + "</div></div>";
    }).join("") + "</div>";
  }

  /* ---------- Routing ---------------------------------------------- */

  function route() {
    const h = location.hash.replace(/^#\/?/, "");
    const [a, b] = h.split("/");
    if (a !== "shared" && a !== "explore") viewCase = null;
    if (a === "shared") return renderShared(h.slice("shared/".length));
    if (a === "explore") return renderExplore(b || "");
    if (a === "method") return renderMethod();
    if (a === "case" && cur()) return renderStep(b || "frame");
    return renderHome();
  }
  window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });

  /* ---------- Home ------------------------------------------------- */

  function renderHome() {
    const saved = Object.keys(state.cases).map((id) => ({ id, c: state.cases[id] })).sort((a, b) => (b.c.meta.updated || "").localeCompare(a.c.meta.updated || ""));
    app.innerHTML = '<section class="hero"><div class="wrap">' +
      '<p class="eyebrow">Real Estate Reframed · Flagship companion</p>' +
      "<h1>X-ray <em>this</em> property,<br />for <em>this</em> person, at <em>this</em> price.</h1>" +
      '<p class="lede">The question isn’t “is property a good investment?” It’s whether this property, at this price, financed this way, inside this housing system, makes sense for your household. The X-Ray doesn\'t answer with a score or a verdict. It shows what the purchase depends on, what you can survive, what you\'re trading, and what is still unresolved.</p>' +
      '<div class="start-grid">' +
      '<button type="button" class="start-card start-primary" data-act="new"><span class="start-k">Start</span><strong>X-ray a property</strong><span>About 10 minutes. Essentials first; detail when you want it.</span></button>' +
      '<button type="button" class="start-card" data-act="example" data-ex="A"><span class="start-k">Example · Household A</span><strong>The long-stay family</strong><span>₹3 Cr apartment, modest loan, 20-year stay, high utility.</span></button>' +
      '<button type="button" class="start-card" data-act="example" data-ex="B"><span class="start-k">Example · Household B</span><strong>The leveraged bet</strong><span>The same apartment, the same price: 80% loan, a 4-year hold, an appreciation thesis.</span></button>' +
      "</div>" +
      '<p class="hero-note">Same apartment. Same price. Open both examples: the property didn\'t change, but almost everything about the decision did.</p>' +
      "</div></section>" +
      '<main class="wrap">' +
      (saved.length ? '<section class="part"><div class="part-head"><span class="part-num">Your cases</span><h2>Pick up where you left off</h2><p class="part-sub">Stored only in this browser.</p></div><div class="saved">' +
        saved.map((s) => '<div class="saved-row"><a href="#/case/report" data-open="' + s.id + '"><strong>' + esc(s.c.meta.name || "Untitled case") + "</strong><span>" + esc([s.c.market.city, s.c.property.purchase_price ? E.money(+s.c.property.purchase_price, s.c.market.currency) : ""].filter(Boolean).join(" · ")) + '</span></a><button type="button" class="btn-ghost small" data-delcase="' + s.id + '">Delete</button></div>').join("") + "</div></section>" : "") +
      '<section class="part"><div class="part-head"><span class="part-num">The hierarchy</span><h2>Country → City → Property → Person</h2><p class="part-sub">Country gives the prior. City modifies it. Property determines the asset. Person determines whether the asset makes sense.</p></div>' +
      '<ol class="layers"><li><b>Country</b><span>What housing system am I buying inside?</span></li><li><b>City</b><span>What local economic machine supports this location?</span></li><li><b>Property</b><span>What exactly is this asset, and what is today\'s price based on?</span></li><li><b>Person</b><span>What does owning it do to this household?</span></li></ol></section>' +
      '<section class="part"><div class="part-head"><span class="part-num">Kept separate</span><h2>Seven things property tempts us to merge</h2><p class="part-sub">Most weak property analysis begins when two or more of these quietly become one story called “return”. The X-Ray never adds them up.</p></div>' +
      '<div class="seven">' + [["Asset return", "What the property earns: rent, costs and value change."], ["Leveraged equity return", "What financing does to your capital, and your margin for error."], ["Housing consumption", "How much house you're choosing to consume."], ["Non-financial utility", "Control, permanence, family, location."], ["Liquidity", "How accessible your capital remains."], ["Concentration", "How much of your balance sheet is one building in one city."], ["Legal / execution risk", "What has to go right before you truly own and can use it."]].map((x, i) => '<div class="seven-item"><span class="seven-n">' + (i + 1) + "</span><strong>" + x[0] + "</strong><span>" + x[1] + "</span></div>").join("") +
      "</div></section></main>";
  }

  /* ---------- Step shell ------------------------------------------- */

  function stepNav(active) {
    const c = cur();
    return '<nav class="stepper" aria-label="Steps">' + STEPS.map((s, i) => {
      const miss = s.groups ? missingFor(s, c).length : 0;
      return '<a href="#/case/' + s.id + '" class="step' + (s.id === active ? " is-active" : "") + (s.id === "report" ? " step-report" : "") + '"' + (s.id === active ? ' aria-current="step"' : "") + '><span class="step-i">' + (s.id === "report" ? "✦" : i + 1) + '</span><span class="step-t">' + esc(s.short) + "</span>" + (miss ? '<span class="step-miss" title="' + miss + ' required field(s) empty">' + miss + "</span>" : "") + "</a>";
    }).join("") + "</nav>";
  }

  function missingFor(step, c) {
    const out = [];
    (step.groups || []).forEach((g) => {
      if (g.show && !g.show(c)) return;
      g.fields.concat(g.more || []).forEach((f) => {
        if (!f.k || !visible(f, c) || !required(f, c)) return;
        if (isBlank(get(c, f.k))) out.push({ step: step.id, label: f.label, k: f.k });
      });
    });
    return out;
  }
  const allMissing = (c) => [].concat.apply([], STEPS.map((s) => missingFor(s, c)));

  function caseHeader() {
    const c = cur();
    return '<div class="case-head"><div class="case-name"><label for="case-name" class="sr">Case name</label><input id="case-name" data-k="meta.name" value="' + esc(c.meta.name || "") + '" /></div>' +
      '<div class="case-actions"><button type="button" class="btn-ghost small" data-act="newhh" title="Keep the country, city, property and scenarios; enter a different household">Same property, another household</button><a class="btn-ghost small" href="#/">All cases</a></div></div>';
  }

  function renderStep(id) {
    const c = cur();
    const i = STEPS.findIndex((s) => s.id === id);
    if (i < 0) return renderStep("frame");
    const step = STEPS[i];
    let body;
    if (id === "review") body = reviewHTML(c);
    else if (id === "report") body = reportHTML(c);
    else body = step.groups.map((g) => groupHTML(g, c)).join("");
    const prev = STEPS[i - 1], next = STEPS[i + 1];
    const navBtns = id === "report" ? "" : '<div class="step-foot">' + (prev ? '<a class="btn-ghost" href="#/case/' + prev.id + '">← ' + esc(prev.short) + "</a>" : "<span></span>") +
      (next ? '<a class="btn' + (next.id === "report" ? " btn-gold" : "") + '" href="#/case/' + next.id + '">' + (next.id === "report" ? "Run the X-Ray" : "Next: " + esc(next.short)) + " →</a>" : "") + "</div>";
    app.innerHTML = '<div class="wrap workspace">' + caseHeader() + '<div class="ws-grid">' + stepNav(id) +
      '<div class="ws-main" id="ws-main"><div class="step-head"><span class="part-num">' + (id === "report" ? "Decision profile" : "Step " + (i + 1) + " of " + (STEPS.length - 1)) + "</span><h2>" + esc(step.title) + "</h2></div>" + body + navBtns + "</div></div></div>";
    if (id === "report") { afterReport(c); if (reportTracked !== state.current && lastR && lastR.ready) { reportTracked = state.current; track("report-viewed"); } }
  }

  /* ---------- Review (spec §6: assumptions & evidence quality) ----- */

  function reviewHTML(c) {
    const miss = allMissing(c);
    const core = E.coreMissing(c);
    let R = null;
    if (!core.length) R = E.run(c);
    const prov = provenance(c, R);
    return '<section class="card"><h3>Before you run it</h3><p class="group-intro">Here is every number the X-Ray will use, and where it came from. Required fields left empty disable only the conclusions that depend on them.</p>' +
      (miss.length ? '<div class="missing"><strong>' + miss.length + " required field" + (miss.length > 1 ? "s" : "") + " empty</strong><ul>" + miss.map((m) => '<li><a href="#/case/' + m.step + '">' + esc(m.label) + "</a> <span>· " + esc(STEPS.find((s) => s.id === m.step).short) + "</span></li>").join("") + "</ul></div>" : '<p class="ok-line">All required fields for this branch are filled.</p>') +
      (core.length ? '<p class="warn-line">The X-Ray needs at least: ' + core.map((m) => '<a href="#/case/' + m.step + '">' + esc(m.label) + "</a>").join(", ") + ".</p>" : "") +
      (R && !R.completeness.complete ? '<p class="partial-line"><b>Partial X-Ray.</b> Withheld or incomplete: ' + esc(R.completeness.withheld.join("; ")) + ".</p>" : "") +
      "</section>" + provenanceTable(prov, true);
  }

  function provenance(c, R) {
    const rows = [];
    const tag = (src) => src;
    const add = (group, label, value, src, note) => rows.push({ group, label, value, src, note: note || "" });
    const $ = (v) => (isBlank(v) ? "—" : $m(+v));
    const pctv = (v) => (isBlank(v) ? "—" : v + "%");
    const u = (v) => (isBlank(v) ? "Not provided" : "Your input");
    const cc = D.COUNTRIES[c.market.country];
    add("Country", "Housing System Fingerprint", cc && cc.fingerprint ? cc.name + ": " + cc.fingerprint : "Unavailable", cc && cc.fingerprint ? "Curated framework" : "Not provided", cc && cc.fingerprint ? D.FINGERPRINT_SOURCE.source_name + " · " + D.FINGERPRINT_SOURCE.as_of_date : "");
    const sig = c.market.signals || {};
    const nSig = E.CITY_SIGNALS.filter((s) => (sig[s.id] || {}).status && sig[s.id].status !== "unknown").length;
    add("City", "City signals", nSig + " of " + E.CITY_SIGNALS.length + " marked", nSig ? "Your input" : "Not provided", "Your own observations; no external city data is used.");
    add("Property", "Purchase price", $(c.property.purchase_price), u(c.property.purchase_price));
    if (letting(c)) add("Property", "Expected rent", $(c.property.expected_monthly_rent), u(c.property.expected_monthly_rent));
    if (selfUse(c)) add("Property", "Equivalent market rent", $(c.property.equivalent_market_rent), u(c.property.equivalent_market_rent));
    const acq = ["stamp", "registration", "brokerage", "legal", "other"].reduce((s, k) => s + (+c.property.acq[k] || 0), 0);
    add("Property", "Acquisition costs", acq ? $(acq) : "—", ["stamp", "registration", "brokerage", "legal", "other"].some((k) => !isBlank(c.property.acq[k])) ? "Your input" : "Not provided", "No generic percentage is substituted.");
    const own = ["maintenance", "property_tax", "insurance", "repairs"].reduce((s, k) => s + (+c.property.owner[k] || 0), 0);
    add("Property", "Annual owner costs", own ? $(own) : "—", ["maintenance", "property_tax", "insurance", "repairs"].some((k) => !isBlank(c.property.owner[k])) ? "Your input" : "Not provided");
    add("Property", "Selling costs", pctv(c.property.exit_cost_pct), u(c.property.exit_cost_pct));
    add("Property", "Comparables", (c.property.comps || []).length + " record(s)", (c.property.comps || []).length ? "Your input" : "Not provided", "Each keeps its source type: transaction, listing, valuation, estimate or reference.");
    if (isUC(c)) {
      add("Under construction", "Payment schedule", (c.diligence.schedule || []).length ? (c.diligence.schedule.length + " instalments") : "Illustrative plan", (c.diligence.schedule || []).length ? "Your input" : "Illustrative default");
      add("Under construction", "Ready comparable price", $(c.diligence.ready_comparable_price), u(c.diligence.ready_comparable_price));
    }
    if (loan(c)) {
      add("Financing", "Loan", $(c.financing.loan_amount), u(c.financing.loan_amount));
      add("Financing", "Rate", pctv(c.financing.rate) + " " + (c.financing.rate_type || ""), u(c.financing.rate), "Your offered terms; no market rate assumed.");
      add("Financing", "Tenure", isBlank(c.financing.tenure_years) ? "—" : c.financing.tenure_years + " years", u(c.financing.tenure_years));
    }
    add("Household", "After-tax income", $(c.household.income), u(c.household.income));
    add("Household", "Living expenses", $(c.household.living_expenses), u(c.household.living_expenses));
    add("Household", "Liquid / financial assets", $(c.household.liquid) + " / " + $(c.household.financial), isBlank(c.household.liquid) ? "Not provided" : "Your input");
    const w = c.property.water || {}, ac = c.property.access || {};
    add("Property", "Legal access", (O.dilStatus.find((o) => o[0] === ((c.diligence.items || {}).legal_access || "unknown")) || [, "Unknown"])[1], (c.diligence.items || {}).legal_access && c.diligence.items.legal_access !== "unknown" ? "Your input" : "Not provided", "Recorded, not certified.");
    add("Property", "Physical access", [ac.type, ac.last_mile, ac.year_round].filter(Boolean).length ? [ac.type, ac.last_mile, ac.year_round].filter(Boolean).join(" · ") : "—", [ac.type, ac.last_mile, ac.year_round].some(Boolean) ? "Your input" : "Not provided");
    add("Property", "Water", (w.sources || []).length ? (w.sources || []).length + " source(s)" + (w.primary ? ", primary " + w.primary : "") : "—", (w.sources || []).length ? "Your input" : "Not provided", "No groundwater or reliability data is fetched or inferred.");
    const wc = (+w.tanker_monthly || 0) * 12 + (+w.treatment_annual || 0) + (+w.pumping_annual || 0);
    if (wc) add("Property", "Water costs added to owner costs", $m(wc) + " / year", "Your input");
    add("Property", "Effective access", (c.property.destinations || []).length + " destination(s)", (c.property.destinations || []).length ? "Your input" : "Not provided");
    add("Alternative", "Opportunity-cost rate", pctv(c.life.opp_rate), isBlank(c.life.opp_rate) ? "Not provided" : "Your scenario", "Never assumed to be equities.");
    const t = c.scenarios._touched || {};
    [["thesis_b_appr", "Scenario B appreciation", "%"], ["thesis_c_appr", "Scenario C appreciation", "%"], ["thesis_c_exit_extra", "Scenario C extra selling cost", "%"], ["base_appr", "Base-case appreciation", "%"], ["upside_appr", "Upside appreciation", "%"], ["inflation", "Inflation", "%"], ["rent_growth", "Rent growth", "%"], ["price_fall_pct", "Price-fall stress", "%"], ["rate_rise_bps", "Rate-rise stress", " bps"], ["income_months", "Income interruption", " months"]].forEach((x) => {
      const v = c.scenarios[x[0]];
      add("Scenarios", x[1], isBlank(v) ? (x[0] === "rent_growth" ? "= inflation" : "—") : v + x[2], isBlank(v) ? (x[0] === "rent_growth" ? "Model-derived" : "Not provided") : t[x[0]] ? "Your scenario" : "Illustrative default");
    });
    if (R) {
      add("Derived", "Valuation confidence rule", R.evidence.label, "Product heuristic", E.EVIDENCE_RULES.note);
      add("Derived", "Asset character rule", R.assetCharacter, "Product heuristic", "Appreciation > 70% of positive base-case gains = appreciation-led; < 40% = income-led.");
      add("Derived", "Fundamental gates", R.gates.map((g) => g.name + ": " + g.label).join(" · "), "Product heuristic", "Each gate has its own visible rule; gates are never combined.");
      add("Derived", "Peak-sensitive rule", "≥ 1.5× and ≥ 20 min extra", "Product heuristic", E.ACCESS_RULES.note);
      if (c.household.fi_active) add("Derived", "FIRE neutral band", "± " + E.FI_NEUTRAL_YEARS + " years", "Product heuristic", "A change in years-to-FI smaller than this is reported as neutral.");
    }
    return rows;
  }

  function provenanceTable(rows, open) {
    const cls = (s) => ({ "Your input": "src-user", "Your scenario": "src-user", "Illustrative default": "src-illus", "Not provided": "src-none", "Curated framework": "src-ext", "Product heuristic": "src-heur", "Model-derived": "src-model" }[s] || "");
    let html = '<section class="card"><h3>Assumptions and provenance</h3><div class="legend-row"><span class="src src-user">Your input</span><span class="src src-illus">Illustrative default</span><span class="src src-ext">Curated framework</span><span class="src src-heur">Product heuristic</span><span class="src src-none">Not provided</span></div><div class="table-scroll"><table class="grid prov"><thead><tr><th>Layer</th><th>Input</th><th>Value</th><th>Source</th><th>Note</th></tr></thead><tbody>';
    rows.forEach((r) => { html += "<tr><td>" + esc(r.group) + "</td><td>" + esc(r.label) + "</td><td>" + esc(r.value) + '</td><td><span class="src ' + cls(r.src) + '">' + esc(r.src) + "</span></td><td>" + esc(r.note) + "</td></tr>"; });
    return html + "</tbody></table></div></section>";
  }

  /* ---------- Report (spec §14) ------------------------------------ */

  let lastR = null;
  function reportHTML(c) {
    const core = E.coreMissing(c);
    if (core.length) return '<section class="card"><h3>Not enough to X-ray yet</h3><p class="group-intro">At minimum the X-Ray needs:</p><ul class="plain">' + core.map((m) => '<li><a href="#/case/' + m.step + '">' + esc(m.label) + "</a></li>").join("") + "</ul></section>";
    const R = E.run(c);
    lastR = R;
    const m = R.m;
    const $ = (v) => E.money(v, m.ccy);
    const cc = D.COUNTRIES[m.country] || D.COUNTRIES.OTHER;
    const purposeLabel = (O.purpose.find((x) => x[0] === m.purpose) || [, "—"])[1];
    let h = "";

    // Completeness + actions
    h += '<div class="report-bar"><span class="' + (R.completeness.complete ? "pill pill-ok" : "pill pill-partial") + '">' + (R.completeness.complete ? "Complete X-Ray" : "Partial X-Ray") + "</span>" +
      (R.completeness.complete ? "" : '<span class="report-bar-note">Withheld: ' + esc(R.completeness.withheld.join("; ")) + ' · <a href="#/case/review">review</a></span>') +
      '<span class="report-actions">' + (canShare ? '<button type="button" class="btn-ghost small" data-act="share">Copy share link</button>' : "") +
      (worksheetReady() ? '<button type="button" class="btn-ghost small" data-act="toworksheet">Open in the Worksheet</button>' : "") +
      '<button type="button" class="btn-ghost small" data-act="print">Print / save memo</button></span></div>' +
      '<div id="share-box" class="share-box" hidden></div>';

    // Decision statement
    h += '<section class="memo"><span class="eyebrow-sm">Decision statement</span><p class="memo-text">' + esc(R.statement) + '</p><p class="memo-foot">A profile, not a verdict. Nothing here adds up to a score: each dimension stands on its own.</p></section>';

    // Layer 1 — fundamental gates
    h += gatesHTML(R);

    // What you are buying
    h += '<section class="block"><h3 class="block-h">What you are buying</h3><ol class="layers layers-case">' +
      "<li><b>Country</b><span>" + esc(cc.fingerprint ? cc.name + ": " + cc.fingerprint : (m.country === "OTHER" ? "No curated fingerprint" : cc.name)) + "</span></li>" +
      "<li><b>City</b><span>" + esc([C().market.city, C().market.micro_market].filter(Boolean).join(" · ") || "—") + (R.city.stage ? " · " + esc((O.cityStage.find((x) => x[0] === R.city.stage) || [, ""])[1].toLowerCase()) : "") + "</span></li>" +
      "<li><b>Property</b><span>" + esc((O.ptype.find((x) => x[0] === C().property.property_type) || [, "Property"])[1]) + " · " + $(m.P) + " · " + (m.uc ? "under construction, possession in " + m.T0 + " months" : "ready") + "</span></li>" +
      "<li><b>Person</b><span>" + esc(purposeLabel) + " · " + esc((O.occupancy.find((x) => x[0] === m.occ) || [, ""])[1].toLowerCase()) + " · " + E.years(m.H) + " hold" + (m.financed ? " · loan " + E.pct(m.LTV, 0) + " of price" : " · no loan") + "</span></li></ol></section>";

    // Profile cards
    h += '<section class="block"><h3 class="block-h">Decision profile</h3><p class="block-sub">Separate dimensions, deliberately not combined. Each label is local to its card and traceable to the rule beneath it.</p><div class="profile">' + profileCards(R, c).join("") + "</div></section>";

    // Layer 2 — comparative profile
    h += compareHTML(R);

    // Hidden thesis
    h += hiddenThesis(R);

    // Works / struggles / trade-off
    h += '<section class="block"><div class="ws-cols"><div class="wcol works"><h3 class="block-h">The purchase works if…</h3>' + (R.works.length ? "<ul>" + R.works.map((x) => "<li>" + esc(x.text) + "</li>").join("") + "</ul>" : '<p class="muted">Not enough inputs to state conditions.</p>') + '</div><div class="wcol struggles"><h3 class="block-h">The purchase struggles if…</h3>' + (R.struggles.length ? "<ul>" + R.struggles.map((x) => "<li>" + esc(x.text) + "</li>").join("") + "</ul>" : '<p class="muted">No tested condition breaches your red lines or exposes a fragile thesis.</p>') + "</div></div>" +
      '<div class="tradeoff"><span class="eyebrow-sm">Key trade-off</span>' + (R.tradeoff.pair.length ? '<div class="tradeoff-pair"><span>' + esc(R.tradeoff.pair[0]) + '</span><span class="tradeoff-arrow" aria-hidden="true">⇄</span><span>' + esc(R.tradeoff.pair[1]) + "</span></div>" : "") + "<p>" + esc(R.tradeoff.text) + "</p></div></section>";

    // Stress tests
    h += stressHTML(R, c);

    // Economics detail
    h += economicsHTML(R, c);

    // Access, water and dependency
    h += accessHTML(R);

    // Household
    h += householdHTML(R);

    // Alternative
    h += alternativeHTML(R, c);

    // Market context detail
    h += marketHTML(R, c);

    // Open questions
    h += '<section class="block"><h3 class="block-h">Open questions and diligence</h3><ul class="oq">' + R.openQuestions.map((q) => '<li><span class="oq-kind">' + esc(q.kind) + "</span>" + esc(q.text) + "</li>").join("") + "</ul></section>";

    // Provenance
    h += provenanceTable(provenance(c, R));

    h += '<div class="report-end"><a class="btn-ghost" href="#/case/frame">Edit inputs</a><button type="button" class="btn-ghost" data-act="newhh">Same property, another household</button><button type="button" class="btn-ghost" data-act="print">Print / save memo</button>' +
      (worksheetReady() ? '<button type="button" class="btn-ghost" data-act="toworksheet">Open in the Worksheet</button>' : "") + "</div>" +
      (!worksheetReady() && toolLink("worksheet") && opensOn("worksheet") ? '<p class="chart-hint opens-note">The Property Decision Worksheet opens on ' + esc(opensOn("worksheet")) + ". This case will be able to travel there.</p>" : "");
    return h;
  }

  const chip = (label, kind) => '<span class="lbl' + (kind ? " lbl-" + kind : "") + '">' + esc(label) + "</span>";

  function profileCards(R, c) {
    const m = R.m, $ = (v) => E.money(v, m.ccy), cards = [];
    const card = (title, label, body, anchor, kind) => cards.push('<div class="pcard"><div class="pcard-top"><span class="pcard-t">' + esc(title) + "</span>" + (label ? chip(label, kind) : chip("Not labelled", "none")) + '</div><p>' + body + "</p>" + (anchor ? '<a class="pcard-more" href="#' + anchor + '" data-scroll="' + anchor + '">Show the numbers</a>' : "") + "</div>");
    const cc = D.COUNTRIES[m.country];
    card("Housing system", cc && cc.fingerprint ? "Context" : "Unavailable", cc && cc.fingerprint ? esc(cc.fingerprint) + ". Describes the machine; it does not grade it." : "No curated fingerprint for this country: shown as unavailable, not inferred.", "x-market");
    card("City context", R.city.insufficient ? "Insufficient data" : R.city.provided + " of " + R.city.total + " signals", R.city.insufficient ? "No local signals entered." : (R.city.tailwind.length ? "Tailwinds: " + esc(R.city.tailwind.join(", ").toLowerCase()) + ". " : "") + (R.city.headwind.length ? "Headwinds: " + esc(R.city.headwind.join(", ").toLowerCase()) + ". " : "") + (R.city.unknown.length ? "Unknown: " + R.city.unknown.length + "." : ""), "x-market", R.city.insufficient ? "none" : "");
    card("Price evidence", R.evidence.label, esc(R.evidence.reason) + (R.evidence.indicative && R.evidence.position ? " Your price is <b>" + R.evidence.position + "</b> the range of " + (R.evidence.basisIsTx ? "transactions" : "observations") + "." : ""), "x-price", R.evidence.label === "Insufficient" ? "none" : "");
    const gk = (l) => (l === "Potential disqualifier" ? "warn" : l === "Concern" ? "concern" : l === "Not assessed" ? "none" : "");
    const A = R.access;
    card("Access & dependency", A.gate.label, A.assessed ? "Reached by " + esc(E.ACCESS_TYPES[A.type] || "an unrecorded route") + "; last mile " + esc(A.lastMile || "not recorded") + "; " + ({ yes: "usable year-round", seasonal: "seasonal problems", no: "not usable year-round" }[A.yearRound] || "year-round use unknown") + ". Legal access: " + esc((O.dilStatus.find((o) => o[0] === A.legal) || [, "unknown"])[1].toLowerCase()) + "." : "Not recorded: ownership rights and functional control are not the same thing.", "x-access", gk(A.gate.label));
    card("Water security", R.water.gate.label, R.water.assessed ? esc(R.water.chain.map((x) => x.status).join(" → ")) + "." : "Not recorded: unknown, not assumed.", "x-access", gk(R.water.gate.label));
    const X = R.effective;
    card("Effective access", X.assessed ? X.rows.length + " destination" + (X.rows.length > 1 ? "s" : "") : "Not assessed", X.assessed ? (X.flagged.length ? esc(X.flagged.slice(0, 2).map((r) => r.label + ": " + r.flags.join(", ")).join("; ")) + "." : "No destination is peak-sensitive, single-route or behind a poor last mile.") : "Add the places your household needs to reach: distance alone isn't access.", "x-access", X.assessed ? "" : "none");
    const sh = R.apprShare;
    card("Asset economics", R.assetCharacter, sh === null ? "Not enough to decompose." : "In your base case, about " + E.pct(sh, 0) + " of the asset's positive economics comes from price appreciation and " + E.pct(1 - sh, 0) + " from " + (m.letting ? "net rent" : "the housing it provides (rent you don't pay)") + (R.rental ? ". Net yield " + E.pct(R.rental.netYield, 1) + "." : "."), "x-economics");
    const fd = R.apprDep.financial, hd = R.apprDep.home;
    if (fd) card(m.purpose === "mixed" ? "Appreciation dependency: financial" : "Appreciation dependency", fd.label, "Against " + esc(fd.objective) + ". " + esc(fd.reason), "x-thesis", fd.label === "High" ? "warn" : "");
    if (hd) card(m.purpose === "mixed" ? "Appreciation dependency: home" : "Appreciation dependency", hd.label, esc(hd.reason), "x-thesis", hd.label === "High" ? "warn" : "");
    card("Leverage sensitivity", R.leverage.label, esc(R.leverage.reason), "x-stress", R.leverage.label === "High" ? "warn" : R.leverage.label === "Not applicable" ? "none" : "");
    const hh = R.hh;
    card("Liquidity", hh.L1 === null ? null : m.reserve === null ? "No floor set" : (R.stress[0].breaches.some((t) => t.id === "min_liquid") ? "Base case: below your floor" : "Base case: within your floor"),
      hh.L1 === null ? "Liquid assets not entered." : "Liquid after purchase " + $(hh.L1) + (hh.before ? " (from " + $(hh.before.liquid) + ")" : "") + (m.reserve !== null ? "; your floor " + $(m.reserve) : "") + (hh.gapToFinancial ? ". The purchase itself needs " + $(hh.gapToFinancial) + " more than your liquid assets: taken from long-term investments" : "") + ".", "x-household", hh.L1 !== null && m.reserve !== null && R.stress[0].breaches.some((t) => t.id === "min_liquid") ? "warn" : "");
    card("Concentration", "Facts only", hh.before && hh.after ? "Real-estate equity moves from " + E.pct(hh.before.equityShare || 0, 0) + " to " + E.pct(hh.after.equityShare || 0, 0) + " of net worth; gross property exposure from " + E.pct(hh.before.grossShare, 0) + " to " + E.pct(hh.after.grossShare, 0) + " of assets." + (hh.after.re ? " " + E.pct(hh.reCity1 / hh.after.re, 0) + " of your property is in this city" + (m.incomeSameCity ? ", where your income also depends." : ".") : "") + " No universal threshold applied." : "Assets not entered.", "x-household", "none");
    card("Housing utility", R.utility.label, esc(R.utility.reason), "x-thesis", R.utility.label === "Not the job of this purchase" ? "none" : "");
    card("Execution", R.execution.label, esc(R.execution.reason), "x-open", R.execution.label === "Resolved" ? "" : "warn");
    card("FIRE impact", R.fire.status, esc(R.fire.reason), "x-household", R.fire.status === "Not assessed" ? "none" : R.fire.status === "Negative" ? "warn" : "");
    return cards;
  }

  function hiddenThesis(R) {
    const m = R.m, $ = (v) => E.money(v, m.ccy);
    const eng = m.engines.filter((e) => e !== "none").map((e) => E.ENGINES[e]);
    let s = '<section class="block" id="x-thesis"><h3 class="block-h">The hidden thesis</h3>';
    s += '<p class="thesis">' + (eng.length ? "You expect the return to come from <b>" + esc(eng.join(", ")) + "</b>. " : m.engines.indexOf("none") >= 0 ? "You haven't identified what creates the return: <b>that is itself useful information</b>. " : "You didn't name a return engine. ") +
      "In your base case (" + E.pct(m.base) + " a year), the asset's own return before financing is <b>" + E.pct(R.ledger.unlevIRR) + "</b>" + (m.selfUse && R.ledger.unlevIRRImp !== null ? " in cash terms, or " + E.pct(R.ledger.unlevIRRImp) + " counting the rent you no longer pay" : "") +
      "; the return on your own equity after financing is <b>" + E.pct(R.ledger.eqIRR) + "</b>" + (m.selfUse && R.ledger.eqIRRImp !== null ? " (" + E.pct(R.ledger.eqIRRImp) + " with rent saved)" : "") + ". These are kept separate on purpose.</p>";
    s += '<div class="chart-card card"><div class="chart-title">How much of the case depends on appreciation?</div><div class="chart-wrap"><svg id="dep-chart" viewBox="0 0 720 300" role="img" aria-label="Outcome against annual appreciation, with your scenarios marked"></svg></div><p class="chart-hint" id="dep-hint"></p></div>';
    s += '<div class="chart-card card"><div class="chart-title">What creates the return: base case, before and after financing</div><div class="chart-wrap"><svg id="wf-chart" viewBox="0 0 720 300" role="img" aria-label="Waterfall of the base-case return components"></svg></div><p class="chart-hint">Undiscounted totals over ' + E.years(m.H) + ". " + (m.selfUse ? "“Housing received” is the rent you would otherwise pay: shown, never counted as cash or as utility. " : "") + "Principal repaid is not shown: it is your own money moving into equity, not profit and not cost.</p></div>";
    s += thesisHTML(R);
    return s + "</section>";
  }

  const capFirst = (x) => x.charAt(0).toUpperCase() + x.slice(1);

  function gatesHTML(R) {
    const kind = (l) => (l === "Potential disqualifier" ? "warn" : l === "Concern" ? "concern" : l === "Not assessed" ? "none" : "");
    const empty = { title: "All title and approval checks are resolved.", access: "No access information recorded.", water: "No water information recorded: unknown, not assumed.", finance: "No cash-flow red line set, so survivability can't be tested against your own limits." };
    const link = { title: "x-open", access: "x-access", water: "x-access", finance: "x-stress" };
    return '<section class="block" id="x-gates"><h3 class="block-h">Fundamental gates</h3><p class="block-sub">Layer 1. Some things are not compensatory: no view, finish, community or projected return offsets a serious title problem, insecure access, insecure water or unsafe financing. Each gate is judged on its own visible rule, never averaged.</p><div class="gates">' +
      R.gates.map((g) => '<div class="gate gate-' + (kind(g.label) || "ok") + '"><div class="pcard-top"><span class="pcard-t">' + esc(g.name) + "</span>" + chip(g.label, kind(g.label)) + "</div>" +
        (g.reasons.length ? '<ul class="gate-reasons">' + g.reasons.map((r) => "<li>" + esc(capFirst(r)) + "</li>").join("") + "</ul>" : "<p>" + esc(g.label === "Acceptable" && g.id !== "title" ? "Nothing recorded triggers this gate's rule." : empty[g.id]) + "</p>") +
        (g.notes.length ? '<p class="gate-note">' + esc(capFirst(g.notes.join("; "))) + ".</p>" : "") +
        '<details class="gate-rule"><summary>Rule</summary><p>' + esc(g.rule) + '</p></details><a class="pcard-more" href="#' + link[g.id] + '" data-scroll="' + link[g.id] + '">Show the detail</a></div>').join("") + "</div></section>";
  }

  function compareHTML(R) {
    const C = R.comparative;
    const rl = { strong: "Strong", adequate: "Adequate", weak: "Weak" }, il = { high: "Matters a lot", medium: "Matters", low: "Matters a little" };
    let s = '<section class="block" id="x-compare"><h3 class="block-h">Comparative profile</h3><p class="block-sub">Layer 2: how this home does on what matters to you, ranked by the importance you gave each. Not added up, and never allowed to offset a fundamental gate.</p>';
    if (!C.assessed) s += '<p class="muted">Not rated: add your view in <a href="#/case/life">Objective</a>.</p>';
    else s += '<div class="cmp-out">' + C.rows.map((r) => '<div class="cmp-out-row"><span class="cmp-imp">' + esc(il[r.importance] || "Importance not set") + "</span><b>" + esc(r.label) + "</b>" + (r.rating ? chip(rl[r.rating], r.rating === "weak" ? "concern" : "") : chip("Not rated", "none")) + (r.evidence ? "<small>" + esc(r.evidence) + "</small>" : "") + "</div>").join("") + "</div>";
    s += '<p class="detail-p"><b>Financial attractiveness</b>: derived from the economics, not rated: ' + esc(C.financial.text) + ".</p>";
    return s + "</section>";
  }

  function thesisHTML(R) {
    const m = R.m, T = R.thesis, $ = (v) => E.money(v, m.ccy);
    const hurdle = m.k.minReturn !== null && m.purpose !== "home";
    const ans = (v) => (v === "yes" ? "Yes, you said." : v === "no" ? "No, you said." : v === "unsure" ? "You're unsure." : 'Not answered: <a href="#/case/scenarios">answer in Scenarios</a>.');
    let s = '<div class="card thesis-card" id="x-scenarios"><div class="chart-title">Location-thesis scenarios: no probabilities, just exposure</div><div class="table-scroll"><table class="grid"><thead><tr><th>Scenario</th><th>Appreciation</th><th>Value at sale</th><th>Equity at sale</th><th>Your cash back v paid in</th><th>Equity return</th>' + (hurdle ? "<th>Your " + m.k.minReturn + "% hurdle</th>" : "") + "</tr></thead><tbody>" +
      T.rows.map((r) => "<tr><td><b>" + r.id + " · " + esc(r.name) + "</b><br><small class=\"muted\">" + esc(r.desc) + "</small></td><td>" + E.pct(r.appr) + "/yr</td><td>" + $(r.V) + "</td><td>" + $(r.eqSale) + (r.externalToExit ? '<br><small class="warn-text">needs ' + $(r.externalToExit) + " of other cash to exit</small>" : "") + "</td><td>" + $(r.net) + "</td><td>" + E.pct(r.eqIRR) + "</td>" + (hurdle ? "<td>" + (r.hurdleMet ? "Met" : "Missed") + "</td>" : "") + "</tr>").join("") +
      '</tbody></table></div><div class="thesis-q"><p><b>Would you still be happy owning it under Scenario B?</b> ' + ans(T.bHappy) + "</p><p><b>Can your finances and life plans survive Scenario C?</b> " + ans(T.cSurvive) + "</p></div>" +
      '<p class="chart-hint">Values are your scenarios (B and C are illustrative until you edit them). "Cash back v paid in" counts every rupee in and out, undiscounted. The question is not which scenario is likely; it is how much of the decision only works in A.</p></div>';
    return s;
  }

  function accessHTML(R) {
    const m = R.m, A = R.access, W = R.water, X = R.effective;
    let s = '<section class="block" id="x-access"><h3 class="block-h">Access, water and dependency</h3><p class="block-sub">Ownership rights and functional control are not identical. A property can be legally yours and still depend on roads, neighbours, infrastructure and services you don\'t control.</p>';
    s += '<h4 class="sub-h">Legal and physical access</h4>';
    if (!A.assessed) s += '<p class="muted">Not recorded.</p>';
    else s += '<div class="table-scroll"><table class="grid kv"><tbody>' +
      kv("Legal road / right-of-way access", esc((O.dilStatus.find((o) => o[0] === A.legal) || [, "Unknown"])[1])) +
      kv("Route", esc(capFirst(E.ACCESS_TYPES[A.type] || "not recorded"))) + kv("Last-mile road", esc(capFirst(A.lastMile || "not recorded"))) +
      kv("Year-round use", esc(({ yes: "Yes", seasonal: "Seasonal problems", no: "No", unknown: "Unknown" })[A.yearRound] || "Not recorded")) +
      kv("Depends on", A.deps.length ? esc(capFirst(A.deps.map((d) => E.ACCESS_DEPS[d]).join(", "))) : "Nothing recorded") +
      A.services.map((x) => kv(esc(x.label), esc(E.PROVIDERS[x.provider]))).join("") +
      (A.note ? kv("Notes", esc(A.note)) : "") + "</tbody></table></div>";
    s += '<h4 class="sub-h">Water security</h4><p class="detail-p">Source → reliability → quality → cost → fallback → dependency.</p>';
    if (!W.assessed) s += '<p class="muted">Not recorded: water security is unknown, not assumed.</p>';
    else s += '<div class="wchain">' + W.chain.map((x) => '<div class="wstep"><span class="wstep-k">' + esc(x.step) + "</span><b>" + esc(x.status) + "</b>" + (x.text ? "<small>" + esc(x.text) + "</small>" : "") + "</div>").join("") + "</div>" + (W.borewellNote ? '<p class="chart-hint">' + esc(W.borewellNote) + "</p>" : "");
    s += '<p class="chart-hint">Low water cost today does not prove long-term water security. The X-Ray does not infer groundwater security from borewell depth or anything else; it records what you know.</p>';
    s += '<h4 class="sub-h">Effective access</h4><p class="detail-p">Economic location is the property\'s actual relationship with the places your household needs to reach: time, reliability and alternatives, not kilometres.</p>';
    if (!X.assessed) s += '<p class="muted">No destinations entered.</p>';
    else s += '<div class="table-scroll"><table class="grid"><thead><tr><th>Destination</th><th>Distance</th><th>Normal</th><th>Peak</th><th>Last mile</th><th>Other route</th><th>Watch</th></tr></thead><tbody>' +
      X.rows.map((r) => "<tr><td><b>" + esc(r.label) + '</b><br><small class="muted">' + esc(E.DEST_KINDS[r.kind] || "") + "</small></td><td>" + (r.km !== null ? r.km + " km" : "—") + "</td><td>" + (r.normal !== null ? r.normal + " min" : "—") + "</td><td>" + (r.peak !== null ? r.peak + " min" : "—") + "</td><td>" + esc(r.lastMile || "—") + "</td><td>" + esc(r.alt || "—") + "</td><td>" + esc(r.flags.join("; ") || "—") + "</td></tr>").join("") +
      "</tbody></table></div>";
    s += '<p class="chart-hint">' + esc(E.ACCESS_RULES.note) + "</p>";
    return s + "</section>";
  }

  function stressHTML(R, c) {
    const m = R.m;
    const stat = (r) => {
      if (r.status === "na") return chip("Not applicable", "none");
      if (r.status === "unset") return chip("No red line set", "none");
      if (r.status === "within-none") return chip("No red line affected", "none");
      if (r.status === "within") return chip("Within your red lines");
      return chip("Breaches: " + uniq(r.breaches.map((t) => t.label)).join(", "), "warn");
    };
    let s = '<section class="block" id="x-stress"><h3 class="block-h">Stress tests</h3><p class="block-sub">Risk capacity, not prediction: what happens to your household if each disappointment arrives. Shocks marked illustrative are editable examples, not expectations.</p>';
    s += '<div class="stress">' + '<div class="stress-row stress-head"><span>Scenario</span><span>Cash flow</span><span>Liquidity</span><span>Equity</span><span>Your red lines</span></div>' +
      R.stress.map((r) => '<div class="stress-row' + (r.status === "breach" ? " is-breach" : "") + '"><span class="st-name"><b>' + esc(r.name) + "</b><small>" + esc(r.desc) + (r.illustrative ? " · illustrative" : "") + '</small></span><span data-h="Cash flow">' + esc(r.cash) + '</span><span data-h="Liquidity">' + esc(r.liquidity) + '</span><span data-h="Equity">' + esc(r.equity) + '</span><span data-h="Red lines">' + stat(r) + (r.breaches.length ? '<small class="st-detail">' + esc(r.breaches.map((t) => t.detail).join("; ")) + "</small>" : "") + "</span></div>").join("") + "</div>";
    // compound builder + live scenario controls
    const avail = O.compound.filter((o) => R.stress.some((r) => r.id === o[0] || (o[0] === "delay" && r.id === "delay0") || (o[0] === "shock" && r.id === "shock")));
    const sel = c.scenarios.compound || [];
    s += '<div class="tune card"><div class="tune-head"><strong>Adjust the scenarios</strong><span class="muted">Changes re-run the X-Ray immediately and are saved to this case.</span></div>' +
      '<div class="controls">' + slider("base_appr", "Base-case appreciation", -5, 15, 0.5, "%") + slider("upside_appr", "Upside appreciation", -5, 20, 0.5, "%") +
      (m.financed && m.floating ? slider("rate_rise_bps", "Rate rise", 0, 500, 25, " bps") : "") + slider("income_months", "Income interruption", 0, 24, 1, " mo") +
      slider("price_fall_pct", "Price fall", 0, 50, 5, "%") + (m.letting ? slider("vacancy_months", "Vacancy", 0, 12, 1, " mo") : "") + (m.uc ? slider("delay_a", "Delay A", 0, 48, 3, " mo") + slider("delay_b", "Delay B", 0, 60, 3, " mo") : "") + "</div>" +
      '<div class="field wide"><span class="field-label">Combined stress: pick two or more</span><div class="chips">' + avail.map((o) => '<button type="button" class="chip' + (sel.indexOf(o[0]) >= 0 ? " is-on" : "") + '" data-multi="scenarios.compound" data-v="' + o[0] + '" data-live="1" aria-pressed="' + (sel.indexOf(o[0]) >= 0) + '">' + o[1] + "</button>").join("") + "</div></div></div>";
    return s + "</section>";
  }
  const uniq = (a) => a.filter((x, i) => a.indexOf(x) === i);

  function slider(key, label, min, max, step, unit) {
    const c = cur();
    let v = c.scenarios[key];
    if (isBlank(v)) v = SCEN_DEFAULTS[key] !== undefined && SCEN_DEFAULTS[key] !== "" ? SCEN_DEFAULTS[key] : min;
    const illus = !(c.scenarios._touched || {})[key];
    return '<div class="ctrl"><label for="s-' + key + '">' + esc(label) + (illus ? ' <span class="tag-illus">Illustrative</span>' : "") + ' <output id="o-' + key + '">' + v + unit + '</output></label><input type="range" id="s-' + key + '" data-slider="' + key + '" data-unit="' + esc(unit) + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + v + '" /></div>';
  }

  function economicsHTML(R, c) {
    const m = R.m, $ = (v) => E.money(v, m.ccy), L = R.ledger;
    let s = '<section class="block" id="x-economics"><h3 class="block-h">Economics detail</h3>';
    if (L.incomplete) s += '<p class="partial-line">Incomplete: ' + [!m.acqKnown ? "acquisition costs" : "", !m.ownerKnown ? "owner costs" : "", !m.exitKnown ? "selling costs" : ""].filter(Boolean).join(", ") + " not entered: figures below exclude them.</p>";
    // Return ledger
    s += '<details class="detail" open id="x-ledger"><summary>Return ledger: asset vs equity</summary><div class="table-scroll"><table class="grid kv"><tbody>' +
      kv("Price appreciation over the hold", E.pct(L.priceAppreciation, 0) + " (" + E.pct(m.base) + " a year, your base scenario)") +
      kv("Sale value / selling costs / net proceeds", $(L.saleValue) + " / " + $(L.exitCost) + " / " + $(L.netSale)) +
      kv("Unlevered return (property cash flows, before financing)", E.pct(L.unlevIRR) + (L.unlevReal !== null ? " nominal · " + E.pct(L.unlevReal) + " real" : "")) +
      (L.unlevIRRImp !== null ? kv("…counting rent you no longer pay", E.pct(L.unlevIRRImp)) : "") +
      kv("Equity return (your cash in and out, after financing)", E.pct(L.eqIRR) + (L.eqReal !== null ? " nominal · " + E.pct(L.eqReal) + " real" : "")) +
      (L.eqIRRImp !== null ? kv("…counting rent you no longer pay", E.pct(L.eqIRRImp)) : "") +
      (m.financed ? kv("Interest paid over the hold", $(L.interest)) + kv("Principal repaid (equity built, not profit, not cost)", $(L.principal)) + kv("Loan outstanding at sale", $(L.balanceEnd)) : "") +
      kv("Round-trip transaction friction", E.pct(R.roundTripFriction, 1) + " of price" + (isFinite(R.frictionYears) ? " · absorbed by appreciation in about " + E.years(R.frictionYears) : " · never absorbed at this appreciation")) +
      "</tbody></table></div></details>";
    // Rental P&L
    if (R.rental) {
      const r = R.rental;
      s += '<details class="detail" open id="x-rental"><summary>Rental P&amp;L: year one</summary><div class="table-scroll"><table class="grid kv"><tbody>' +
        kv("Scheduled rent", $(r.sched)) + kv("Vacancy loss (Vacancy Tax " + E.pct(r.vacancyTax, 1) + ")", "−" + $(r.vac)) + kv("Effective rental revenue", $(r.coll)) +
        kv("Owner costs", "−" + $(r.owner)) + (r.mgmt ? kv("Management", "−" + $(r.mgmt)) : "") + (r.letting ? kv("Turnover / letting (shown separately from vacancy)", "−" + $(r.letting)) : "") +
        kv("<b>Net operating income</b>", "<b>" + $(r.noi) + "</b>", true) + kv("Gross yield / net yield", E.pct(r.grossYield, 2) + " / " + E.pct(r.netYield, 2)) +
        (m.financed ? kv("Debt service (interest " + $(r.yr1Interest) + " + principal " + $(r.yr1Principal) + ")", "−" + $(r.ds)) : "") +
        kv("<b>After-debt cash flow</b>", "<b>" + $(r.afterDebt) + "</b>", true) + kv("Cash-on-cash (on " + $(r.cashEq) + " of cash equity)", E.pct(r.cashOnCash, 1)) +
        "</tbody></table></div><p class=\"chart-hint\">Rental revenue is not rental profit. Principal is equity accumulation, shown inside debt service only so cash flow is complete.</p></details>";
    }
    // Housing cost
    if (R.housing) {
      const hc = R.housing;
      s += '<details class="detail" open id="x-housing"><summary>True cost of housing</summary><div class="table-scroll"><table class="grid kv"><tbody>' +
        kv("Interest (average a year)", $(hc.interestAnnual)) + kv("Owner costs (average a year)", $(hc.ownerAnnual)) + kv("Transaction costs spread over the hold", $(hc.transactionAnnual)) +
        kv("<b>Cash cost of ownership a year</b> (principal excluded)", "<b>" + $(hc.annualCashCost) + "</b>", true) +
        (hc.oppAnnual !== null ? kv("Opportunity cost of " + $(hc.capitalCommitted) + " committed, at your " + E.pct(m.opp, 1) + " (scenario)", $(hc.oppAnnual) + " a year") : kv("Opportunity cost", "Not computed: no rate entered")) +
        (hc.rentAnnual !== null ? kv("Rent for the equivalent home, year one", $(hc.rentAnnual)) : kv("Equivalent rent", "Not entered: comparison withheld")) +
        "</tbody></table></div><p class=\"chart-hint\">Never compare rent with the full EMI: the principal part of the EMI builds your equity.</p></details>";
      if (R.rentVsOwn) {
        const rv = R.rentVsOwn, be = rv.breakEven;
        s += '<details class="detail" open><summary>Rent v own: dated cash flows over ' + E.years(m.H) + "</summary><p class=\"detail-p\">Owner: every cash flow above, ending with equity after sale. Renter: rents the equivalent home at " + $(rv.base.rent0) + "/mo (growing " + E.pct(m.rentGrowth, 1) + ") and puts the owner's capital " + (rv.base.invests ? "and monthly differences" : "(but not monthly differences: you said they'd be spent)") + " to work at " + (m.opp !== null ? E.pct(m.opp, 1) : "0% (no rate entered)") + '.</p><div class="table-scroll"><table class="grid"><thead><tr><th>Appreciation</th><th>Owner ends with</th><th>Renter ends with</th><th>Difference</th></tr></thead><tbody>' +
          [["Flat (0%)", rv.flat], ["Base (" + E.pct(m.base) + ")", rv.base], ["Upside (" + E.pct(m.upside) + ")", rv.upside]].map((x) => "<tr><td>" + x[0] + "</td><td>" + $(x[1].ownerWealth) + "</td><td>" + $(x[1].renterWealth) + "</td><td>" + $(x[1].ownerWealth - x[1].renterWealth) + "</td></tr>").join("") +
          "</tbody></table></div><p class=\"chart-hint\">" + (be ? (be.bound === null ? "Break-even appreciation: about " + E.pct(be.value) + " a year." : be.bound === "below" ? "Owning ends ahead even with falling prices." : "Owning doesn't catch up within +40% a year.") : "") + " This measures money only: it says nothing about the utility of owning, which you weigh yourself.</p></details>";
      }
    }
    // Mortgage schedule
    if (m.financed) {
      s += '<details class="detail"><summary>Mortgage schedule</summary><div class="table-scroll"><table class="grid"><thead><tr><th>Year</th><th>Payments</th><th>Interest</th><th>Principal</th><th>Balance</th></tr></thead><tbody>' + scheduleRows(m) + "</tbody></table></div>" + (m.uc ? '<p class="chart-hint">Years count from possession; pre-EMI interest during construction is in the ledger above.</p>' : "") + "</details>";
    }
    // Under construction
    if (R.uc) {
      s += '<details class="detail" open id="x-uc"><summary>Under-construction economics</summary>';
      const d0 = R.uc.delays[0];
      if (d0.cmp) {
        s += '<p class="detail-p">Sticker gap to the ready comparable: <b>' + $(d0.cmp.sticker) + "</b> (" + E.pct(d0.cmp.stickerPct, 1) + "). After waiting costs on the promised schedule, the observed <b>Uncertainty Discount</b> is <b>" + $(d0.cmp.advantage) + "</b>; equivalently, a Certainty Tax of that amount for buying ready. " +
          (R.uc.breakEven === 0 ? "Even on time, waiting costs exceed the sticker gap." : isFinite(R.uc.breakEven) ? "About <b>" + E.months(R.uc.breakEven) + "</b> of delay would consume it" + (m.k.maxDelay !== null ? " (your tolerance: " + m.k.maxDelay + " months)" : "") + "." : "No delay within ten years consumes it.") + "</p>";
        s += '<div class="chart-card card"><div class="chart-title">Uncertainty Discount remaining as possession slips</div><div class="chart-wrap"><svg id="uc-chart" viewBox="0 0 720 260" role="img" aria-label="Advantage of the under-construction route versus delay in months"></svg></div></div>';
      } else s += '<p class="detail-p">No ready comparable price entered: the Uncertainty Discount / Certainty Tax cannot be measured. Delay costs are still shown.</p>';
      s += '<div class="table-scroll"><table class="grid"><thead><tr><th>Delay</th><th>Housing while waiting</th><th>Lost rent</th><th>Extra interest</th><th>Opportunity cost</th><th>Total delay cost</th>' + (d0.cmp ? "<th>Discount left</th>" : "") + "</tr></thead><tbody>" +
        R.uc.delays.map((d) => "<tr><td>" + (d.D ? "+" + d.D + " months" : "On time") + "</td><td>" + $(d.cost.overlap) + "</td><td>" + $(d.cost.lostRent) + "</td><td>" + $(d.cost.financing) + "</td><td>" + (d.cost.opportunity === null ? "—" : $(d.cost.opportunity)) + "</td><td><b>" + $(d.cost.total) + "</b></td>" + (d.cmp ? "<td>" + $(d.cmp.advantage) + "</td>" : "") + "</tr>").join("") +
        '</tbody></table></div><p class="chart-hint">' + (R.uc.scheduleEntered ? "" : "Payment schedule not entered: illustrative 20% at booking, balance evenly to possession. ") + (R.uc.scheduleScaled ? "Your instalments didn't sum to 100% and were scaled. " : "") + "Owner charges assumed to begin at possession. Delay costs are gross: everything paid or forgone while you cannot use the home. The on-time comparison treats the ready loan as interest-only until possession and values costs at the promised date" + (m.opp !== null ? " using your " + E.pct(m.opp, 1) + " opportunity rate" : " with no opportunity cost (no rate entered)") + ".</p></details>";
    }
    return s + "</section>";
  }
  const kv = (k, v, strong) => '<tr' + (strong ? ' class="kv-strong"' : "") + "><td>" + k + "</td><td>" + v + "</td></tr>";

  function scheduleRows(m) {
    let B = m.L, out = "";
    const r = m.rate / 1200, yrs = Math.ceil(m.n / 12), show = Math.min(yrs, Math.max(Math.ceil(m.H) + 1, 5));
    for (let y = 1; y <= yrs; y++) {
      let pay = 0, int = 0, pr = 0;
      for (let k = 0; k < 12 && B > 1e-6; k++) { const i = B * r, p = Math.min(B, m.E - i); int += i; pr += p; pay += i + p; B -= p; }
      if (y <= show || y === yrs) out += "<tr" + (y === Math.ceil(m.H) ? ' class="hot-row"' : "") + "><td>" + y + "</td><td>" + E.money(pay, m.ccy) + "</td><td>" + E.money(int, m.ccy) + "</td><td>" + E.money(pr, m.ccy) + "</td><td>" + E.money(B, m.ccy) + "</td></tr>";
      else if (y === show + 1) out += '<tr><td colspan="5" class="muted">…</td></tr>';
    }
    return out;
  }

  function householdHTML(R) {
    const m = R.m, hh = R.hh, $ = (v) => E.money(v, m.ccy);
    let s = '<section class="block" id="x-household"><h3 class="block-h">Household balance sheet</h3>';
    if (!hh.before) return s + '<p class="muted">Liquid and financial assets not entered.</p></section>';
    s += '<div class="chart-card card"><div class="chart-title">Before and after purchase</div><div class="bs-legend"><span><i class="sw sw-liq"></i>Liquid</span><span><i class="sw sw-fin"></i>Financial</span><span><i class="sw sw-ret"></i>Retirement</span><span><i class="sw sw-prop"></i>Property equity</span></div><div id="bs-bars"></div></div>';
    s += '<div class="table-scroll"><table class="grid"><thead><tr><th></th><th>Before</th><th>After</th></tr></thead><tbody>' +
      [["Liquid assets", "liquid"], ["Long-term financial assets", "financial"], ["Retirement-restricted", "retirement"], ["Real estate (value)", "re"], ["Real-estate debt", "reDebt"], ["Net worth", "nw"]].map((x) => "<tr" + (x[1] === "nw" ? ' class="kv-strong"' : "") + "><td>" + x[0] + "</td><td>" + $(hh.before[x[1]]) + "</td><td>" + $(hh.after[x[1]]) + "</td></tr>").join("") +
      "<tr><td>Property equity, share of net worth</td><td>" + E.pct(hh.before.equityShare || 0, 0) + "</td><td>" + E.pct(hh.after.equityShare || 0, 0) + "</td></tr>" +
      "<tr><td>Monthly debt payments, share of income</td><td>" + (m.income ? E.pct(m.existingDS / m.income, 0) : "—") + "</td><td>" + E.pct(hh.dsPct, 0) + "</td></tr>" +
      "</tbody></table></div><p class=\"chart-hint\">Net worth falls on day one by acquisition costs, fees and fit-out (" + $(m.acq + m.fees + m.work) + "). Home equity counts toward net worth (it is not discarded for being illiquid) but it is not liquid.</p>";
    if (R.liqPath) s += '<div class="chart-card card"><div class="chart-title">Liquid assets through the hold: base case' + (R.liqPath.savingsKnown ? "" : " (excluding savings: living expenses not entered)") + '</div><div class="chart-wrap"><svg id="liq-chart" viewBox="0 0 720 240" role="img" aria-label="Liquid assets by year with your floor"></svg></div><p class="chart-hint">Includes known outlays; assumes no investment return on cash.</p></div>';
    if (R.fire.status !== "Not assessed") {
      const f = R.fire;
      s += '<details class="detail" open><summary>FIRE-usable wealth</summary><div class="table-scroll"><table class="grid"><thead><tr><th></th><th>Without this purchase</th><th>With it</th></tr></thead><tbody>' +
        "<tr><td>Usable wealth today</td><td>" + $(f.usable0) + "</td><td>" + $(f.usable1) + "</td></tr><tr><td>Invested each month</td><td>" + $(f.invest0) + "</td><td>" + $(f.invest1) + "</td></tr><tr><td>Target</td><td>" + $(f.target0) + "</td><td>" + $(f.target1) + "</td></tr><tr class=\"kv-strong\"><td>Years to target</td><td>" + E.years(f.y0) + "</td><td>" + E.years(f.y1) + "</td></tr></tbody></table></div><p class=\"chart-hint\">" + esc(f.reason) + "</p></details>";
    }
    return s + "</section>";
  }

  function alternativeHTML(R, c) {
    const m = R.m, $ = (v) => E.money(v, m.ccy);
    const label = (O.alt.find((x) => x[0] === m.alt) || [, "Not chosen"])[1];
    let s = '<section class="block" id="x-alt"><h3 class="block-h">Realistic alternative: ' + esc(label.toLowerCase()) + "</h3>";
    const hh = R.hh;
    if (!m.alt) return s + '<p class="muted">No alternative chosen: the X-Ray compares against what you would actually do, so choose one in <a href="#/case/life">Objective</a>.</p></section>';
    if (m.alt === "rent") {
      if (R.rentVsOwn) { const b = R.rentVsOwn.base; s += '<p class="detail-p">At your base appreciation, owning ends with <b>' + $(b.ownerWealth) + "</b>; renting the equivalent home ends with <b>" + $(b.renterWealth) + "</b>. Renting keeps " + $(hh.cashNeed) + " liquid today and leaves you free to move; owning buys control and permanence. Full comparison in Economics detail.</p>"; }
      else s += '<p class="muted">Needs an equivalent rent and self-occupation to compare.</p>';
    } else if (m.alt === "cheaper") {
      if (!m.enoughPrice) s += '<p class="muted">Enter the price of the cheaper home to compare.</p>';
      else {
        const alt = altCase(c, (x) => { const r = m.enoughPrice / m.P; x.property.purchase_price = m.enoughPrice; ["stamp", "registration", "brokerage", "legal", "other"].forEach((k) => { if (!isBlank(x.property.acq[k])) x.property.acq[k] = x.property.acq[k] * r; }); ["maintenance", "property_tax", "insurance", "repairs"].forEach((k) => { if (!isBlank(x.property.owner[k])) x.property.owner[k] = x.property.owner[k] * r; }); if (x.financing.mode === "loan") x.financing.loan_amount = Math.max(0, m.enoughPrice - (m.P - m.L)); });
        s += compareTable(R, alt, "This home", "Cheaper home (" + $(m.enoughPrice) + ", same down payment)") + '<p class="chart-hint">Housing-Consumption Premium: <b>' + $(m.P - m.enoughPrice) + "</b> of extra capital" + (m.enoughRent && m.Req ? ", or " + $(m.Req - m.enoughRent) + "/mo in rent terms" : "") + ". It may buy location, space or permanence worth having; this shows what it is paid with.</p>";
      }
    } else if (m.alt === "larger_down") {
      if (!m.altExtraDown || !m.financed) s += '<p class="muted">Enter the extra down payment (needs a loan) to compare.</p>';
      else { const alt = altCase(c, (x) => { x.financing.loan_amount = Math.max(0, m.L - m.altExtraDown); }); s += compareTable(R, alt, "As planned", "With " + $(m.altExtraDown) + " more down"); }
    } else if (m.alt === "ready") {
      s += R.uc ? '<p class="detail-p">See <a href="#x-uc" data-scroll="x-uc">Under-construction economics</a>: the sticker gap, the observed Uncertainty Discount under each delay, and the delay that consumes it.</p>' : '<p class="muted">This property is already ready; choose another alternative.</p>';
    } else if (m.alt === "wait") {
      const W = m.altWait || 12, Pw = m.P * Math.pow(1 + m.base, W / 12);
      const rent = (m.curRent || m.Req || 0) * W, o = m.opp || 0, earn = m.altInvests ? hh.cashNeed * (Math.pow(1 + o, W / 12) - 1) : 0;
      s += '<div class="table-scroll"><table class="grid kv"><tbody>' + kv("Price after " + W + " months at your base appreciation", $(Pw) + " (" + (Pw >= m.P ? "+" : "") + $(Pw - m.P) + ")") + kv("Rent paid while waiting", $(rent)) + kv("Return on " + $(hh.cashNeed) + " kept invested" + (m.opp === null ? " (no rate entered)" : ""), $(earn)) + kv("<b>Net cost of waiting</b>", "<b>" + $(Pw - m.P + (m.selfUse ? rent : 0) - earn - (m.letting && m.R ? 0 : 0)) + "</b>", true) + "</tbody></table></div><p class=\"chart-hint\">What waiting buys is not in the arithmetic: time to resolve " + (R.execution.open + R.execution.unk) + " open checks, better price evidence, and certainty about your own plans.</p>";
    } else if (m.alt === "invest") {
      const o = m.opp;
      if (o === null) s += '<p class="muted">Enter the return you would expect elsewhere (Objective step) to compare.</p>';
      else {
        const sim = R.sims.base; const mo = Math.pow(1 + o, 1 / 12) - 1; let pot = 0;
        for (let t = 0; t <= sim.months; t++) { if (t) pot *= 1 + mo; const f = sim.eq[t] - (t === sim.months ? sim.eqSale : 0); pot += -f; }
        s += '<div class="table-scroll"><table class="grid kv"><tbody>' + kv("Property: equity at sale (base case)", $(sim.eqSale)) + kv("Same cash flows invested at your " + E.pct(o, 1), $(pot)) + kv("Property equity return vs your alternative", E.pct(R.ledger.eqIRR) + " vs " + E.pct(o, 1)) + "</tbody></table></div><p class=\"chart-hint\">Every rupee you put into the property (down payment, costs, EMIs net of rent) is assumed invested instead, at your rate. A scenario, not a forecast; and only valid if you would genuinely invest it.</p>";
      }
    } else if (m.alt === "custom") {
      s += '<p class="detail-p">' + esc(c.life.alt_custom || "Described alternative not entered.") + '</p><p class="chart-hint">No calculation is run for a custom alternative; weigh it against the profile above.</p>';
    }
    return s + "</section>";
  }

  function altCase(c, mut) { const x = clone(c); mut(x); return E.run(x); }
  function compareTable(R, A, la, lb) {
    const $ = (v) => E.money(v, R.m.ccy);
    const row = (k, a, b) => "<tr><td>" + k + "</td><td>" + a + "</td><td>" + b + "</td></tr>";
    const rate = (X) => { const r = X.stress.find((x) => x.id === "rate"); return r && r.E2 ? $(r.E2) : "—"; };
    return '<div class="table-scroll"><table class="grid"><thead><tr><th></th><th>' + esc(la) + "</th><th>" + esc(lb) + "</th></tr></thead><tbody>" +
      row("Cash needed at purchase", $(R.hh.cashNeed), $(A.hh.cashNeed)) + row("Liquid after purchase", $(R.hh.L1), $(A.hh.L1)) +
      row("Monthly property outflow", $(R.hh.outflow), $(A.hh.outflow)) + (R.m.financed ? row("EMI after a rate rise", rate(R), rate(A)) + row("Interest over the hold", $(R.ledger.interest), $(A.ledger.interest)) : "") +
      row("Equity at sale: base case", $(R.sims.base.eqSale), $(A.sims.base.eqSale)) + row("Equity at sale: flat market", $(R.sims.flat.eqSale), $(A.sims.flat.eqSale)) +
      row("Red-line breaches across stresses", R.stress.filter((x) => x.status === "breach").length, A.stress.filter((x) => x.status === "breach").length) + "</tbody></table></div>";
  }

  function marketHTML(R, c) {
    const m = R.m, cc = D.COUNTRIES[m.country];
    let s = '<section class="block" id="x-market"><h3 class="block-h">Market context</h3>';
    if (cc && cc.fingerprint) {
      const rel = D.relevantDims(c);
      s += '<p class="detail-p"><b>' + esc(cc.name) + ": " + esc(cc.fingerprint) + ".</b> " + esc(cc.meaning) + "</p>";
      s += '<p class="fp-guard">The Fingerprint describes the machine. It does not grade the machine. Farther left or right is not better: it is simply different.</p>';
      const fpBase = toolLink("fingerprint") || "../fingerprint/";
      if (toolOpen("fingerprint")) s += '<p><a class="read-article" href="' + esc(fpBase + "#/country/" + m.country) + '">See the full fingerprint for ' + esc(cc.name) + ' <span aria-hidden="true">&rarr;</span></a></p>';
      else if (opensOn("fingerprint")) s += '<p class="chart-hint opens-note">The full Housing System Fingerprint Explorer opens on ' + esc(opensOn("fingerprint")) + ".</p>";
      s += '<div class="fp" id="fp-list">' + D.DIMS.map((d) => fpRow(d, m.country, rel.indexOf(d.n) >= 0)).join("") + "</div>";
      s += '<button type="button" class="btn-ghost small" data-act="fp-all">Show all ' + D.DIMS.length + ' dimensions</button>';
      s += '<p class="chart-hint">' + esc(D.FINGERPRINT_SOURCE.source_name) + " · " + esc(D.FINGERPRINT_SOURCE.as_of_date) + ". " + esc(D.FINGERPRINT_SOURCE.confidence_note) + " Only the dimensions that bear on this case are shown first.</p>";
    } else s += '<p class="muted">No curated Housing System Fingerprint for this country. The Country layer is unavailable; the property and household analysis is unaffected.</p>';
    s += '<h4 class="sub-h">City</h4>';
    if (R.city.insufficient) s += '<p class="muted">Insufficient data: no city signals entered, so nothing is inferred. National tailwinds do not automatically reach every micro-market.</p>';
    else {
      const sig = c.market.signals || {};
      s += '<div class="city-grid">' + E.CITY_SIGNALS.map((x) => { const v = (sig[x.id] || {}).status || "unknown"; return '<div class="city-sig city-' + v + '"><span>' + esc(x.label) + "</span><b>" + esc((O.signal.find((o) => o[0] === v) || [, ""])[1]) + "</b>" + ((sig[x.id] || {}).note ? "<small>" + esc(sig[x.id].note) + "</small>" : "") + "</div>"; }).join("") + "</div>";
    }
    s += '<h4 class="sub-h" id="x-price">Price evidence</h4>';
    const ev = R.evidence;
    if (!ev.comps.length) s += '<p class="muted">No comparables entered. Fair-value language is withheld.</p>';
    else {
      s += '<p class="detail-p">' + chip(ev.label) + " " + esc(ev.reason) + (ev.indicative ? " Indicative range from " + (ev.basisIsTx ? "transactions" : "all observations") + ": <b>" + E.money(ev.indicative.lo, m.ccy) + " – " + E.money(ev.indicative.hi, m.ccy) + "</b>" + (ev.useUnit ? " (by price per area, applied to your area)" : "") + ". Not a fair value." : "") + "</p>";
      s += '<div class="table-scroll"><table class="grid"><thead><tr><th>Source type</th><th>Price</th><th>' + (ev.useUnit ? "Per area" : "Area") + "</th><th>Month</th><th>Age</th><th>Similarity</th><th>Note</th></tr></thead><tbody>" +
        ev.comps.map((x) => "<tr><td>" + esc((O.compType.find((o) => o[0] === x.type) || [, x.type])[1]) + "</td><td>" + E.money(x.price, m.ccy) + "</td><td>" + (ev.useUnit ? E.money(x.unit, m.ccy, true) : esc(x.area || "—")) + "</td><td>" + esc(x.date || "—") + "</td><td>" + (x.age === null ? "—" : E.months(x.age)) + "</td><td>" + esc(x.similarity) + "</td><td>" + esc(x.note || "") + "</td></tr>").join("") +
        "<tr class=\"hot-row\"><td>This property</td><td>" + E.money(m.P, m.ccy) + "</td><td>" + (ev.useUnit ? E.money(ev.subject, m.ccy, true) : esc(m.area || "—")) + "</td><td colspan=\"4\"></td></tr></tbody></table></div><p class=\"chart-hint\">" + esc(E.EVIDENCE_RULES.note) + " Strong = ≥3 transactions within 12 months, ≥2 highly similar, spread ≤20%. Mixed = at least one transaction among two or more observations.</p>";
    }
    return s + "</section>";
  }

  function fpRow(d, country, relevant) {
    const p = d.pos[country];
    const flag = d.flag && d.flag[country];
    const note = d.note && d.note[country];
    return '<div class="fp-row' + (relevant ? "" : " fp-hidden") + '"><div class="fp-name"><span class="fp-n">' + d.n + "</span>" + esc(d.name) + '<small>' + esc(D.FAMILIES[d.fam]) + "</small></div>" +
      '<div class="fp-track-wrap"><span class="fp-end">' + esc(d.left) + '</span><div class="fp-track" role="img" aria-label="' + esc(d.name + ": " + D.BANDS[p]) + '">' + [0, 1, 2, 3, 4].map((i) => '<span class="fp-band' + (i === p ? " is-on" : "") + '"></span>').join("") + '</div><span class="fp-end fp-end-r">' + esc(d.right) + "</span></div>" +
      '<p class="fp-why">' + esc(D.BANDS[p]) + (flag ? " · confidence flag" : "") + ". " + esc(d.why) + (note ? " <b>" + esc(note) + "</b>" : "") + "</p></div>";
  }

  /* ---------- Charts (inline SVG) ---------------------------------- */

  const COL = { ink: "#eef0f4", soft: "#b7bcc8", mute: "#7f8696", line: "#2c313d", gold: "#e5b769", goldSoft: "#c9a24f", good: "#6fcf97", bad: "#e07a5f", cool: "#8fa9cc" };

  function afterReport(c) {
    if (!lastR || !lastR.ready) return;
    drawDependency(lastR);
    drawWaterfall(lastR);
    drawBalance(lastR);
    drawLiquidity(lastR);
    drawUC(lastR);
  }

  function niceTicks(lo, hi, n) {
    const span = hi - lo || 1, rough = span / (n || 4), mag = Math.pow(10, Math.floor(Math.log10(rough))), f = rough / mag;
    const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
    const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }

  function lineChart(svg, cfg) {
    const W = cfg.W || 720, H = cfg.H || 300, padL = 64, padR = 18, padT = 20, padB = 40;
    const xs = cfg.xs, ys = cfg.series.flatMap((s) => s.pts.map((p) => p[1])).concat(cfg.hlines ? cfg.hlines.map((h) => h.y) : []).filter((v) => v !== null && isFinite(v));
    let yLo = Math.min.apply(null, ys), yHi = Math.max.apply(null, ys);
    if (cfg.zero) { yLo = Math.min(yLo, 0); yHi = Math.max(yHi, 0); }
    const pad = (yHi - yLo) * 0.08 || 1; yLo -= pad; yHi += pad;
    const X = (v) => padL + ((v - xs[0]) / (xs[1] - xs[0])) * (W - padL - padR);
    const Y = (v) => padT + (1 - (v - yLo) / (yHi - yLo)) * (H - padT - padB);
    let s = "";
    niceTicks(yLo, yHi, 4).forEach((t) => { s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + Y(t) + '" y2="' + Y(t) + '" stroke="' + COL.line + '"/><text x="' + (padL - 8) + '" y="' + (Y(t) + 4) + '" fill="' + COL.mute + '" font-size="11" text-anchor="end">' + cfg.fy(t) + "</text>"; });
    niceTicks(xs[0], xs[1], 6).forEach((t) => { s += '<text x="' + X(t) + '" y="' + (H - padB + 18) + '" fill="' + COL.mute + '" font-size="11" text-anchor="middle">' + cfg.fx(t) + "</text>"; });
    if (cfg.xLabel) s += '<text x="' + (W - padR) + '" y="' + (H - 6) + '" fill="' + COL.mute + '" font-size="11" text-anchor="end">' + cfg.xLabel + "</text>";
    (cfg.hlines || []).forEach((h) => { s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + Y(h.y) + '" y2="' + Y(h.y) + '" stroke="' + h.color + '" stroke-dasharray="5 4" stroke-width="1.5"/><text x="' + (padL + 6) + '" y="' + (Y(h.y) - 6) + '" fill="' + h.color + '" font-size="11" text-anchor="start">' + h.label + "</text>"; });
    (cfg.vlines || []).forEach((v, i) => { if (v.x < xs[0] || v.x > xs[1]) return; s += '<line x1="' + X(v.x) + '" x2="' + X(v.x) + '" y1="' + padT + '" y2="' + (H - padB) + '" stroke="' + v.color + '" stroke-width="1" opacity="0.7"' + (v.dash ? ' stroke-dasharray="3 3"' : "") + '/><text x="' + (X(v.x) + 4) + '" y="' + (H - padB - 8 - (i % 2) * 13) + '" fill="' + v.color + '" font-size="10.5">' + v.label + "</text>"; });
    cfg.series.forEach((sr) => {
      const d = sr.pts.filter((p) => p[1] !== null && isFinite(p[1])).map((p, i) => (i ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1)).join(" ");
      s += '<path d="' + d + '" fill="none" stroke="' + sr.color + '" stroke-width="2.4" stroke-linejoin="round"' + (sr.step ? "" : "") + "/>";
    });
    (cfg.points || []).forEach((p) => { if (p.y === null || !isFinite(p.y)) return; s += '<circle cx="' + X(p.x) + '" cy="' + Y(p.y) + '" r="4.5" fill="' + p.color + '" stroke="#0e0f13" stroke-width="2"/>'; });
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = s;
  }

  function drawDependency(R) {
    const svg = document.getElementById("dep-chart"); if (!svg) return;
    const m = R.m, hint = document.getElementById("dep-hint");
    const fin = R.apprDep.financial && R.apprDep.financial.metric === "equity";
    const rvo = !fin && R.rentVsOwn;
    const lo = Math.min(-0.04, m.base - 0.04), hi = Math.max(0.12, m.upside + 0.03);
    const pts = [];
    for (let a = lo; a <= hi + 1e-9; a += (hi - lo) / 28) {
      if (fin || !rvo) { const s = E.simulate(m, { appr: a }); pts.push([a, s.eqIRR]); }
      else { const x = E.rentVsOwn(m, a); pts.push([a, x.ownerWealth - x.renterWealth]); }
    }
    const f = (a) => (fin || !rvo ? E.simulate(m, { appr: a }).eqIRR : (() => { const x = E.rentVsOwn(m, a); return x.ownerWealth - x.renterWealth; })());
    const target = fin ? R.apprDep.financial.target : 0;
    const vlines = [{ x: 0, label: "Flat", color: COL.mute }];
    if (m.infl !== null) vlines.push({ x: m.infl, label: "Zero real", color: COL.soft });
    vlines.push({ x: m.base, label: "Base", color: COL.gold }, { x: m.upside, label: "Upside", color: COL.goldSoft });
    const pointsList = [0, m.infl, m.base, m.upside].filter((x) => x !== null).map((x) => ({ x, y: f(x), color: x === m.base ? COL.gold : COL.soft }));
    const reqPt = fin ? R.apprDep.financial.required : rvo ? R.rentVsOwn.breakEven : null;
    if (reqPt && reqPt.bound === null && reqPt.value >= lo && reqPt.value <= hi) { vlines.push({ x: reqPt.value, label: "Needed ≈ " + E.pct(reqPt.value), color: COL.bad, dash: true }); pointsList.push({ x: reqPt.value, y: target, color: COL.bad }); }
    lineChart(svg, {
      xs: [lo, hi], series: [{ pts, color: COL.ink }], vlines, points: pointsList, zero: !fin,
      hlines: fin || !rvo ? [{ y: target, label: fin && R.apprDep.financial.hurdleGiven ? "Your hurdle " + E.pct(target, 0) : "Break-even", color: COL.bad }] : [{ y: 0, label: "Owning = renting", color: COL.bad }],
      fx: (v) => (v * 100).toFixed(0) + "%", fy: fin || !rvo ? (v) => (v * 100).toFixed(0) + "%" : (v) => E.money(v, m.ccy), xLabel: "appreciation a year →",
    });
    const req = fin ? R.apprDep.financial.required : rvo ? R.rentVsOwn.breakEven : null;
    hint.textContent = (fin || !rvo ? "Return on your equity after financing, at each annual appreciation rate. " : "How much wealthier owning leaves you than renting the equivalent home (your stated alternative), at each appreciation rate. ") +
      (req && req.bound === null ? "The line crosses " + (fin && R.apprDep.financial.hurdleGiven ? "your hurdle" : "break-even") + " at about " + E.pct(req.value) + " a year: that is the appreciation already spent to justify today's decision." : "");
  }

  function drawWaterfall(R) {
    const svg = document.getElementById("wf-chart"); if (!svg) return;
    const m = R.m, d = R.decomp;
    const steps = [];
    steps.push({ label: "Price change", v: d.capital, kind: d.capital >= 0 ? "pos" : "neg" });
    if (m.letting) steps.push({ label: "Net rent", v: d.rentNet, kind: "pos" });
    if (m.selfUse && d.imputed) steps.push({ label: "Housing received", v: d.imputed, kind: "imp" });
    steps.push({ label: "Owner costs", v: d.owner, kind: "neg" }, { label: "Transaction costs", v: d.friction, kind: "neg" });
    const assetTotal = steps.reduce((s, x) => s + x.v, 0);
    steps.push({ label: "Asset gain", v: assetTotal, kind: "total" });
    if (m.financed) { steps.push({ label: "Interest & fees", v: d.financing, kind: "neg" }); steps.push({ label: "Your gain", v: assetTotal + d.financing, kind: "total" }); }
    const W = 720, H = 300, padL = 64, padR = 12, padT = 18, padB = 46;
    let run = 0; const bars = steps.map((x) => { if (x.kind === "total") { const b = { ...x, a: 0, b: x.v }; run = x.v; return b; } const b = { ...x, a: run, b: run + x.v }; run += x.v; return b; });
    const vals = bars.flatMap((b) => [b.a, b.b]).concat([0]);
    let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals); const p = (hi - lo) * 0.08; lo -= p; hi += p;
    const Y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
    const bw = (W - padL - padR) / bars.length;
    let s = "";
    niceTicks(lo, hi, 4).forEach((t) => { s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + Y(t) + '" y2="' + Y(t) + '" stroke="' + COL.line + '"/><text x="' + (padL - 8) + '" y="' + (Y(t) + 4) + '" fill="' + COL.mute + '" font-size="11" text-anchor="end">' + E.money(t, m.ccy) + "</text>"; });
    s += '<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="' + COL.cool + '" stroke-width="3"/></pattern></defs>';
    bars.forEach((b, i) => {
      const x = padL + i * bw + bw * 0.16, w = bw * 0.68, y1 = Y(Math.max(b.a, b.b)), y2 = Y(Math.min(b.a, b.b));
      const fill = b.kind === "pos" ? COL.good : b.kind === "neg" ? COL.bad : b.kind === "imp" ? "url(#hatch)" : COL.gold;
      s += '<rect x="' + x + '" y="' + y1 + '" width="' + w + '" height="' + Math.max(1.5, y2 - y1) + '" rx="3" fill="' + fill + '" opacity="' + (b.kind === "total" ? 1 : 0.85) + '"' + (b.kind === "imp" ? ' stroke="' + COL.cool + '"' : "") + "/>";
      s += '<text x="' + (x + w / 2) + '" y="' + (y1 - 6) + '" fill="' + COL.soft + '" font-size="10.5" text-anchor="middle">' + E.money(b.v, m.ccy) + "</text>";
      s += '<text x="' + (x + w / 2) + '" y="' + (H - padB + 16) + '" fill="' + COL.mute + '" font-size="10.5" text-anchor="middle">' + b.label + "</text>";
    });
    s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="' + COL.mute + '"/>';
    svg.innerHTML = s;
  }

  function drawBalance(R) {
    const el = document.getElementById("bs-bars"); if (!el) return;
    const hh = R.hh, m = R.m;
    const parts = (s) => [["liq", s.liquid], ["fin", s.financial], ["ret", s.retirement], ["prop", Math.max(0, s.reEq)]];
    const max = Math.max(hh.before.nw, hh.after.nw, 1);
    const bar = (lab, s) => '<div class="bs-row"><span class="bs-lab">' + lab + '<small>' + E.money(s.nw, m.ccy) + ' net worth</small></span><div class="bs-track">' + parts(s).map((p) => p[1] > 0 ? '<span class="bs-seg sw-' + p[0] + '" style="width:' + ((p[1] / max) * 100).toFixed(2) + '%" title="' + E.money(p[1], m.ccy) + '"></span>' : "").join("") + "</div></div>";
    el.innerHTML = bar("Before", hh.before) + bar("After", hh.after);
  }

  function drawLiquidity(R) {
    const svg = document.getElementById("liq-chart"); if (!svg || !R.liqPath) return;
    const m = R.m;
    const pts = R.liqPath.pts.map((p) => [p.y, p.L]);
    lineChart(svg, { W: 720, H: 240, xs: [0, Math.max(1, pts[pts.length - 1][0])], series: [{ pts, color: COL.ink }], zero: true,
      hlines: m.reserve !== null ? [{ y: m.reserve, label: "Your floor " + E.money(m.reserve, m.ccy), color: COL.bad }] : [],
      points: m.outlays.map((o) => { const p = R.liqPath.pts.find((q) => q.y === Math.round(o.year)); return p ? { x: p.y, y: p.L, color: COL.gold } : null; }).filter(Boolean),
      fx: (v) => "Y" + Math.round(v), fy: (v) => E.money(v, m.ccy), xLabel: "year →" });
  }

  function drawUC(R) {
    const svg = document.getElementById("uc-chart"); if (!svg || !R.uc) return;
    const m = R.m, maxD = Math.max(36, (isFinite(R.uc.breakEven) ? R.uc.breakEven : 0) + 12, m.k.maxDelay || 0);
    const pts = []; for (let d = 0; d <= maxD; d += Math.max(1, Math.round(maxD / 30))) pts.push([d, E.ucCompare(m, d).advantage]);
    const v = [];
    if (m.k.maxDelay !== null) v.push({ x: m.k.maxDelay, label: "Your tolerance", color: COL.gold });
    if (isFinite(R.uc.breakEven) && R.uc.breakEven > 0) v.push({ x: R.uc.breakEven, label: "Advantage gone", color: COL.bad });
    lineChart(svg, { W: 720, H: 260, xs: [0, maxD], series: [{ pts, color: COL.ink }], zero: true, hlines: [{ y: 0, label: "Ready = under construction", color: COL.mute }], vlines: v, fx: (x) => "+" + Math.round(x) + "m", fy: (y) => E.money(y, m.ccy), xLabel: "delay to possession →" });
  }

  /* ---------- Method page ------------------------------------------ */

  function renderMethod() {
    app.innerHTML = '<section class="hero hero-sm"><div class="wrap"><p class="eyebrow">The honest math</p><h1>How the X-Ray works</h1><p class="lede">Nothing here is a black box. Every figure is deterministic arithmetic on the inputs you supply and the scenarios you set, and every qualitative label is local to one dimension, with its rule visible.</p></div></section>' +
      '<main class="wrap"><section class="part"><div class="method-grid">' +
      mcard("What it will never do", "<ul class=\"method-list\"><li>Produce an overall score, rating or BUY / DON'T BUY verdict.</li><li>Convert utility, family stability or permanence into money.</li><li>Let title or project uncertainty be offset by expected appreciation.</li><li>Apply a universal EMI, LTV, yield or concentration threshold: only the red lines you set.</li><li>Assume equities are your alternative.</li><li>Fill a missing fact with a generic market assumption.</li></ul>") +
      mcard("Asset return vs equity return", "<p>The <b>unlevered return</b> is the IRR of the property's own cash flows: price, acquisition costs, fit-out, owner costs, rent (net of vacancy and letting costs) and net sale proceeds. The <b>equity return</b> is the IRR of your cash: down payment, costs, loan fees, every loan payment, owner costs, rent, and sale proceeds after repaying the loan.</p><div class=\"formula\">price CAGR = (exit ÷ price)^(1/years) − 1\nreal ≈ (1 + nominal) ÷ (1 + inflation) − 1\nEMI = L·r ÷ (1 − (1 + r)^−n)</div><p>Principal repaid is shown as equity built, never as profit and never as housing cost.</p>") +
      mcard("Housing cost and rent v own", "<p>Cash cost of ownership = interest + owner costs + transaction costs spread over the hold. Principal is excluded. Opportunity cost is computed only from the rate you enter.</p><p>Rent v own compares dated cash flows: the owner's, ending in equity after sale, against a renter who invests the owner's capital, and the monthly differences only if you say you genuinely would.</p>") +
      mcard("Appreciation dependency", "<p>For financial objectives, the X-Ray solves for the annual appreciation at which your equity return meets your hurdle (or nominal break-even if you set none). <b>Low</b> = met at 0%; <b>Moderate</b> = met within your base case; <b>High</b> = met only in your upside, or not at all.</p><p>For a primary home it uses your Zero-Appreciation answer and whether a flat market breaches your red lines; a home is never required to hit an investment hurdle.</p>") +
      mcard("Stress engine", "<p>Each shock is applied to your post-purchase position: liquid assets after purchase, the net monthly property outflow, and your household surplus (income − living expenses − other debts − property outflow). Income interruption burns liquid assets at your full monthly outgoings; a rate rise recomputes the EMI on the year-two balance (the tenure-extension alternative is shown too). A price fall changes equity, not cash: no margin call is assumed.</p><p>Leverage sensitivity: <b>High</b> if the base case, a rate rise or an income interruption breaches a cash-flow red line; <b>Moderate</b> if only the combined stress does; <b>Low</b> otherwise.</p>") +
      mcard("Under construction", "<p>Instalments are paid on your schedule: your own contribution first, then loan disbursements with pre-EMI interest until possession. Delay cost = housing while waiting + lost rent + extra interest + opportunity cost (if a rate is entered), each shown.</p><p>The Uncertainty Discount compares the two routes to a usable home on the promised date: your own capital at its payment dates (with your opportunity-cost rate, if entered), loan interest, owner costs, rent paid or earned, and principal still owed: valued at possession. Each delay scenario then erodes it by the gross delay cost: everything you pay or forgo while you cannot yet use the home. The delay at which it reaches zero is reported.</p>") +
      mcard("Product heuristics (visible, not truths)", "<ul class=\"method-list\"><li>Price evidence: Strong = ≥3 transactions in 12 months, ≥2 highly similar, spread ≤20%. Mixed = ≥1 transaction among ≥2 observations. Weak = listings/estimates only or one record.</li><li>Asset character: appreciation &gt;70% of positive base-case gains = appreciation-led; &lt;40% = income-led.</li><li>FIRE impact: a change of under ±" + E.FI_NEUTRAL_YEARS + " years to your FI target is neutral.</li><li>Execution: resolved / partially resolved / unresolved / unknown from your checklist, never a risk score.</li></ul>") +
      mcard("Fundamental gates and the comparative profile", "<p>Some factors are not compensatory. Excellent interiors, community or financial value cannot mathematically offset a serious title problem, insecure access, unsafe financing or severe water insecurity. So the X-Ray uses two layers:</p><ul class=\"method-list\"><li><b>Layer 1, fundamental gates:</b> title &amp; approvals, legal &amp; physical access, water &amp; basic infrastructure, financial survivability. Each resolves as Acceptable, Concern or Potential disqualifier on its own visible rule (or Not assessed). Gates are never averaged.</li><li><b>Layer 2: comparative profile:</b> home quality, floor/view, mobility, healthcare, daily conveniences, social access, lifestyle utility; ranked by the importance you give them, never summed. Financial attractiveness is derived from the economics, not rated.</li></ul>") +
      mcard("Access, water and effective access", "<p><b>Access:</b> ownership rights and functional control are not identical. The X-Ray records legal access, route type, last-mile quality, year-round use and dependencies on third parties. It is a diligence layer, not legal advice.</p><p><b>Water:</b> summarised as source → reliability → quality → cost → fallback → dependency. Tanker, treatment and pumping costs are added to owner costs. Low water cost today does not prove long-term water security, and a deeper borewell does not automatically mean more secure water; groundwater security is never inferred.</p><p><b>Effective access:</b> travel time at normal and peak hours, last mile and alternate routes for the destinations you choose. " + esc(E.ACCESS_RULES.note) + "</p><p><b>Location-thesis scenarios:</b> A uses your upside appreciation; B (area develops, supply absorbs the upside) and C (thesis disappoints: prices correct, rents stop growing, selling costs more) use your own rates. No probabilities.</p>") +
      mcard("What it does not model", "<ul class=\"method-list\"><li>Income tax on rent or capital gains (unless you enter a sale tax).</li><li>Loan prepayments, refinancing, or a rate path beyond the tested rise.</li><li>Investment return on cash held as liquid assets.</li><li>Exchange rates: every case is in one currency.</li><li>Any price forecast. Your scenarios are yours.</li></ul><p class=\"method-note\">Country context comes from the Real Estate Reframed Housing System Fingerprint v1.0: qualitative bands, neutral endpoints. City context is only what you enter.</p>") +
      '</div><p><a class="read-article" href="#/">← Back to the X-Ray</a></p></section></main>';
  }
  const mcard = (t, b) => '<div class="card"><h3 class="method-h">' + t + "</h3>" + b + "</div>";

  /* ---------- Events ----------------------------------------------- */

  function touch() { const c = cur(); if (c) { c.meta.updated = new Date().toISOString(); save(); } }
  function stepId() { const h = location.hash.split("/"); return h[2] || "frame"; }
  function rerender() { const y = window.scrollY; route(); window.scrollTo(0, y); }

  // Re-render the report after scenario edits without losing place.
  let liveT = null;
  function liveReport() { clearTimeout(liveT); liveT = setTimeout(rerender, 120); }

  app.addEventListener("click", (e) => {
    const t = e.target.closest("button, a");
    if (!t) return;
    const c = cur();
    if (t.dataset.act === "new") { openCase(blankCase()); location.hash = "#/case/frame"; return; }
    if (t.dataset.act === "example") { const ex = clone(D.EXAMPLES[t.dataset.ex]); ex.meta.name = ex.meta.name + " (example)"; openCase(ex); track("example-" + t.dataset.ex.toLowerCase() + "-opened"); location.hash = "#/case/report"; return; }
    if (t.dataset.open) { state.current = t.dataset.open; save(); return; }
    if (t.dataset.delcase) { if (confirm("Delete this case from this browser?")) { delete state.cases[t.dataset.delcase]; if (state.current === t.dataset.delcase) state.current = null; save(); renderHome(); } return; }
    if (t.dataset.act === "newhh" && c) {
      const n = blankCase();
      ["market", "property", "diligence", "scenarios"].forEach((k) => (n[k] = clone(c[k])));
      n.decision.status = c.decision.status;
      n.meta.name = (c.meta.name || "Case").replace(/ \(example\)$/, "").replace(/: .*$/, "") + ": another household";
      openCase(n); location.hash = "#/case/frame"; return;
    }
    if (t.dataset.act === "share") { shareLink(); return; }
    if (t.dataset.act === "toworksheet") { openInWorksheet(); return; }
    if (t.dataset.act === "print") { document.querySelectorAll("details").forEach((d) => (d.open = true)); track("pdf-exported"); window.print(); return; }
    if (t.dataset.act === "fp-all") { const l = document.getElementById("fp-list"); if (l) { l.classList.toggle("show-all"); t.textContent = l.classList.contains("show-all") ? "Show only dimensions relevant to this case" : "Show all " + D.DIMS.length + " dimensions"; } return; }
    if (t.dataset.scroll) { e.preventDefault(); const el = document.getElementById(t.dataset.scroll); if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); if (el.tagName === "DETAILS") el.open = true; } return; }
    if (!c) return;
    if (t.dataset.k && t.dataset.v !== undefined && t.classList.contains("choice")) {
      const k = t.dataset.k, v = t.dataset.v;
      set(c, k, get(c, k) === v && !/purpose|status|occupancy|mode$/.test(k) ? "" : v);
      const f = findField(k); if (f && f.onChange) f.onChange(c);
      touch(); rerender(); return;
    }
    if (t.dataset.multi) {
      const k = t.dataset.multi, v = t.dataset.v; let arr = (get(c, k) || []).slice();
      arr = arr.indexOf(v) >= 0 ? arr.filter((x) => x !== v) : arr.concat(v);
      if (k === "property.return_engine" && v === "none") arr = arr.indexOf("none") >= 0 ? ["none"] : arr;
      else if (k === "property.return_engine") arr = arr.filter((x) => x !== "none");
      set(c, k, arr);
      if (k.indexOf("scenarios.") === 0) { c.scenarios._touched = c.scenarios._touched || {}; c.scenarios._touched[k.split(".")[1]] = true; }
      touch(); t.dataset.live ? liveReport() : rerender(); return;
    }
    if (t.dataset.signal) { set(c, "market.signals." + t.dataset.signal + ".status", t.dataset.v); touch(); rerender(); return; }
    if (t.dataset.addDest) { const arr = (c.property.destinations || []).slice(); arr.push({ kind: t.dataset.addDest }); c.property.destinations = arr; touch(); rerender(); return; }
    if (t.dataset.cmp) {
      c.life.compare = c.life.compare || {}; const d = (c.life.compare[t.dataset.cmp] = c.life.compare[t.dataset.cmp] || {});
      d[t.dataset.f] = d[t.dataset.f] === t.dataset.v ? "" : t.dataset.v; touch(); rerender(); return;
    }
    if (t.dataset.dil) { set(c, "diligence.items." + t.dataset.dil, t.dataset.v); touch(); rerender(); return; }
    if (t.dataset.add) { const arr = get(c, t.dataset.add) || []; arr.push(t.dataset.add === "property.comps" ? { type: "transaction", similarity: "medium" } : {}); set(c, t.dataset.add, arr); touch(); rerender(); return; }
    if (t.dataset.del) { const arr = get(c, t.dataset.del) || []; arr.splice(+t.dataset.i, 1); touch(); rerender(); return; }
  });

  function findField(k) {
    for (const s of STEPS) for (const g of s.groups || []) for (const f of g.fields.concat(g.more || [])) if (f.k === k) return f;
    return null;
  }

  app.addEventListener("input", (e) => {
    const t = e.target, c = cur();
    if (!c) return;
    if (t.dataset.slider) {
      const k = t.dataset.slider; c.scenarios[k] = +t.value; c.scenarios._touched = c.scenarios._touched || {}; c.scenarios._touched[k] = true;
      const o = document.getElementById("o-" + k); if (o) o.textContent = t.value + t.dataset.unit;
      touch(); liveReport(); return;
    }
    if (t.dataset.row) {
      const arr = get(c, t.dataset.row) || []; const row = arr[+t.dataset.i] || {};
      const f = t.dataset.f;
      row[f] = ["price", "amount"].indexOf(f) >= 0 ? (isNaN(parseMoney(t.value)) ? t.value : parseMoney(t.value)) : t.value;
      arr[+t.dataset.i] = row; set(c, t.dataset.row, arr); touch(); return;
    }
    if (t.dataset.toggle) { set(c, t.dataset.toggle, t.checked); touch(); rerender(); return; }
    if (!t.dataset.k) return;
    const k = t.dataset.k, type = t.dataset.type;
    let v = t.value;
    if (type === "money") { const p = parseMoney(v); v = isNaN(p) ? v : p; t.classList.toggle("bad-input", isNaN(p)); }
    else if (type === "num" || type === "pct") { const s = v.replace(/[%,\s]/g, ""); v = s === "" ? "" : isNaN(+s) ? v : +s; t.classList.toggle("bad-input", s !== "" && isNaN(+s)); }
    set(c, k, v);
    if (k.indexOf("scenarios.") === 0) { c.scenarios._touched = c.scenarios._touched || {}; c.scenarios._touched[k.split(".")[1]] = true; }
    if (k === "meta.name") { touch(); return; }
    touch();
    // live echoes and step counters
    const sn = document.querySelector(".stepper"); if (sn) sn.outerHTML = stepNav(stepId());
    document.querySelectorAll("[data-echo]").forEach((el) => { const f = findField(el.dataset.echo); if (f) el.textContent = echoText(f, c); });
    if (t.dataset.sel) { const f = findField(k); if (f && f.onChange) f.onChange(c); rerender(); }
  });

  app.addEventListener("change", (e) => {
    const t = e.target, c = cur();
    if (!c) return;
    if (t.dataset.row && t.tagName === "SELECT") { const arr = get(c, t.dataset.row) || []; arr[+t.dataset.i][t.dataset.f] = t.value; touch(); }
    if (t.dataset.k && t.dataset.type === "money" && !t.classList.contains("bad-input") && !isBlank(get(c, t.dataset.k))) t.value = Number(get(c, t.dataset.k)).toLocaleString((E.CCY[ccy()] || {}).locale);
    // fields that change which other fields are visible
    if (t.dataset.k && /mode|status|occupancy|purpose/.test(t.dataset.k)) rerender();
    if (t.dataset.k === "constraints.min_liquid" || t.dataset.k === "constraints.max_outflow") rerender();
  });

  /* ---------- Sibling tools (X-14, X-16) ----------------------------- */

  function toolLink(tool) { const s = site(); return (s && s.links && s.links[tool]) || null; }
  // Without the site script (single-tool preview) every tool counts as open.
  function toolOpen(tool) { const s = site(); if (!s || typeof s.isOpen !== "function") return true; try { return !!s.isOpen(tool); } catch (e) { return true; } }
  function opensOn(tool) {
    const s = site();
    try { const d = s && typeof s.opensAt === "function" ? s.opensAt(tool) : null; return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null; } catch (e) { return null; }
  }
  const worksheetReady = () => !viewCase && !!toolLink("worksheet") && toolOpen("worksheet");

  // X-Ray -> Worksheet: the Worksheet reads this case from zenca.xray.v1 by its
  // local id (#/from-xray/<id>). Only the id travels in the URL, never case data.
  function openInWorksheet() {
    const link = toolLink("worksheet");
    if (!link || !state.current || viewCase) return;
    flushSave();
    track("open-in-worksheet");
    location.href = link + "#/from-xray/" + encodeURIComponent(state.current);
  }

  /* ---------- Read-only share link (X-11) ---------------------------- */
  // The whole case is compressed into the URL fragment (#/shared/<payload>).
  // Nothing is stored on a server; the fragment is never sent to one, and
  // analytics records the route only as /x-ray/shared (DEPLOY X-12).

  const canShare = typeof CompressionStream === "function" && typeof DecompressionStream === "function";
  const SHARE_VERSION = 1;

  function b64url(bytes) {
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function fromB64url(str) {
    let b = String(str).replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    const bin = atob(b), out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function pipeBytes(bytes, stream) {
    const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await res.arrayBuffer());
  }
  async function encodeCase(c) {
    const x = clone(c);
    x.meta = { name: (c.meta && c.meta.name) || "Shared X-Ray" }; // no ids or timestamps travel
    const json = JSON.stringify({ v: SHARE_VERSION, c: x });
    return b64url(await pipeBytes(new TextEncoder().encode(json), new CompressionStream("deflate-raw")));
  }
  async function decodeCase(payload) {
    const bytes = await pipeBytes(fromB64url(payload), new DecompressionStream("deflate-raw"));
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    if (!obj || obj.v !== SHARE_VERSION || !obj.c) throw new Error("Unsupported share link");
    return obj.c;
  }

  async function shareLink() {
    const c = cur();
    const box = document.getElementById("share-box");
    if (!c || !canShare || !box) return;
    let url;
    try { url = location.origin + location.pathname + "#/shared/" + (await encodeCase(c)); }
    catch (e) { box.hidden = false; box.innerHTML = "<p>This browser couldn't create a share link.</p>"; return; }
    let copied = false;
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(url); copied = true; } } catch (e) { /* show it instead */ }
    box.hidden = false;
    box.innerHTML = "<p><b>" + (copied ? "Link copied." : "Copy this link:") + "</b> Anyone who has it can see every number in this case, read-only. " +
      "The case travels inside the link itself: nothing is stored on a server, and the person opening it can't edit it or save it as their own.</p>" +
      '<input type="text" class="share-url" readonly aria-label="Share link" value="' + esc(url) + '" />';
    const inp = box.querySelector(".share-url"); if (inp && !copied) { inp.focus(); inp.select(); }
    track("share-link-created");
  }

  async function renderShared(payload) {
    app.innerHTML = '<div class="wrap workspace"><p class="muted">Opening the shared X-Ray…</p></div>';
    let c = null;
    if (canShare && payload) { try { c = normaliseCase(await decodeCase(payload)); } catch (e) { c = null; } }
    // The hash may have changed while decoding; only render if still on this link.
    if (location.hash.replace(/^#\/?/, "") !== "shared/" + payload) return;
    if (!c) {
      viewCase = null;
      app.innerHTML = '<div class="wrap workspace"><section class="card"><h3>This share link can\'t be opened</h3><p class="group-intro">' +
        (canShare ? "It may have been cut off when it was copied: ask for the full link again." : "This browser is too old to open shared X-Ray links.") +
        '</p><a class="btn" href="#/">Start your own X-Ray</a></section></div>';
      return;
    }
    paintReadOnly(c, '<span class="eyebrow-sm">Shared X-Ray · read-only</span>' +
      "<p>You're looking at someone else's case exactly as they shared it. Nothing here is saved to your browser, and it can't be edited.</p>" +
      '<a class="btn small" href="#/">Start your own X-Ray</a>');
  }

  // Read-only report for a case that isn't the reader's own (shared links, article deep links).
  function paintReadOnly(c, bannerHTML) {
    viewCase = c;
    app.innerHTML = '<div class="wrap workspace shared-view"><div class="shared-banner">' + bannerHTML + "</div>" +
      '<div class="ws-main"><div class="step-head"><h2>' + esc(c.meta.name || "Shared X-Ray") + "</h2></div>" + reportHTML(c) + "</div></div>";
    // Links into the editing steps don't apply to a case the reader doesn't own.
    app.querySelectorAll('a[href^="#/case"]').forEach((a) => { const sp = document.createElement("span"); sp.textContent = a.textContent; a.replaceWith(sp); });
    afterReport(c);
  }

  /* ---------- Article deep links (X-17) ------------------------------- */
  // #/explore/<topic> opens an illustrative example, read-only, at the module an
  // earlier article discusses. Topic names are fixed in URL-REGISTRY.md.

  function renderExplore(topic) {
    const t = (D.EXPLORE || {})[topic];
    if (!t || !D.EXAMPLES[t.ex]) { viewCase = null; return renderHome(); }
    const c = normaliseCase(clone(D.EXAMPLES[t.ex]));
    paintReadOnly(c, '<span class="eyebrow-sm">Example from Article 14 · read-only</span>' +
      "<p>An illustrative household, opened at " + esc(t.label) + ". Nothing here is saved, and it can't be edited: open the example as your own case to change it, or start from scratch.</p>" +
      '<button type="button" class="btn-ghost small" data-act="example" data-ex="' + esc(t.ex) + '">Open this example as a case</button>' +
      '<a class="btn small" href="#/">Start your own X-Ray</a>');
    // After the hashchange handler's scroll-to-top, jump (not glide) to the module,
    // and again once web fonts have loaded and the layout has settled.
    const go = () => {
      if (location.hash.replace(/^#\/?/, "") !== "explore/" + topic) return;
      const el = document.getElementById(t.anchor);
      if (!el) return;
      if (el.tagName === "DETAILS") el.open = true;
      el.scrollIntoView({ block: "start", behavior: "instant" });
    };
    setTimeout(go, 80);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(go, 80));
  }

  app.addEventListener("focusin", (e) => { if (e.target.classList && e.target.classList.contains("share-url")) e.target.select(); });

  route();
})();
