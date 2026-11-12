/* ============================================================
   Property Decision X-Ray — bundled reference data
   - Housing System Fingerprint v1.0 (Country layer): qualitative
     bands, neutral endpoints, no score. Farther left or right is
     not better; it is simply different.
   - Country configuration (currency, regulator label).
   - The two Article 14 households, as loadable example cases.
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.XRayData = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const BANDS = ["Left", "Mid-left", "Middle", "Mid-right", "Right"];

  const FINGERPRINT_SOURCE = {
    source_type: "Curated framework (qualitative)",
    source_name: "Real Estate Reframed: Housing System Fingerprint v1.0",
    as_of_date: "October 2026",
    geography: "Country",
    confidence_note: "Directional placements on qualitative bands, not measurements. India and China mortgage-rate-structure placements carry a confidence flag.",
  };

  const FAMILIES = {
    A: "Demand and demography", B: "Stock, land and supply", C: "Household finance and balance sheets",
    D: "Development model and the state", E: "Legal and market architecture", F: "Expectations and systemic exposure",
  };

  // pos: 0..4 = Left, Mid-left, Middle, Mid-right, Right.  flag: confidence flag.
  // tags: when the dimension materially affects a case (see relevantDims).
  const DIMS = [
    { n: 1, fam: "A", name: "Urbanisation stage", left: "Earlier transition", right: "Mature / fully urbanised", pos: { IN: 1, CN: 3, JP: 4, US: 4 }, tags: ["always"],
      why: "Where the country sits in its move to cities shapes how much structural demand is still ahead." },
    { n: 2, fam: "A", name: "Population trajectory", left: "Sustained growth", right: "Sustained decline", pos: { IN: 0, CN: 4, JP: 4, US: 1 }, tags: [],
      why: "Long-run household numbers set the floor under demand, but not where that demand lands." },
    { n: 3, fam: "A", name: "Structural new-housing demand", left: "Strong expansionary tailwind", right: "Structural contraction", pos: { IN: 0, CN: 4, JP: 4, US: 1 }, tags: ["always"],
      why: "A national tailwind creates possibility; it does not guarantee every micro-market captures it." },
    { n: 4, fam: "A", name: "Geographic concentration of demand", left: "Broadly distributed", right: "Highly concentrated", pos: { IN: 3, CN: 3, JP: 4, US: 2 }, tags: [],
      why: "Concentrated demand means location inside the country matters more than the national average." },
    { n: 5, fam: "B", name: "Housing-stock balance", left: "Shortage / tight stock", right: "Excess / overhang", pos: { IN: 1, CN: 4, JP: 4, US: 1 }, tags: [],
      why: "A country can have too many houses and not enough houses at the same time: stock is not fungible across places." },
    { n: 6, fam: "B", name: "Geographic match of stock", left: "Stock broadly where demand is", right: "Large stock-location mismatch", pos: { IN: 3, CN: 4, JP: 4, US: 2 }, tags: [],
      why: "Mismatch means national supply figures say little about this city." },
    { n: 7, fam: "B", name: "Supply responsiveness", left: "Responsive / elastic", right: "Constrained / inelastic", pos: { IN: 3, CN: 1, JP: 0, US: 3 }, tags: ["always"],
      why: "How easily new usable housing appears decides whether demand shows up as price or as new homes." },
    { n: 8, fam: "B", name: "Useful-land availability", left: "Ample / expandable", right: "Physically constrained", pos: { IN: 2, CN: 2, JP: 4, US: 0 }, tags: [],
      why: "Useful land is legally buildable, connected and near demand, not just raw land." },
    { n: 9, fam: "B", name: "Planning / zoning flexibility", left: "Flexible", right: "Restrictive / fragmented", pos: { IN: 4, CN: 2, JP: 0, US: 3 }, tags: [],
      why: "Planning rules shape both future competing supply and redevelopment options." },
    { n: 10, fam: "B", name: "Infrastructure maturity", left: "Catching up / expanding", right: "Mature network", pos: { IN: 0, CN: 3, JP: 4, US: 4 }, tags: ["infra"],
      why: "Where networks are still expanding, infrastructure theses are common, and so is uncertainty about timing." },
    { n: 11, fam: "C", name: "Mortgage-market depth", left: "Shallow / cash-heavy", right: "Deeply mortgage-financed", pos: { IN: 1, CN: 3, JP: 4, US: 4 }, tags: ["financed"],
      why: "Shallow mortgage markets mean more buyers pay with savings, affecting who the next buyer is and what they can pay." },
    { n: 12, fam: "C", name: "Mortgage interest-rate structure", left: "Floating / resetting", right: "Long-term fixed", pos: { IN: 0, CN: 1, JP: 0, US: 4 }, flag: { IN: true, CN: true }, tags: ["financed"],
      why: "Floating systems pass rate changes straight into household cash flow; the rate-rise stress matters more." },
    { n: 13, fam: "C", name: "Household housing leverage", left: "Low", right: "High", pos: { IN: 0, CN: 2, JP: 2, US: 3 }, tags: ["financed"],
      why: "System-wide leverage affects how forced selling can spread in a downturn." },
    { n: 14, fam: "C", name: "Home-equity monetisability", left: "Difficult / uncommon", right: "Easy / institutionalised", pos: { IN: 1, CN: 1, JP: 1, US: 4 }, tags: ["fi"],
      why: "Where home equity is hard to borrow against, it is hard to use as retirement capital without selling." },
    { n: 15, fam: "C", name: "Household wealth concentration in housing", left: "Diversified balance sheet", right: "Property-dominated", pos: { IN: 4, CN: 4, JP: 1, US: 1 }, tags: ["concentration"],
      why: "In property-dominated systems, concentration is the norm, which is different from it being safe for you." },
    { n: 16, fam: "D", name: "Developer-financing fragility", left: "Completion-insulated / diversified finance", right: "Presale / debt dependent", pos: { IN: 3, CN: 4, JP: 0, US: 0 }, tags: ["uc"],
      why: "Where buyers' payments fund construction, project viability is not the same as project liquidity." },
    { n: 17, fam: "D", name: "Buyer execution / counterparty risk", left: "Low", right: "High", pos: { IN: 3, CN: 4, JP: 0, US: 0 }, tags: ["uc"],
      why: "The less finished the asset, the more of the purchase belongs to underwriting rather than inspection.",
      note: { IN: "RERA reduces risk. It does not abolish project risk." } },
    { n: 18, fam: "D", name: "Government fiscal dependence on property", left: "Low / indirect", right: "Direct / highly dependent", pos: { IN: 2, CN: 4, JP: 1, US: 2 }, tags: [],
      why: "Where public revenues lean on property, policy and the housing cycle are intertwined." },
    { n: 19, fam: "E", name: "Title certainty & transaction formalisation", left: "Fragmented / buyer-verification heavy", right: "Strong / highly formalised", pos: { IN: 1, CN: 3, JP: 4, US: 4 }, tags: ["always"],
      why: "Where the buyer bears more of the verification burden, legal diligence is part of the investment, not paperwork around it.",
      note: { IN: "India's property system is becoming more formal; it has not yet become uniformly frictionless." } },
    { n: 20, fam: "E", name: "Secondary / resale-market depth", left: "Thin / frictional", right: "Deep / transparent", pos: { IN: 1, CN: 2, JP: 3, US: 4 }, tags: ["exit"],
      why: "Thin resale markets make exit slower and prices less observable: important if you may sell early." },
    { n: 21, fam: "E", name: "Rental-market institutionalisation", left: "Informal / fragmented", right: "Professional / institutional", pos: { IN: 0, CN: 1, JP: 4, US: 4 }, tags: ["rental"],
      why: "Informal rental markets mean more landlord work, more variance in vacancy and tenant quality." },
    { n: 22, fam: "E", name: "Building-value persistence", left: "Structure depreciates rapidly", right: "Structure retains value strongly", pos: { IN: 2, CN: 2, JP: 0, US: 3 }, tags: ["age"],
      why: "Land and structure age differently; an older building's value leans more on the land under it." },
    { n: 23, fam: "F", name: "Cultural expectation of property appreciation", left: "Conditional / weak", right: "Deeply entrenched", pos: { IN: 4, CN: 3, JP: 0, US: 3 }, tags: ["always"],
      why: "A behavioural inference, not a statistic: strong expectations can sustain demand, until they change." },
    { n: 24, fam: "F", name: "Systemic sensitivity to a property downturn", left: "Limited", right: "High", pos: { IN: 3, CN: 4, JP: 1, US: 3 }, tags: ["spec"],
      why: "In sensitive systems a downturn can feed back into jobs, credit and other assets at once." },
  ];

  const COUNTRIES = {
    IN: { name: "India", currency: "INR", regulator: "RERA", fingerprint: "Expansionary demand, constrained conversion",
      meaning: "Demographics and urbanisation still create structural housing demand, but land assembly, infrastructure, planning, title, affordability and execution determine how efficiently that demand becomes usable housing." },
    CN: { name: "China", currency: "CNY", regulator: "project registration", fingerprint: "Matured demand, overbuilt and over-financed",
      meaning: "A housing system built around urbanisation, household property accumulation, presales, developer leverage and land-dependent local government has reached a fundamentally different demographic phase." },
    JP: { name: "Japan", currency: "JPY", regulator: "project registration", fingerprint: "Mature, responsive and shrinking",
      meaning: "Extremely mature urban infrastructure and relatively flexible housing supply coexist with demographic decline, high vacancy and a much weaker assumption that structures must continually appreciate." },
    US: { name: "United States", currency: "USD", regulator: "project registration", fingerprint: "Financially deep, locally supply-constrained",
      meaning: "Deep mortgages, long-fixed financing, resale liquidity and home-equity monetisation coexist with highly localised supply restrictions and substantial geographic divergence." },
    OTHER: { name: "Another country", currency: null, regulator: "project registration", fingerprint: null, meaning: null },
  };

  // Dimensions surfaced for a case (the rest stay one click away).
  function relevantDims(c) {
    const d = c.decision || {}, f = c.financing || {}, h = c.household || {}, p = c.property || {};
    const on = { always: true };
    if (f.mode === "loan") on.financed = true;
    if (d.status === "uc") on.uc = true;
    if (d.purpose === "investment" || d.purpose === "speculative" || +d.holding_years <= 7 || d.move_risk === "plausible" || d.move_risk === "likely") on.exit = true;
    if (d.occupancy === "rent" || d.occupancy === "mixed") on.rental = true;
    if (h.fi_active) on.fi = true;
    if (+h.existing_re_value > 0 || h.fi_active) on.concentration = true;
    if (+p.age_years >= 10) on.age = true;
    if (d.purpose === "speculative") on.spec = true;
    if ((p.return_engine || []).indexOf("infrastructure") >= 0) on.infra = true;
    return DIMS.filter((x) => x.tags.some((t) => on[t])).map((x) => x.n);
  }

  /* ---------- Example cases: Article 14's two households ----------- */
  // Same country, city, apartment and price. Only the Person layer
  // (and the financing that person needs) differs.

  const sharedProperty = () => ({
    purchase_price: 30000000, property_type: "apartment", area: 1650, area_basis: "carpet", age_years: 6,
    expected_monthly_rent: 75000, equivalent_market_rent: 75000,
    acq: { stamp: 1800000, registration: 30000, brokerage: 300000, legal: 50000, other: "" },
    owner: { maintenance: 72000, property_tax: 25000, insurance: 8000, repairs: 60000 },
    mgmt_pct: "", letting_costs_annual: "", initial_work: 1000000, exit_cost_pct: 2, exit_tax: "",
    comps: [
      { price: 28500000, area: 1600, date: "2026-05", type: "transaction", similarity: "high", note: "Same building, 4th floor" },
      { price: 31000000, area: 1700, date: "2026-02", type: "transaction", similarity: "high", note: "Adjacent tower" },
      { price: 27000000, area: 1550, date: "2025-09", type: "transaction", similarity: "medium", note: "Older block, same street" },
      { price: 33000000, area: 1650, date: "2026-08", type: "listing", similarity: "high", note: "Asking price, unsold" },
    ],
    price_evidence_note: "Two recent sales in the same complex; one older sale nearby; one optimistic listing.",
    access: {
      type: "public", last_mile: "good", year_round: "yes", dependencies: ["shared_infra", "association"],
      dependency_note: "Sewage treatment plant and borewell pumps are run by the owners' association.",
      services: { power: "public", sewage: "association", waste: "association", road: "public" },
    },
    water: {
      sources: ["municipal", "borewell", "tanker"], primary: "municipal", dry_season: "occasional", shortages: "yes", tanker_freq: "occasional",
      borewells: 2, borewell_status: "some_failed", storage_days: 2, backup: "yes", groundwater: "unknown",
      potable: "after_treatment", treatment: "Central softening plant; RO at the kitchen tap", quality_issues: "Hard borewell water (high TDS)",
      controlled_by: ["utility", "association", "tanker_vendors"], contingency: "The association orders tankers when the borewells run low.",
      tanker_monthly: 2500, treatment_annual: 12000, pumping_annual: "", maintenance_share: 18000,
    },
    destinations: [
      { kind: "work", label: "Office cluster", km: 14, normal: 35, peak: 75, last_mile: "good", alt: "yes" },
      { kind: "school", label: "Children's school", km: 2.5, normal: 10, peak: 20, last_mile: "good", alt: "yes" },
      { kind: "hospital", label: "Multi-speciality hospital", km: 5, normal: 15, peak: 30, last_mile: "fair", alt: "yes" },
      { kind: "daily", label: "Groceries / pharmacy", km: 0.8, normal: 5, peak: 8, last_mile: "good", alt: "yes" },
      { kind: "transport", label: "Airport", km: 38, normal: 55, peak: 110, last_mile: "good", alt: "no" },
      { kind: "family", label: "Grandparents", km: 9, normal: 25, peak: 50, last_mile: "fair", alt: "yes" },
    ],
  });

  const sharedMarket = () => ({
    country: "IN", currency: "INR", city: "An Indian metro (illustrative)", micro_market: "Established residential neighbourhood",
    city_stage: "mid",
    signals: {
      jobs: { status: "tailwind", note: "Large employment cluster within 30 minutes" },
      migration: { status: "tailwind", note: "" },
      incomes: { status: "unknown", note: "" },
      supply: { status: "headwind", note: "Several new towers launching nearby" },
      infrastructure: { status: "mixed", note: "Metro extension announced; timeline unclear" },
      affordability: { status: "headwind", note: "Prices have outpaced local incomes" },
      rents: { status: "mixed", note: "Rents rising, yields still low" },
      vacancy: { status: "unknown", note: "" },
    },
  });

  const sharedScenarios = () => ({
    base_appr: 6, upside_appr: 9, inflation: 5, rent_growth: 5, vacancy_base_months: 1,
    flat_years: 5, price_fall_pct: 20, rate_rise_bps: 200, income_months: 6, vacancy_months: 6,
    delay_a: 12, delay_b: 24, shock_amount: 5000000, shock_year: 3, compound: ["rate", "income"],
    thesis_b_appr: 2, thesis_c_appr: -2, thesis_c_exit_extra: 3,
    _touched: { base_appr: true, upside_appr: true, inflation: true, rent_growth: true },
  });

  const EXAMPLES = {
    A: {
      meta: { name: "Household A: the long-stay family", example: "A" },
      decision: { purpose: "home", status: "ready", occupancy: "self", holding_years: 20, move_risk: "low", move_note: "" },
      market: sharedMarket(),
      property: Object.assign(sharedProperty(), { return_engine: ["land", "jobs", "inflation"] }),
      diligence: {
        items: { title_chain: "resolved", legal_access: "resolved", encumbrance: "resolved", approvals: "resolved", registration_docs: "resolved", tax_dues: "unknown", occupancy_cert: "resolved", society_noc: "open" },
      },
      financing: { mode: "loan", loan_amount: 9000000, rate: 8.5, rate_type: "floating", tenure_years: 20, loan_fees: 25000 },
      household: {
        income: 600000, stability: "stable", existing_debt_service: 0, living_expenses: 225000, current_housing_cost: 70000,
        liquid: 30000000, financial: 80000000, existing_re_value: 0, existing_primary_value: 0, existing_re_debt: 0, existing_re_same_city: 0,
        income_same_city: true, retirement: 12000000, funding_from_financial: 0,
        outlays: [{ label: "Children's university", amount: 8000000, year: 9 }],
        fi_active: false,
      },
      life: {
        zat: "yes", zat_note: "We would stay here for the children's schooling regardless of prices.",
        thesis_b_happy: "yes", thesis_c_survive: "yes", thesis_note: "We're buying the neighbourhood we already live in, not a forecast.",
        compare: {
          home_quality: { rating: "strong", importance: "high" }, floor_view: { rating: "adequate", importance: "low" },
          mobility: { rating: "adequate", importance: "high" }, healthcare: { rating: "strong", importance: "medium" },
          daily: { rating: "strong", importance: "medium" }, social: { rating: "strong", importance: "high" },
          lifestyle: { rating: "strong", importance: "medium" },
        },
        utility: ["location", "school", "family", "permanence", "control"], enough_price: 22000000, enough_rent: 55000,
        alt_type: "rent", alt_invests: "yes", opp_rate: 8,
      },
      constraints: { min_liquid_mode: "amount", min_liquid: 2500000, max_outflow_mode: "amount", max_outflow: 250000, max_debt_service_pct: "", legal_required: ["title_chain", "encumbrance", "approvals"] },
      scenarios: sharedScenarios(),
    },
    B: {
      meta: { name: "Household B: the leveraged bet", example: "B" },
      decision: { purpose: "speculative", status: "ready", occupancy: "rent", holding_years: 4, move_risk: "plausible", move_note: "A job move within three years is plausible." },
      market: sharedMarket(),
      property: Object.assign(sharedProperty(), { letting_costs_annual: 30000, initial_work: 300000, return_engine: ["infrastructure", "belief"] }),
      diligence: {
        items: { title_chain: "resolved", legal_access: "unknown", encumbrance: "unknown", approvals: "unknown", registration_docs: "resolved", tax_dues: "unknown", occupancy_cert: "unknown", society_noc: "unknown" },
      },
      financing: { mode: "loan", loan_amount: 24000000, rate: 8.75, rate_type: "floating", tenure_years: 20, loan_fees: 30000 },
      household: {
        income: 400000, stability: "variable", existing_debt_service: 55000, living_expenses: 140000, current_housing_cost: 0,
        liquid: 4000000, financial: 6000000, existing_re_value: 15000000, existing_primary_value: 15000000, existing_re_debt: 6000000, existing_re_same_city: 15000000,
        income_same_city: true, retirement: 1500000, funding_from_financial: 5000000, outlays: [], fi_active: false,
      },
      life: { zat: "", utility: [], alt_type: "invest", alt_invests: "yes", opp_rate: 10, thesis_b_happy: "no", thesis_c_survive: "unsure", thesis_note: "The whole case is the metro line." },
      constraints: { min_liquid_mode: "amount", min_liquid: 400000, max_outflow_mode: "amount", max_outflow: 175000, max_debt_service_pct: "", min_return: 12, max_appr_dependency: "base", legal_required: [] },
      scenarios: Object.assign(sharedScenarios(), { compound: ["rate", "vacancy"], income_months: 6 }),
    },
  };

  // Example C (Article 11): Household A buying the same kind of apartment under
  // construction, below the price of a comparable ready unit. Illustrative only.
  EXAMPLES.C = (function () {
    const c = JSON.parse(JSON.stringify(EXAMPLES.A));
    const P = 26000000, r = P / c.property.purchase_price;
    c.meta = { name: "Household A: bought under construction (illustrative)", example: "C" };
    c.decision.status = "uc";
    c.property.purchase_price = P;
    Object.keys(c.property.acq).forEach((k) => { if (c.property.acq[k] !== "") c.property.acq[k] = Math.round(c.property.acq[k] * r); });
    c.property.age_years = "";
    c.property.return_engine = ["uc_discount", "land", "jobs"];
    c.property.access.dependencies = ["developer", "shared_infra"];
    c.property.access.dependency_note = "Until handover, the developer runs water, sewage and common services.";
    c.property.access.services = { power: "public", sewage: "developer", waste: "developer", road: "public" };
    c.diligence = {
      items: { title_chain: "resolved", legal_access: "resolved", encumbrance: "resolved", approvals: "resolved", registration_docs: "resolved", tax_dues: "unknown",
        project_registration: "resolved", land_title: "resolved", developer_record: "open", construction_stage: "unknown", project_funding: "unknown", agreement_terms: "resolved" },
      developer: "An established regional developer (illustrative)", project_stage: "structure", registration_status: "registered",
      months_to_possession: 30, ready_comparable_price: 30000000,
      schedule: [{ month: 0, pct: 10 }, { month: 6, pct: 15 }, { month: 12, pct: 20 }, { month: 18, pct: 20 }, { month: 24, pct: 20 }, { month: 30, pct: 15 }],
    };
    c.financing.loan_amount = 7800000;
    c.life.zat_note = "We'd live here for the children's schooling regardless of prices: the discount is a bonus, not the reason.";
    c.life.alt_type = "ready";
    c.constraints.max_delay_months = 18;
    c.constraints.legal_required = ["title_chain", "project_registration", "land_title"];
    return c;
  })();

  // Deep links from earlier articles (X-17). Route: #/explore/<topic>. Names are
  // fixed in URL-REGISTRY.md: rename one there and here together, or not at all.
  const EXPLORE = {
    return: { ex: "A", anchor: "x-ledger", article: 4, label: "the return ledger: asset return versus equity return" },
    "housing-cost": { ex: "A", anchor: "x-housing", article: 5, label: "the true cost of housing, and owning versus renting" },
    leverage: { ex: "B", anchor: "x-stress", article: 6, label: "what leverage does under stress" },
    rental: { ex: "B", anchor: "x-rental", article: 7, label: "the rental P&L" },
    "balance-sheet": { ex: "B", anchor: "x-household", article: 9, label: "the household balance sheet and concentration" },
    utility: { ex: "A", anchor: "x-compare", article: 10, label: "housing utility, the Zero-Appreciation Test and the Enough-House" },
    "under-construction": { ex: "C", anchor: "x-uc", article: 11, label: "under-construction economics and delay" },
    appreciation: { ex: "B", anchor: "x-thesis", article: 13, label: "appreciation dependency and the A/B/C scenarios" },
  };

  return { BANDS, FAMILIES, DIMS, COUNTRIES, FINGERPRINT_SOURCE, relevantDims, EXAMPLES, EXPLORE };
});
