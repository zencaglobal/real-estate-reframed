/* ============================================================
   Property Decision Worksheet — content
   Governing document: Deliverable 4 — Property Decision
   Worksheet v1.0 (one-page checklist + extended sections A–P).
   Vocabulary and the Country layer are shared with the Property
   Decision X-Ray so a worksheet can travel into, and out of, it.
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WSContent = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- Shared vocabulary (keys match the X-Ray) ------------- */

  const O = {
    purpose: [["home", "Primary home", "Housing and stability first"], ["investment", "Investment", "Income plus capital return"], ["mixed", "Mixed", "A home with a real investment objective"], ["speculative", "Speculative", "Appreciation-led; a resale thesis dominates"]],
    status: [["ready", "Ready"], ["uc", "Under construction"]],
    occupancy: [["self", "Self-use"], ["rent", "Rent out"], ["resale", "Hold for resale"]],
    move: [["low", "Unlikely"], ["plausible", "Plausible"], ["likely", "Likely"]],
    alt: [["rent", "Rent the same home"], ["cheaper", "Buy cheaper"], ["ready", "Buy ready"], ["wait", "Wait"], ["invest", "Invest elsewhere"], ["custom", "Something else"]],
    components: [["land", "Land interest"], ["structure", "Structure"], ["location", "Economic location"], ["legal", "Legal rights"], ["infra", "Infrastructure"], ["optionality", "Optionality"]],
    engines: [["rent", "Rent"], ["land", "Scarcity"], ["infrastructure", "Infrastructure"], ["jobs", "Income growth"], ["redevelopment", "Redevelopment"], ["uc_discount", "Under-construction discount"], ["inflation", "General appreciation"], ["belief", "A later buyer paying much more"]],
    evidence: [["strong", "Strong"], ["mixed", "Mixed"], ["weak", "Weak"], ["insufficient", "Insufficient"]],
    resolved: [["resolved", "Resolved"], ["partly", "Partly resolved"], ["unresolved", "Unresolved"], ["unknown", "Unknown"]],
    similarity: [["high", "High"], ["medium", "Medium"], ["low", "Low"]],
    compKind: [["transaction", "Transaction"], ["listing", "Listing / estimate"]],
    fundMode: [["cash", "Cash"], ["loan", "Loan / mixed"]],
    rateType: [["floating", "Floating"], ["fixed", "Fixed"], ["hybrid", "Hybrid"]],
    optionsLost: [["retire", "Earlier retirement"], ["portfolio", "Larger liquid portfolio"], ["smaller_mortgage", "Smaller mortgage"], ["business", "Business capital"], ["other", "Other"]],
    likelihood: [["unlikely", "Unlikely"], ["plausible", "Plausible"], ["likely", "Likely"]],
    zat: [["yes", "Yes"], ["unsure", "Unsure"], ["no", "No"]],
    utility: [["control", "Control"], ["permanence", "Permanence"], ["family", "Family continuity"], ["location", "Location"], ["school", "Schools"], ["space", "Space"], ["privacy", "Privacy"], ["customisation", "Customisation"], ["identity", "Identity / status"], ["other", "Other"]],
    premiumBuys: [["space", "Space"], ["location", "Better location"], ["luxury", "Luxury"], ["status", "Status"], ["privacy", "Privacy"], ["optionality", "Optionality"], ["other", "Other"]],
    premiumCosts: [["liquidity", "Liquidity"], ["savings", "Savings"], ["leverage", "Lower leverage"], ["fi", "Earlier FI / retirement"], ["flexibility", "Flexibility"], ["other", "Other"]],
    yesPartlyNo: [["yes", "Yes"], ["partly", "Partly"], ["no", "No"]],
    yesUnsureNo: [["yes", "Yes"], ["unsure", "Unsure"], ["no", "No"]],
    dependency: [["low", "Low"], ["moderate", "Moderate"], ["high", "High"], ["unclear", "Not yet clear"]],
    breaks: [["no", "No"], ["maybe", "Maybe"], ["yes", "Yes"], ["unknown", "Unknown"]],
    cityStage: [["early", "Early transformation"], ["mid", "Mid-transformation"], ["mature", "Mature"], ["declining", "Declining / bypassed"], ["unclear", "Unclear"]],
    // Water security
    waterSource: [["piped", "Municipal / piped"], ["borewell", "Borewell"], ["tanker", "Tanker"], ["combination", "Combination"], ["other", "Other"]],
    waterReliability: [["reliable", "Reliable year-round"], ["seasonal", "Dry-season shortfalls"], ["frequent", "Frequent shortfalls"]],
    tanker: [["none", "None"], ["occasional", "Occasional"], ["seasonal", "Every dry season"], ["regular", "Regular / year-round"]],
    futureConn: [["no", "No"], ["yes", "Yes, we're counting on one"], ["unsure", "Not sure"]],
    treatment: [["none", "None / minimal"], ["some", "Some filtering"], ["significant", "Significant treatment"], ["unknown", "Unknown"]],
    // Legal / physical access and dependency
    legalAccess: [["clear", "Clear and documented"], ["partly", "Partly documented"], ["unclear", "Unclear"], ["unknown", "Not checked yet"]],
    road: [["public", "Public"], ["private", "Private, owned with the property"], ["shared", "Shared"], ["dependent", "Depends on another landowner"], ["unknown", "Unknown"]],
    yearRound: [["yes", "Yes"], ["seasonal", "Problems in some seasons"], ["no", "No"], ["unknown", "Unknown"]],
    thirdParty: [["none", "No"], ["some", "Somewhat"], ["material", "Materially"], ["unknown", "Unknown"]],
    altRoute: [["yes", "Yes"], ["partly", "Partly"], ["no", "No"]],
    // Location-thesis scenarios and gates
    scenario: [["yes", "Yes"], ["unsure", "Unsure"], ["no", "No"]],
    gate: [["clear", "Clear"], ["open", "Still open"], ["fails", "Fails"], ["pref", "Preference only"]],
  };

  // Water wording by country — generic descriptors, never a city's utility name.
  // Keys stay the same everywhere; only the words change.
  const WATER_TERMS = {
    IN: { piped: "Municipal / piped", well: "Borewell", truck: "Tanker", truckNoun: "tanker water" },
    CN: { piped: "Municipal / piped", well: "Well", truck: "Water truck", truckNoun: "trucked water" },
    JP: { piped: "Municipal / public water", well: "Private well", truck: "Water delivery", truckNoun: "delivered water" },
    US: { piped: "Public / municipal water", well: "Private well", truck: "Trucked / hauled water", truckNoun: "trucked or hauled water" },
    OTHER: { piped: "Municipal / piped", well: "Well / borewell", truck: "Tanker / trucked water", truckNoun: "tanker or trucked water" },
  };
  const waterTerms = (c) => WATER_TERMS[((c && c.market) || {}).country] || WATER_TERMS.OTHER;
  const waterSourceOpts = (c) => { const t = waterTerms(c); return [["piped", t.piped], ["borewell", t.well], ["tanker", t.truck], ["combination", "Combination"], ["other", "Other"]]; };

  // The article this worksheet accompanies. Its URL is not stored here: it
  // comes from the site script (ZencaSite.links.article14) at runtime.
  const ARTICLE = { n: 14, title: "So, Should You Buy This Property?", series: "Real Estate Reframed" };

  // Location-thesis stress test: three outcomes, no probabilities.
  const SCENARIOS = [
    { id: "A", title: "Growth thesis works", text: "Infrastructure, employment and demand develop broadly as expected." },
    { id: "B", title: "Area develops, but supply absorbs much of the upside", text: "The location improves, but substantial competing housing keeps appreciation modest." },
    { id: "C", title: "Thesis disappoints", text: "Infrastructure or employment growth disappoints, important constraints remain, resale liquidity weakens and/or prices correct." },
  ];

  // Potential non-negotiables. Each one is the reader's call: clear, still
  // open, fails — or demoted to a preference. Walk-away conditions from
  // Chapter 7 are added as household-specific gates.
  const GATES = [
    { id: "title", label: "Title / approvals" },
    { id: "access", label: "Legal / physical access" },
    { id: "water", label: "Water / basic infrastructure" },
    { id: "financing", label: "Financing survivability" },
  ];

  // Suggested destinations for the effective-access table — never forced.
  const DESTINATIONS = ["Work", "School", "Hospital", "Groceries", "Airport / major transport", "Family / social network"];

  // City signals — Section C of the worksheet. Option sets follow the spec.
  const SIGNALS = [
    { id: "jobs", label: "Jobs / economic activity", opts: [["strong", "Strong"], ["mixed", "Mixed"], ["weak", "Weak"], ["unknown", "Unknown"]], warn: ["weak"] },
    { id: "migration", label: "Household demand / migration", opts: [["strong", "Strong"], ["mixed", "Mixed"], ["weak", "Weak"], ["unknown", "Unknown"]], warn: ["weak"] },
    { id: "incomes", label: "Income / affordability", opts: [["strong", "Strong"], ["mixed", "Mixed"], ["weak", "Weak"], ["unknown", "Unknown"]], warn: ["weak"] },
    { id: "supply", label: "Competing supply pipeline", opts: [["low", "Low"], ["medium", "Medium"], ["high", "High"], ["unknown", "Unknown"]], warn: ["high"] },
    { id: "infrastructure", label: "Infrastructure / economic location", opts: [["improving", "Improving"], ["stable", "Stable"], ["weakening", "Weakening"], ["unknown", "Unknown"]], warn: ["weakening"] },
    { id: "rents", label: "Rent / vacancy evidence", opts: [["supports", "Supports the price story"], ["mixed", "Mixed"], ["doesnot", "Does not"], ["unknown", "Unknown"]], warn: ["doesnot"] },
  ];

  // Decision profile — Section P. The worksheet never assigns these; the
  // reader does. Some carry a "your answers suggest" hint.
  const PROFILE = [
    { id: "price_evidence", label: "Price evidence", opts: [["strong", "Strong"], ["mixed", "Mixed"], ["weak", "Weak"], ["insufficient", "Insufficient"]], warn: ["weak", "insufficient"] },
    { id: "appr_dependency", label: "Appreciation dependency", opts: [["low", "Low"], ["moderate", "Moderate"], ["high", "High"], ["unclear", "Not clear"]], warn: ["high"] },
    { id: "leverage", label: "Leverage sensitivity", opts: [["low", "Low"], ["moderate", "Moderate"], ["high", "High"], ["na", "N/A / not clear"]], warn: ["high"] },
    { id: "liquidity", label: "Liquidity impact", opts: [["manageable", "Manageable under my plan"], ["tension", "Tension"], ["breach", "Breaches my own floor"], ["unclear", "Not clear"]], warn: ["breach"] },
    { id: "concentration", label: "Concentration impact", opts: [["comfortable", "Comfortable"], ["deliberate", "Deliberate but meaningful"], ["uncomfortable", "Uncomfortable"], ["unclear", "Not clear"]], warn: ["uncomfortable"] },
    { id: "utility", label: "Housing utility", opts: [["strong", "Strong"], ["mixed", "Mixed"], ["weak", "Weak"], ["na", "N/A"]], warn: [] },
    { id: "execution", label: "Execution / legal status", opts: [["resolved", "Resolved"], ["partly", "Partly resolved"], ["unresolved", "Unresolved"], ["unknown", "Unknown"]], warn: ["unresolved"] },
  ];

  // Stress tests — Section M (and the one-page checklist, section 6).
  const STRESSES = [
    { id: "flat", label: "0% nominal appreciation for 5 years", short: "Flat market, 5 years" },
    { id: "fall", label: "Property value falls 20%", short: "Price −20%" },
    { id: "rate", label: "Mortgage rate rises by 2 percentage points", short: "Rate +2 pts", na: (c) => (c.financing || {}).mode !== "loan" },
    { id: "income", label: "Household income stops for 12 months", short: "Income stops, 12 months" },
    { id: "vacancy", label: "Rental vacancy for 6 months", short: "Vacancy, 6 months", na: (c) => ["rent"].indexOf((c.decision || {}).occupancy) < 0 && (c.decision || {}).purpose !== "investment" },
    { id: "delay", label: "Construction delay of 24 months", short: "Possession 24 months late", na: (c) => (c.decision || {}).status !== "uc" },
  ];

  /* ---------- Country layer (Housing System Fingerprint v1.0) ------ */
  // A subset of the X-Ray's bundled Fingerprint: the dimensions behind the
  // worksheet's four system prompts. pos 0..4 places a marker only.

  const FP_DIMS = {
    1: { name: "Urbanisation stage", left: "Earlier transition", right: "Mature / fully urbanised", pos: { IN: 1, CN: 3, JP: 4, US: 4 } },
    3: { name: "Structural new-housing demand", left: "Strong expansionary tailwind", right: "Structural contraction", pos: { IN: 0, CN: 4, JP: 4, US: 1 } },
    7: { name: "Supply responsiveness", left: "Responsive / elastic", right: "Constrained / inelastic", pos: { IN: 3, CN: 1, JP: 0, US: 3 } },
    9: { name: "Planning / zoning flexibility", left: "Flexible", right: "Restrictive / fragmented", pos: { IN: 4, CN: 2, JP: 0, US: 3 } },
    11: { name: "Mortgage-market depth", left: "Shallow / cash-heavy", right: "Deeply mortgage-financed", pos: { IN: 1, CN: 3, JP: 4, US: 4 } },
    12: { name: "Mortgage interest-rate structure", left: "Floating / resetting", right: "Long-term fixed", pos: { IN: 0, CN: 1, JP: 0, US: 4 }, flag: { IN: true, CN: true } },
    17: { name: "Buyer execution / counterparty risk", left: "Low", right: "High", pos: { IN: 3, CN: 4, JP: 0, US: 0 } },
    19: { name: "Title certainty & formalisation", left: "Fragmented / buyer-verification heavy", right: "Strong / highly formalised", pos: { IN: 1, CN: 3, JP: 4, US: 4 } },
    20: { name: "Secondary / resale-market depth", left: "Thin / frictional", right: "Deep / transparent", pos: { IN: 1, CN: 2, JP: 3, US: 4 } },
    21: { name: "Rental-market institutionalisation", left: "Informal / fragmented", right: "Professional / institutional", pos: { IN: 0, CN: 1, JP: 4, US: 4 } },
  };

  const COUNTRIES = {
    IN: { name: "India", currency: "INR", fingerprint: "Expansionary demand, constrained conversion",
      meaning: "Demographics and urbanisation still create structural demand, but land assembly, infrastructure, planning, title, affordability and execution decide how efficiently that demand becomes usable housing.",
      note: "RERA reduces project risk; it does not abolish it. The property system is becoming more formal, not yet uniformly frictionless." },
    CN: { name: "China", currency: "CNY", fingerprint: "Matured demand, overbuilt and over-financed",
      meaning: "A system built around urbanisation, household property accumulation, presales, developer leverage and land-dependent local government has reached a different demographic phase.", note: "" },
    JP: { name: "Japan", currency: "JPY", fingerprint: "Mature, responsive and shrinking",
      meaning: "Very mature infrastructure and relatively flexible supply coexist with demographic decline, high vacancy and a much weaker assumption that structures must keep appreciating.", note: "" },
    US: { name: "United States", currency: "USD", fingerprint: "Financially deep, locally supply-constrained",
      meaning: "Deep mortgages, long-fixed financing, resale liquidity and home-equity access coexist with highly local supply restrictions and wide geographic divergence.", note: "" },
    OTHER: { name: "Another country", currency: null, fingerprint: null, meaning: null, note: "" },
  };

  const CURRENCIES = ["INR", "USD", "GBP", "EUR", "AED", "SGD", "AUD", "CAD", "JPY", "CNY"];

  // The four system prompts of Section B, each with the dimensions that inform it.
  const SYSTEM_PROMPTS = [
    { k: "demand", label: "Demand / household formation", q: "What is the broad demographic and urbanisation backdrop?", dims: [1, 3] },
    { k: "supply", label: "Supply responsiveness", q: "Can housing supply expand easily, slowly or unpredictably?", dims: [7, 9] },
    { k: "mortgage", label: "Mortgage architecture", q: "Fixed or floating norms, credit depth, refinancing or rate-reset features that matter here.", dims: [11, 12] },
    { k: "institutions", label: "Institutions / title / formalisation", q: "Any system-level issue that changes how much diligence this purchase needs?", dims: [19, 17, 20, 21] },
  ];

  /* ---------- Chapters ---------------------------------------------- */
  // Field types: text · area (lined notes) · lines (one item per line) ·
  // money · num · pct · month · date · choice · multi · select · custom.
  // `unk: true` lets the reader mark a prompt "Not sure yet"; every such
  // mark is carried into the summary's unresolved questions.

  const isUC = (c) => (c.decision || {}).status === "uc";
  const loan = (c) => (c.financing || {}).mode === "loan";
  const letting = (c) => (c.decision || {}).occupancy === "rent" || (c.decision || {}).purpose === "investment";
  const homeish = (c) => ["home", "mixed"].indexOf((c.decision || {}).purpose) >= 0 || (c.decision || {}).occupancy === "self";
  const investish = (c) => ["investment", "speculative"].indexOf((c.decision || {}).purpose) >= 0;

  const CHAPTERS = [
    {
      id: "frame", n: 1, title: "The decision", short: "Decision",
      ask: "What exactly am I deciding?",
      intro: "State the property and the job you expect it to do before you evaluate it. The same apartment is a different decision for a family staying twenty years and for a buyer expecting to sell in four.",
      groups: [
        { id: "what", title: "The property", fields: [
          { k: "property.name", t: "text", label: "Property / project", ph: "e.g. 3-bed apartment, Tower B, 6 years old", wide: true, req: true },
          { k: "market.country", t: "select", label: "Country", opts: "countries", req: true },
          { k: "market.city", t: "text", label: "City", ph: "City", req: true },
          { k: "market.micro_market", t: "text", label: "Micro-market", ph: "Neighbourhood / corridor" },
          { k: "property.purchase_price", t: "money", label: "Price", req: true, help: "Shorthand works: 3cr, 45L, 1.2m, 850k." },
        ] },
        { id: "job", title: "The job it has to do", fields: [
          { k: "decision.purpose", t: "choice", label: "Purpose", opts: O.purpose, wide: true, req: true },
          { k: "decision.status", t: "choice", label: "Ready?", opts: O.status, req: true },
          { k: "decision.occupancy", t: "choice", label: "Occupancy", opts: O.occupancy, req: true },
          { k: "decision.holding_years", t: "num", label: "Expected hold", unit: "years", req: true, unk: true },
          { k: "decision.move_risk", t: "choice", label: "Relocation within 3–5 years?", opts: O.move, unk: true },
          { k: "decision.job", t: "area", label: "What job is this property supposed to do?", help: "Housing and stability? Income? Appreciation? A mixture? Say it in a sentence or two.", wide: true, req: true, rows: 2 },
        ] },
        { id: "who", title: "Who is deciding", collapsed: true, fields: [
          { k: "meta.people", t: "text", label: "Working through this", ph: "e.g. Asha & Vikram, with our adviser" },
          { k: "meta.date", t: "date", label: "Date" },
        ] },
      ],
    },
    {
      id: "place", n: 2, title: "Country, city & location", short: "Location",
      ask: "What system, city and location am I buying into?",
      intro: "Country context informs the prior; it does not decide this property. Record only what could materially change this case: then test the location story you are relying on.",
      groups: [
        { id: "system", title: "The housing system", custom: "countryContext",
          why: "The Housing System Fingerprint describes the machine (demand, supply, mortgage structure, title) not what one apartment will do. Farther left or right on a spectrum is not better; it is different.",
          fields: [
            { k: "market.system.key_feature", t: "area", label: "Which system feature could materially change this decision?", wide: true, rows: 2, unk: true, help: "For example: floating-rate loans, thin resale markets, buyer-side title verification, presale project finance." },
          ],
          more: { label: "Notes on each part of the system", custom: "systemNotes" },
        },
        { id: "city", title: "The city and location", custom: "signals",
          why: "National urbanisation can create a tailwind without every city, suburb or project capturing it. Rents are often the most honest signal: they show what people pay to use the place, not what they hope it is worth later.",
          fields: [
            { k: "market.city_stage", t: "choice", label: "Location stage", opts: O.cityStage, wide: true },
            { k: "market.priced_in", t: "area", label: "What part of the city story is already reflected in today's price?", wide: true, rows: 2, unk: true },
          ] },
        { id: "destinations", title: "Effective access", custom: "destinations",
          lead: "Straight-line distance, map distance and real accessibility are different metrics.",
          why: "Economic location is how easily the life you actually lead can be reached from here: at the hours you travel, by the routes that exist. Kilometres hide peak-hour traffic, a poor last mile, or a single road in." },
        { id: "scenarios", title: "Stress-test the location thesis", custom: "scenarios",
          lead: "Three ways the location story can play out. No probabilities: just two questions.",
          why: "A location thesis is usually told as Scenario A. Most of the useful information is in B and C: whether you would still want to own it if the upside is shared with new supply, and whether you could live with it if the story disappoints.",
          fields: [
            { k: "thesis.happy_b", t: "choice", label: (c) => "Would I still be happy owning this " + (homeish(c) ? "home" : "property") + " under Scenario B?", opts: O.scenario, req: true },
            { k: "thesis.survive_c", t: "choice", label: "Can my finances and life plans comfortably survive Scenario C?", opts: O.scenario, req: true },
            { k: "thesis.note", t: "area", label: "Why?", wide: true, rows: 2 },
          ] },
      ],
    },
    {
      id: "property", n: 3, title: "The property", short: "Property",
      ask: "What am I buying, and what evidence supports the price?",
      intro: "Keep the property return, the financing return and housing consumption separate. Do not manufacture a point 'fair value': if comparable evidence is thin, write that down. Unknown is an answer.",
      groups: [
        { id: "buying", title: "What exactly are you buying?", fields: [
          { k: "property.components", t: "multi", label: "Which of these are you paying for?", opts: O.components, wide: true },
          { k: "property.components_note", t: "area", label: "In your words", rows: 2, wide: true, ph: "Land share, building quality, the location's usefulness, rights, what could change…" },
          { k: "property.return_engine", t: "multi", label: "Which component is expected to create the return?", opts: O.engines, wide: true, req: true, unk: true,
            help: "Every price forecast is a driver forecast in disguise." },
        ] },
        { id: "evidence", title: "Price evidence", custom: "comps",
          why: "A listing is what a seller hopes for. A recent registered transaction for a genuinely similar unit is what a buyer actually paid. Two good comparables beat ten loose ones.",
          fields: [
            { k: "property.price_evidence", t: "choice", label: "Price evidence quality", opts: O.evidence, hint: "evidence", req: true },
            { k: "property.title_status", t: "choice", label: "Title / documentation / approvals", opts: O.resolved, req: true },
            { k: "property.title_note", t: "text", label: "What is still open?", wide: true, ph: "e.g. society NOC pending; encumbrance check not yet done" },
          ] },
        { id: "services", title: "Water, access and essential services",
          lead: "Ownership rights and functional control are not always the same thing.",
          why: "You can hold clear title to a home you cannot reliably reach, supply or service. These are diligence prompts, not legal advice; the usual sources are your lawyer, the society or association, the utility and the neighbours.",
          fields: [
            { t: "sub", label: "Water security" },
            { k: "water.source", t: "choice", label: "Primary water source", opts: waterSourceOpts, wide: true, req: true },
            { t: "note", text: "Low water cost today does not prove long-term water security." },
            { k: "water.reliability", t: "choice", label: "How reliable has supply been, especially in the dry season?", opts: O.waterReliability, unk: true },
            { k: "water.tanker", t: "choice", label: (c) => "How dependent is the property on " + waterTerms(c).truckNoun + "?", opts: O.tanker, unk: true },
            { k: "water.monthly_cost", t: "money", label: "What does current water dependence cost?", unit: "/ month", help: "Utility bills, water deliveries, treatment, pumping." },
            { k: "water.future_connection", t: "choice", label: "Am I assuming a future municipal / piped connection that doesn't exist today?", opts: O.futureConn },
            { k: "water.failure", t: "area", label: "What happens if the primary source fails, and is there adequate storage or backup?", wide: true, rows: 2, unk: true, ph: "Sump and overhead capacity, a second source, how many days you could manage…" },
            { t: "sub", label: "Access and dependencies" },
            { k: "access.legal", t: "choice", label: "Does the property have clear, legally documented access?", opts: O.legalAccess, req: true, unk: true },
            { k: "access.year_round", t: "choice", label: "Is the final approach usable and reliable year-round?", opts: O.yearRound },
            { k: "access.road", t: "choice", label: "Is the access road public, private, shared or dependent on another landowner?", opts: O.road, wide: true },
            { k: "access.third_party", t: "choice", label: "Does normal use of the property (or an essential utility or service) depend on neighbours, other owners or arrangements outside your control?", opts: O.thirdParty, wide: true, unk: true },
            { k: "access.dependency_note", t: "area", label: "What depends on someone else, and on what terms?", wide: true, rows: 2, show: (c) => ["some", "material", "unknown"].indexOf((c.access || {}).third_party) >= 0,
              ph: "e.g. a shared borewell, a society-run treatment plant, a road maintained by the neighbouring layout, power through another plot" },
          ],
          more: { label: "Water quality and treatment", fields: [
            { k: "water.treatment", t: "choice", label: "Does the water need significant treatment?", opts: O.treatment, wide: true },
            { k: "water.quality", t: "area", label: "Any known groundwater or water-quality concerns?", wide: true, rows: 2, unk: true,
              help: "Don't infer groundwater security from borewell depth. Ask about the last two dry seasons, neighbours' wells and any test reports." },
          ] } },
        { id: "economics", title: "Property economics", calc: "economics",
          why: "Gross rental yield ≈ 12 × monthly rent ÷ price. Cash needed now ≈ price + acquisition and initial work − loan. These are hand checks, not a model.",
          fields: [
            { k: "property.acq_total", t: "money", label: "Acquisition costs", help: "Stamp, registration, brokerage, legal, loan fees." },
            { k: "property.initial_work", t: "money", label: "Initial work / fit-out" },
            { k: "property.expected_monthly_rent", t: "money", label: "Monthly rent", unit: "/ month", help: "Expected rent, or, for a home, the equivalent market rent.", unk: true },
            { k: "property.owner_annual", t: "money", label: "Annual owner costs", unit: "/ year", help: "Maintenance, taxes, repairs, insurance." },
          ],
          more: { label: "Exit assumptions (optional)", fields: [
            { k: "property.exit_cost_pct", t: "pct", label: "Selling costs", unit: "% of price", help: "Brokerage, legal and any tax on sale." },
            { k: "property.sale_value", t: "money", label: "Expected sale value at horizon", help: "A scenario, not a forecast." },
          ] },
        },
        { id: "rental", title: "If it's a rental: the business without appreciation", show: letting,
          why: "Rent less vacancy, maintenance, repairs, management, taxes and eventual capital expenditure. A weak answer does not make the property unattractive; it tells you appreciation is doing more of the work than income.",
          fields: [
            { k: "property.rental_without_appr", t: "area", label: "Does the rental business make sense if the property never appreciates?", wide: true, rows: 3, unk: true, ph: "What makes the rental economics work, or why the case still relies on appreciation." },
          ] },
        { id: "uc", title: "Under construction: underwriting, not inspection", show: isUC, calc: "uc",
          why: "The less finished the asset, the more of the decision belongs to underwriting rather than inspection. Registration makes information available; information is not certainty.",
          fields: [
            { k: "uc.developer", t: "area", label: "Developer / project execution evidence", wide: true, rows: 2, unk: true, ph: "Delivery record, current project load, funding position…" },
            { k: "uc.stage", t: "text", label: "Project stage", ph: "e.g. structure complete to 12th floor" },
            { k: "uc.possession", t: "month", label: "Promised possession" },
            { k: "uc.registration", t: "choice", label: "Registration / approvals / title", opts: O.resolved, wide: true },
            { k: "uc.ready_alt_price", t: "money", label: "Comparable ready property: all-in", unk: true },
            { k: "uc.delay_cost", t: "money", label: "If possession is 24 months late: extra rent + finance + lost rent", help: "Leave blank to use the rough estimate below." },
            { k: "uc.worth_it", t: "choice", label: "Is the discount still worth the unresolved uncertainty?", opts: O.yesUnsureNo, wide: true },
          ] },
      ],
    },
    {
      id: "financing", n: 4, title: "Financing", short: "Financing",
      ask: "How much leverage am I taking?",
      intro: "The best property thesis is of limited use if the financing does not let you stay invested long enough for it to play out.",
      groups: [
        { id: "loan", title: "The loan", calc: "financing", fields: [
          { k: "financing.mode", t: "choice", label: "Funding", opts: O.fundMode, req: true },
          { k: "financing.loan_amount", t: "money", label: "Loan", show: loan, req: true },
          { k: "financing.rate", t: "pct", label: "Interest rate", unit: "% a year", show: loan },
          { k: "financing.rate_type", t: "choice", label: "Rate type", opts: O.rateType, show: loan },
          { k: "financing.tenure_years", t: "num", label: "Tenure", unit: "years", show: loan },
          { k: "financing.emi", t: "money", label: "Scheduled EMI", unit: "/ month", show: loan, help: "Leave blank to calculate from the loan, rate and tenure." },
          { k: "financing.other_housing_cost", t: "money", label: "Other continuing housing cost", unit: "/ month", help: "Existing EMI, or rent you keep paying until possession." },
        ],
          more: { label: "Rate reset / prepayment terms", show: loan, fields: [
            { k: "financing.reset_note", t: "area", label: "Any rate-reset or prepayment issue that matters?", wide: true, rows: 2, unk: true },
          ] } },
        { id: "stay", title: "Can the financing let you stay invested?", fields: [
          { k: "financing.stay_invested", t: "area", label: "Would a flat five-year market create a cash-flow problem, a forced sale, or simply disappointment?", wide: true, rows: 3, req: true, unk: true },
        ] },
      ],
    },
    {
      id: "household", n: 5, title: "Your household", short: "Household",
      ask: "What happens to my liquidity and concentration?",
      intro: "A household can become wealthier on paper and less flexible at the same time. Rough figures are fine; this is a balance-sheet sketch, not a tax return.",
      groups: [
        { id: "balance", title: "Before and after the purchase", calc: "balance", fields: [
          { k: "household.income", t: "money", label: "Monthly after-tax household income", unit: "/ month", req: true },
          { k: "household.existing_debt_service", t: "money", label: "Existing monthly debt service", unit: "/ month" },
          { k: "household.liquid", t: "money", label: "Liquid assets", req: true, help: "Cash and readily accessible savings, including what's set aside for this purchase." },
          { k: "household.financial", t: "money", label: "Long-term financial assets", help: "Investments and retirement savings." },
          { k: "household.existing_re_value", t: "money", label: "Existing real-estate value" },
          { k: "household.existing_re_debt", t: "money", label: "Existing real-estate debt" },
          { k: "constraints.min_liquid", t: "money", label: "Minimum liquidity I want to preserve", help: "Your own red line, not a universal threshold.", req: true },
          { k: "household.living_expenses", t: "money", label: "Monthly living costs", unit: "/ month", help: "Excluding housing debt. Used for the income-stops test." },
        ],
          more: { label: "Funding from long-term assets · known future outlays", fields: [
            { k: "household.from_long_term", t: "money", label: "Of the cash needed, how much comes from long-term investments?" },
            { k: "household.outlays_note", t: "area", label: "Known future outlays", rows: 2, wide: true, ph: "Education, caregiving, retirement, business, other: roughly how much and when." },
          ] } },
        { id: "exposure", title: "Concentration and lost options", fields: [
          { k: "household.city_exposure", t: "area", label: "How much of our financial life will depend on the same city?", rows: 2, wide: true, ph: "Employment + property + other exposure", unk: true },
          { k: "household.options_lost", t: "multi", label: "What financial options disappear after this purchase?", opts: O.optionsLost, wide: true },
          { k: "household.options_other", t: "text", label: "Other option lost", show: (c) => ((c.household || {}).options_lost || []).indexOf("other") >= 0, wide: true },
          { k: "household.need_capital", t: "choice", label: "Could we need this capital within the holding period?", opts: O.likelihood, unk: true },
          { k: "household.need_capital_why", t: "text", label: "Why?", ph: "e.g. business plans, parents' care" },
        ] },
      ],
    },
    {
      id: "life", n: 6, title: "Life & alternatives", short: "Life",
      ask: "What am I buying for my life, and what would I genuinely do instead?",
      intro: "A primary home does not have to be your highest-returning asset. But its non-financial value should be named rather than quietly counted as financial return.",
      groups: [
        { id: "zat", title: "The Zero-Appreciation Test",
          why: "If this home never appreciated in real terms, would you still want it? A clear yes means the purchase stands on its utility. A no means appreciation is carrying the decision: worth knowing before you buy.",
          fields: [
            { k: "life.zat", t: "choice", label: (c) => homeish(c) ? "If this home never appreciated in real terms, would you still want it?" : "If this property never appreciated in real terms, would you still want to own it?", opts: O.zat, wide: true, req: true },
            { k: "life.zat_why", t: "multi", label: "Why?", opts: O.utility, wide: true, show: (c) => homeish(c) },
            { k: "life.life_problem", t: "area", label: "The life problem this property solves", wide: true, rows: 2, show: (c) => homeish(c) },
          ] },
        { id: "enough", title: "The Enough-House Problem", show: homeish, calc: "premium",
          why: "The gap between the least expensive home that would genuinely satisfy you and this one is the Housing-Consumption Premium. It can be worth paying, but it is paid with liquidity, savings, flexibility, lower leverage or earlier financial independence.",
          fields: [
            { k: "life.enough_price", t: "money", label: "Least expensive home that would genuinely satisfy us", unk: true },
            { k: "life.enough_rent", t: "money", label: "…or its rent", unit: "/ month" },
            { k: "life.premium_buys", t: "multi", label: "What does the premium buy?", opts: O.premiumBuys, wide: true },
            { k: "life.premium_costs", t: "multi", label: "What does paying it cost us elsewhere?", opts: O.premiumCosts, wide: true },
          ] },
        { id: "alt", title: "The realistic alternative",
          why: "Do not compare with an imaginary perfect alternative. Rent-and-invest only counts if you would actually invest the difference; if in real life it would be rent-and-spend, compare against that.",
          fields: [
            { k: "life.alt_type", t: "choice", label: "If we don't buy this, we would most likely…", opts: O.alt, wide: true, req: true },
            { k: "life.alt_note", t: "area", label: "What would we genuinely do instead?", wide: true, rows: 2 },
          ],
          more: { label: "Compare it with this property", fields: [
            { k: "life.alt_compare.cash", t: "text", label: "Cash required today", wide: true },
            { k: "life.alt_compare.monthly", t: "text", label: "Monthly cash outflow", wide: true },
            { k: "life.alt_compare.liquidity", t: "text", label: "Liquidity / flexibility", wide: true },
            { k: "life.alt_compare.utility", t: "text", label: "Housing utility / stability", wide: true },
            { k: "life.alt_compare.friction", t: "text", label: "Likely holding period / transaction friction", wide: true },
          ] } },
      ],
    },
    {
      id: "stress", n: 7, title: "Zero appreciation & stress", short: "Stress",
      ask: "Can the household survive disappointment?",
      intro: "The question is not only how likely a bad outcome is. It is what happens to you if it occurs: risk capacity, not risk prediction.",
      groups: [
        { id: "dependency", title: "Appreciation dependency", calc: "friction",
          why: "How much future appreciation have you already spent in order to justify today's decision? Appreciation dependency is judged against your own objective: Low if the job is still done at zero appreciation; High if only an upside makes it work.",
          fields: [
            { k: "dependency.zero_ok", t: "choice", label: "With zero or weak appreciation, does the purchase still achieve its stated job?", opts: O.yesPartlyNo, wide: true, req: true },
            { k: "dependency.implied_appr", t: "pct", label: "What annual appreciation are you implicitly relying on?", unit: "% / year", unk: true },
            { k: "dependency.engine_note", t: "text", label: "What actually has to create that return?", wide: true, ph: "The driver, not the hope" },
            { k: "dependency.key_assumption", t: "area", label: "Which single assumption does this purchase depend on most?", wide: true, rows: 2, req: true },
          ] },
        { id: "tests", title: "Stress tests", custom: "stress",
          why: "Each line asks: what happens to cash flow and liquidity, and does anything break? 'Break' means a forced sale, new debt, or selling long-term assets you meant to keep." },
        { id: "forcing", title: "What would force your hand?", fields: [
          { k: "stress.shock_amount", t: "money", label: "Unexpected cash need" },
          { k: "stress.shock_source", t: "text", label: "Would the cash come from…", ph: "Savings? Investments? Family? A loan?" },
          { k: "stress.forcing", t: "area", label: "Which stress would force a sale, new debt, or liquidation of long-term assets?", wide: true, rows: 2, req: true, unk: true },
        ] },
        { id: "walkaway", title: "Walk-away conditions", custom: "walkaway",
          why: "Define these before the emotional case gets stronger. They are your conditions, not universal thresholds. A good walk-away condition is specific enough that you would recognise it when it happens. Each one reappears in Chapter 8 as one of your non-negotiables." },
      ],
    },
    {
      id: "read", n: 8, title: "Your read", short: "Your read",
      ask: "What is this purchase, really?",
      intro: "No score and no verdict. Write the profile in your own words: the summary is built from what you say here.",
      groups: [
        { id: "thesis", title: "The hidden thesis", fields: [
          { k: "close.works_if", t: "area", label: "This purchase works if…", wide: true, rows: 2, req: true },
          { k: "close.struggles_if", t: "area", label: "It struggles if…", wide: true, rows: 2, req: true },
          { k: "close.reasons", t: "lines", label: "Strongest reasons to buy", help: "One per line.", rows: 3 },
          { k: "close.risks", t: "lines", label: "Main risks and concerns", help: "One per line. Stresses that break, failing gates and water or access warnings are added automatically.", rows: 3 },
        ] },
        { id: "gates", title: "Non-negotiables and preferences", custom: "gates",
          lead: "A serious failure in a non-negotiable is not offset by strengths elsewhere. It is resolved, or it is a reason to walk away.",
          why: "Lifestyle positives and price trade-offs can be weighed against each other. Non-negotiables cannot: no amount of view, space or upside compensates for a home you cannot legally reach, reliably supply with water, or afford to keep through a bad patch. Demote a gate to 'Preference only' if, for you, it genuinely is one.",
          fields: [
            { k: "close.preferences", t: "lines", label: "Preferences and trade-offs: things we'd like but could live without", help: "One per line. These are weighed; non-negotiables are not.", rows: 3, wide: true },
          ] },
        { id: "profile", title: "Decision profile: no score, no verdict", custom: "profile",
          why: "Each read is yours. Where your answers point somewhere, the worksheet says so; you decide whether it's right." },
        { id: "open", title: "Open questions and next diligence", custom: "openQuestions",
          why: "Anything you marked 'Not sure yet' is listed below. Promote the ones that matter into a question with an owner, so the uncertainty becomes a to-do list." },
        { id: "statement", title: "Decision statement", custom: "statementPreview", fields: [
          { k: "close.primarily", t: "text", label: "This is primarily a … purchase", ph: "e.g. high-utility housing · income-led investment · appreciation-led, highly leveraged", req: true },
          { k: "close.tradeoff", t: "text", label: "The key trade-off is…", ph: "e.g. liquid wealth exchanged for permanence and location", req: true },
          { k: "close.still_need", t: "area", label: "What I still need to know before deciding", wide: true, rows: 2 },
        ] },
      ],
    },
  ];

  /* ---------- The tests (landing) ------------------------------------ */
  const TESTS = [
    ["What exactly am I buying?", "property"],
    ["Do I control what I need to use it: water, access, services?", "property"],
    ["What creates the expected return?", "property"],
    ["What evidence supports today's price?", "property"],
    ["What if the location story only half-works?", "place"],
    ["What happens if real appreciation is zero?", "life"],
    ["How much leverage am I taking?", "financing"],
    ["What happens to my liquidity?", "household"],
    ["What happens to concentration?", "household"],
    ["What happens if income stops?", "stress"],
    ["What if the property is vacant?", "stress"],
    ["What if an under-construction project is delayed?", "stress"],
    ["What assumption does this purchase depend on most?", "stress"],
    ["What would make me walk away?", "stress"],
  ];

  /* ---------- Article 14's two households --------------------------- */
  // Same country, city, apartment and price; the Person layer differs.

  const sharedMarket = () => ({
    country: "IN", currency: "INR", city: "An Indian metro (illustrative)", micro_market: "Established residential neighbourhood", city_stage: "mid",
    signals: {
      jobs: { status: "strong", note: "Large employment cluster within 30 minutes" },
      migration: { status: "strong", note: "" },
      incomes: { status: "mixed", note: "Prices have outpaced local incomes" },
      supply: { status: "high", note: "Several new towers launching nearby" },
      infrastructure: { status: "improving", note: "Metro extension announced; timeline unclear" },
      rents: { status: "mixed", note: "Rents rising, yields still low" },
    },
    system: {
      key_feature: "Floating-rate home loans: a rate rise passes straight into the EMI. Title verification sits largely with the buyer.",
      demand: "Urbanisation still adds households to this metro.", supply: "Supply responds slowly and unevenly, but new towers are coming nearby.",
      mortgage: "Floating, repo-linked; resets within months of a policy move.", institutions: "Buyer carries more of the verification burden; registration formalises the sale.",
    },
    priced_in: "The metro extension is widely discussed. We assume at least part of it is already in today's price.",
  });

  const sharedProperty = () => ({
    name: "3-bed apartment, 6 years old, 1,650 sq ft carpet", purchase_price: 30000000,
    components: ["land", "structure", "location", "legal"],
    components_note: "An undivided land share in a mature complex, a six-year-old structure, and the location's access to jobs and schools.",
    comps: [
      { price: 28500000, date: "2026-05", similarity: "high", kind: "transaction", note: "Same building, 4th floor" },
      { price: 31000000, date: "2026-02", similarity: "high", kind: "transaction", note: "Adjacent tower" },
    ],
    price_evidence: "strong", acq_total: 2180000, expected_monthly_rent: 75000, owner_annual: 165000, exit_cost_pct: 2,
  });

  const sharedServices = () => ({
    water: { source: "combination", reliability: "seasonal", tanker: "occasional", monthly_cost: 3500, future_connection: "no", treatment: "some",
      failure: "Piped supply backs onto the society borewell; a two-day sump plus overhead tanks. In May the society buys two tankers a week." },
    access: { legal: "clear", road: "public", year_round: "yes", third_party: "none" },
  });

  const EXAMPLES = {
    A: {
      meta: { name: "Household A: the long-stay family", example: "A", people: "Example from Article 14" },
      destinations: [
        { dest: "Work (both offices)", distance: "12 km", normal: "30 min", peak: "55 min", lastmile: "Arterial road, good", alt: "yes" },
        { dest: "School", distance: "2 km", normal: "8 min", peak: "15 min", lastmile: "Quiet residential street", alt: "yes" },
        { dest: "Hospital", distance: "4 km", normal: "12 min", peak: "25 min", lastmile: "Good", alt: "yes" },
        { dest: "Airport", distance: "38 km", normal: "55 min", peak: "1 h 50 min", lastmile: "Expressway with one choke point", alt: "partly" },
      ],
      decision: { purpose: "home", status: "ready", occupancy: "self", holding_years: 20, move_risk: "low",
        job: "A stable family home near the children's school for the next twenty years. Return is secondary: it must simply not damage our financial plan." },
      market: sharedMarket(),
      property: Object.assign(sharedProperty(), {
        return_engine: ["land", "jobs", "inflation"], initial_work: 1000000,
        title_status: "partly", title_note: "Society transfer NOC still pending; property-tax dues not yet confirmed.",
      }),
      financing: { mode: "loan", loan_amount: 9000000, rate: 8.5, rate_type: "floating", tenure_years: 20, other_housing_cost: 0,
        reset_note: "Repo-linked floating rate; prepayment without penalty.",
        stay_invested: "Simply disappointment. The EMI is small against our income and liquidity sits outside the house." },
      household: { income: 600000, existing_debt_service: 0, liquid: 30000000, financial: 80000000, existing_re_value: 0, existing_re_debt: 0,
        living_expenses: 225000, outlays_note: "Children's university: roughly ₹80 L in about nine years.",
        city_exposure: "Both incomes are in this city, and this would be our only property.", options_lost: ["portfolio"], need_capital: "unlikely",
        need_capital_why: "University costs are planned from long-term investments." },
      constraints: { min_liquid: 2500000 },
      ...sharedServices(),
      thesis: { happy_b: "yes", survive_c: "yes", note: "We're buying for the school and the commute, so B is fine. C would hurt resale value, but we don't plan to sell and nothing in C forces us to." },
      life: { zat: "yes", zat_why: ["location", "school", "family", "permanence", "control"],
        life_problem: "Ends the cycle of renting and moving while the children are in school.",
        enough_price: 22000000, enough_rent: 55000, premium_buys: ["space", "location"], premium_costs: ["liquidity"],
        alt_type: "rent", alt_note: "Rent a similar flat nearby and keep the capital invested, and we genuinely would invest it.",
        alt_compare: { cash: "About ₹2.4 Cr less tied up today", monthly: "Rent ≈ ₹75k vs EMI ≈ ₹78k plus owner costs", liquidity: "Far higher if we rent", utility: "Lower: the landlord decides how long we stay", friction: "None to exit; buying costs ≈ 7% of price" } },
      dependency: { zero_ok: "yes", implied_appr: 5, engine_note: "Land in an established neighbourhood, carried by local job growth",
        key_assumption: "That we really stay fifteen to twenty years. An early move turns a housing decision into a short-hold trade with heavy transaction costs." },
      stress: {
        flat: { note: "Disappointing. Nothing changes in cash flow.", breaks: "no" },
        fall: { note: "A paper loss. No reason or need to sell.", breaks: "no" },
        rate: { note: "EMI rises by roughly ₹11k a month, absorbed by income.", breaks: "no" },
        income: { note: "Post-purchase liquidity covers well over a year of outgoings.", breaks: "no" },
        shock_amount: 5000000, shock_source: "Long-term investments, not the house.",
        forcing: "Only a long income loss arriving alongside the university outlay. Even then, investments (not the home) would be sold.",
      },
      walkaway: ["the society NOC is not issued before the agreement is signed", "the all-in cost goes above ₹3.35 Cr", "post-purchase liquid assets would fall below ₹25 L"],
      close: {
        works_if: "we stay for most of the next twenty years and keep a real liquidity buffer outside the house.",
        struggles_if: "we have to move within five years, or the comfort of owning tempts us into a second, leveraged property.",
        reasons: "The location solves the school and commute problem for a decade\nThe loan is modest and the EMI is small against income\nIt still works if prices go nowhere",
        risks: "Most of our liquid savings move into an illiquid home\nBoth incomes and the house depend on one city",
        profile: { price_evidence: "strong", appr_dependency: "low", leverage: "low", liquidity: "manageable", concentration: "deliberate", utility: "strong", execution: "partly" },
        open: [
          { q: "Is the society transfer NOC confirmed?", who: "Seller and society secretary: before the agreement" },
          { q: "Are property-tax and society dues clear?", who: "Ask the seller for receipts; check with the municipality" },
        ],
        gates: { title: "open", access: "clear", water: "clear", financing: "clear", wa0: "open", wa1: "clear", wa2: "clear" },
        preferences: "A higher floor\nA second covered parking space",
        primarily: "high-utility housing",
        tradeoff: "liquid wealth exchanged for permanence, schools and location",
        still_need: "Written confirmation of the society NOC and the dues position.",
      },
      unknown: {},
    },
    B: {
      meta: { name: "Household B: the leveraged bet", example: "B", people: "Example from Article 14" },
      destinations: [
        { dest: "Work", distance: "21 km", normal: "45 min", peak: "1 h 30 min", lastmile: "Single arterial road; metro would change this", alt: "no" },
        { dest: "Future metro station", distance: "1.5 km", normal: "—", peak: "—", lastmile: "Not built yet", alt: "" },
      ],
      decision: { purpose: "speculative", status: "ready", occupancy: "rent", holding_years: 4, move_risk: "plausible",
        job: "A bet that the neighbourhood re-rates once the metro extension opens. Rent should cover part of the EMI in the meantime." },
      market: sharedMarket(),
      property: Object.assign(sharedProperty(), {
        return_engine: ["infrastructure", "belief"], initial_work: 300000, title_status: "unknown",
        title_note: "Encumbrance, approvals and occupancy certificate not yet checked.",
        rental_without_appr: "Not really. Net yield after costs is around 2.5% against an 8.75% loan; the case relies on appreciation.",
      }),
      financing: { mode: "loan", loan_amount: 24000000, rate: 8.75, rate_type: "floating", tenure_years: 20, other_housing_cost: 0,
        stay_invested: "A flat market would be a cash-flow problem: rent covers well under half the EMI, and we planned to sell in four years." },
      household: { income: 400000, existing_debt_service: 55000, liquid: 4000000, financial: 6000000, existing_re_value: 15000000, existing_re_debt: 6000000,
        living_expenses: 140000, from_long_term: 5000000,
        city_exposure: "Our income, our current home and this purchase are all in the same city.", options_lost: ["portfolio", "smaller_mortgage", "retire"], need_capital: "plausible",
        need_capital_why: "A job move within three years is plausible." },
      constraints: { min_liquid: 400000 },
      ...sharedServices(),
      thesis: { happy_b: "no", survive_c: "no", note: "Under B we'd hold a low-yield flat on a large loan for no real gain. Under C we would probably be forced sellers into a weak resale market." },
      life: { zat: "no", alt_type: "invest", alt_note: "Keep the ₹50 L in our existing investments and stay put." },
      dependency: { zero_ok: "no", implied_appr: 9, engine_note: "The metro extension changing the economic location: if it isn't already priced in",
        key_assumption: "That prices rise sharply within four years. Everything else (the EMI gap, the transaction costs, the exit) depends on it." },
      stress: {
        flat: { note: "Four years of EMI top-ups; selling at the same price loses the buying and selling costs.", breaks: "yes" },
        fall: { note: "Equity falls below the loan's cushion; a sale would not repay the loan with much left.", breaks: "yes" },
        rate: { note: "EMI rises by roughly ₹30k a month on top of the existing gap.", breaks: "maybe" },
        income: { note: "Liquidity left after purchase covers about a month of outgoings.", breaks: "yes" },
        vacancy: { note: "Six months of full EMI with no rent.", breaks: "maybe" },
        shock_amount: 1000000, shock_source: "New borrowing, or selling the remaining investments.",
        forcing: "Almost any of them: income loss, a flat market or a long vacancy would force new debt or a sale.",
      },
      walkaway: ["the metro extension timeline slips past our four-year horizon", "rent would cover less than half the EMI", "liquid assets after purchase fall below ₹4 L"],
      close: {
        works_if: "prices rise quickly once the metro opens, rates stay where they are, and we can sell within four years.",
        struggles_if: "the market goes flat, rates rise, the flat sits vacant, or a job move forces an early sale.",
        reasons: "If the metro re-rates the area, leverage multiplies the gain",
        risks: "Leverage of 80% on a variable income\nThin liquidity after purchase\nInfrastructure may already be in the price",
        profile: { price_evidence: "strong", appr_dependency: "high", leverage: "high", liquidity: "tension", concentration: "uncomfortable", utility: "na", execution: "unknown" },
        open: [
          { q: "When will the metro extension actually open?", who: "Metro authority's published timeline; local news" },
          { q: "Encumbrance, approvals and occupancy certificate", who: "A property lawyer, before any token payment" },
          { q: "What rent does the building actually achieve?", who: "Two local brokers; recent leases in the complex" },
        ],
        gates: { title: "open", access: "clear", water: "clear", financing: "fails", wa0: "open", wa1: "fails", wa2: "open" },
        preferences: "Metro station within walking distance",
        primarily: "appreciation-led, highly leveraged",
        tradeoff: "financial resilience exchanged for a leveraged bet on infrastructure",
        still_need: "Whether the household can absorb a flat market for four years without new debt.",
      },
      unknown: { "decision.move_risk": true },
    },
  };

  return { O, ARTICLE, WATER_TERMS, waterTerms, waterSourceOpts, SCENARIOS, GATES, DESTINATIONS, SIGNALS, PROFILE, STRESSES, FP_DIMS, COUNTRIES, CURRENCIES, SYSTEM_PROMPTS, CHAPTERS, TESTS, EXAMPLES, helpers: { isUC, loan, letting, homeish, investish } };
});
