/* ============================================================
   Property Decision Worksheet — hand checks
   The few calculations the worksheet genuinely needs. Pure
   functions, no DOM; runs in the browser and in Node.
   Every result is a rough hand check, not a model: the X-Ray
   does the deeper arithmetic.
   ============================================================ */

(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WSCalc = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const num = (v) => (v === null || v === undefined || v === "" || isNaN(+v) ? null : +v);
  const has = (v) => num(v) !== null;
  const z = (v) => num(v) || 0;

  // Same amortising-payment formula as the X-Ray engine.
  function emi(L, ratePct, months) {
    if (!L || !months) return 0;
    const r = ratePct / 1200;
    if (Math.abs(r) < 1e-12) return L / months;
    return (L * r) / (1 - Math.pow(1 + r, -months));
  }

  // Derive everything once from a worksheet. Fields stay null when the
  // inputs they need are missing, so the UI can say "add X to see this".
  function derive(c) {
    const p = c.property || {}, f = c.financing || {}, h = c.household || {}, d = c.decision || {};
    const life = c.life || {}, uc = c.uc || {}, k = c.constraints || {};
    const out = {};

    const price = num(p.purchase_price);
    out.price = price;
    out.acqAll = has(p.acq_total) || has(p.initial_work) ? z(p.acq_total) + z(p.initial_work) : null;
    out.allIn = price !== null ? price + z(out.acqAll) : null;

    // Financing
    const isLoan = f.mode === "loan";
    out.isLoan = isLoan;
    out.loan = isLoan ? num(f.loan_amount) : 0;
    out.downPayment = price !== null && out.loan !== null ? price - out.loan : null;
    out.ltv = price && out.loan !== null && isLoan ? out.loan / price : null;
    const months = has(f.tenure_years) ? Math.round(z(f.tenure_years) * 12) : null;
    out.emiCalc = isLoan && out.loan && has(f.rate) && months ? emi(out.loan, +f.rate, months) : null;
    out.emi = isLoan ? (has(f.emi) ? +f.emi : out.emiCalc) : 0;
    out.emiSource = isLoan ? (has(f.emi) ? "entered" : out.emiCalc !== null ? "calculated" : null) : null;
    out.rateShockApplies = isLoan && f.rate_type !== "fixed";
    out.emiPlus2 = isLoan && out.loan && has(f.rate) && months ? emi(out.loan, +f.rate + 2, months) : null;
    out.emiPlus2Delta = out.emiPlus2 !== null && out.emiCalc !== null ? out.emiPlus2 - out.emiCalc : null;

    // Cash at acquisition and what it does to liquidity
    out.cashNeeded = price !== null && out.loan !== null ? price + z(out.acqAll) - z(out.loan) : null;
    const fromLT = Math.min(z(h.from_long_term), z(out.cashNeeded));
    out.fromLongTerm = fromLT;
    out.postLiquid = has(h.liquid) && out.cashNeeded !== null ? +h.liquid - (out.cashNeeded - fromLT) : null;
    out.postFinancial = has(h.financial) ? +h.financial - fromLT : null;
    out.minLiquid = num(k.min_liquid);
    out.belowFloor = out.postLiquid !== null && out.minLiquid !== null ? out.postLiquid < out.minLiquid : null;

    // Monthly picture
    const income = num(h.income);
    out.income = income;
    out.monthlyHousingDebt = z(out.emi) + z(h.existing_debt_service);
    out.debtServiceRatio = income ? out.monthlyHousingDebt / income : null;
    out.emiPlus2Ratio = income && out.emiPlus2 !== null ? (out.emiPlus2 + z(h.existing_debt_service)) / income : null;
    out.monthlyBurn = has(h.living_expenses) ? +h.living_expenses + out.monthlyHousingDebt + z(f.other_housing_cost) + z(p.owner_annual) / 12 : null;
    out.monthsCovered = out.postLiquid !== null && out.monthlyBurn ? Math.max(0, out.postLiquid) / out.monthlyBurn : null;
    out.incomeGap12 = out.monthlyBurn !== null && out.postLiquid !== null ? 12 * out.monthlyBurn - Math.max(0, out.postLiquid) : null;

    // Rental hand checks
    const rent = num(p.expected_monthly_rent);
    out.rent = rent;
    out.grossYield = price && rent !== null ? (12 * rent) / price : null;
    out.netYield = price && rent !== null ? (12 * rent - z(p.owner_annual)) / price : null;
    out.rentCoversEmi = rent !== null && out.emi ? rent / out.emi : null;
    out.vacancy6 = rent !== null ? 6 * rent : null;
    out.vacancy6Carry = rent !== null ? 6 * (z(out.emi) + z(p.owner_annual) / 12) : null;

    // Price stress
    out.valueAfterFall = price !== null ? price * 0.8 : null;
    out.equityAfterFall = price !== null && out.loan !== null ? price * 0.8 - z(out.loan) : null;
    out.equityAtStart = price !== null && out.loan !== null ? price - z(out.loan) : null;

    // Transaction friction: what appreciation merely recovers buying and selling costs?
    const hold = num(d.holding_years);
    const exitPct = z(p.exit_cost_pct) / 100;
    out.exitCost = price !== null ? price * exitPct : null;
    out.frictionTotal = price !== null ? z(out.acqAll) + z(out.exitCost) : null;
    out.frictionAppr = price && hold && hold > 0 && exitPct < 1 ? Math.pow((price + z(out.acqAll)) / (price * (1 - exitPct)), 1 / hold) - 1 : null;
    out.frictionShare = price ? out.frictionTotal / price : null;

    // Balance sheet after purchase
    if (out.postLiquid !== null && out.postFinancial !== null && price !== null) {
      const reValue = price + z(h.existing_re_value);
      const reDebt = z(out.loan) + z(h.existing_re_debt);
      const assets = Math.max(0, out.postLiquid) + Math.max(0, out.postFinancial) + reValue;
      const netWorth = assets - reDebt;
      out.reValue = reValue;
      out.reEquity = reValue - reDebt;
      out.netWorth = netWorth;
      out.reShareGross = assets > 0 ? reValue / assets : null;
      out.reShareNet = netWorth > 0 ? Math.max(0, out.reEquity) / netWorth : null;
    } else {
      out.reShareGross = out.reShareNet = null;
    }

    // Enough-House
    const enough = num(life.enough_price);
    out.premium = price !== null && enough !== null ? price - enough : null;
    out.premiumShare = out.premium !== null && price ? out.premium / price : null;
    out.premiumCarry = out.premium !== null && out.premium > 0 && isLoan && has(f.rate) ? out.premium * (+f.rate / 100) : null;

    // Under-construction: rough 24-month delay carry (upper bound — assumes full disbursement)
    if (d.status === "uc") {
      const housing = z(f.other_housing_cost);
      const interest = isLoan && out.loan && has(f.rate) ? (out.loan * +f.rate) / 1200 : 0;
      const lostRent = (d.occupancy === "rent" || d.occupancy === "mixed") && rent ? rent : 0;
      out.delayCarry24 = housing || interest || lostRent ? 24 * (housing + interest + lostRent) : null;
      out.delayParts = { housing: 24 * housing, interest: 24 * interest, lostRent: 24 * lostRent };
      const ready = num(uc.ready_alt_price);
      out.ucDiscount = ready !== null && out.allIn !== null ? ready - out.allIn : null;
      const delayCost = has(uc.delay_cost) ? +uc.delay_cost : out.delayCarry24;
      out.ucDiscountAfterDelay = out.ucDiscount !== null && delayCost !== null ? out.ucDiscount - delayCost : null;
    }

    return out;
  }

  // Price-evidence reading from the comparables, using the X-Ray's visible
  // heuristic, simplified to the worksheet's two comparables.
  function priceEvidenceHint(c, today) {
    const comps = ((c.property || {}).comps || []).filter((x) => has(x.price));
    if (!comps.length) return { label: "insufficient", why: "No comparable transaction entered yet." };
    const now = today ? new Date(today) : new Date();
    const recent = (x) => {
      if (!x.date) return false;
      const d = new Date(x.date + (x.date.length === 7 ? "-01" : ""));
      return !isNaN(d) && (now - d) / (1000 * 60 * 60 * 24 * 30.44) <= 12;
    };
    const tx = comps.filter((x) => x.kind !== "listing");
    if (!tx.length) return { label: "weak", why: "Only listings or estimates — asking prices are not evidence of what buyers pay." };
    const prices = tx.map((x) => +x.price);
    const spread = (Math.max.apply(null, prices) - Math.min.apply(null, prices)) / Math.min.apply(null, prices);
    if (tx.length >= 2 && tx.every(recent) && tx.every((x) => x.similarity === "high") && spread <= 0.2)
      return { label: "strong", why: "Two recent, highly similar transactions within 20% of each other." };
    if (tx.length === 1) return { label: "weak", why: "A single transaction is a data point, not a pattern." };
    return { label: "mixed", why: "Transactions exist, but they are older, less similar or widely spread." };
  }

  return { emi, derive, priceEvidenceHint, num, has };
});
