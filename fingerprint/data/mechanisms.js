/* ============================================================
   Same outcome, different machine.
   Stylised mechanism chains from the Cross-Country Housing
   Systems Comparison. Illustrations of plumbing — never forecasts.
   Each chain is dated so "how this system developed" is not
   confused with "what it looks like now".
   ============================================================ */

(function (root) {
  "use strict";
  const HSF = (root.HSF = root.HSF || {});

  HSF.mechanisms = [
    {
      id: "rise", tab: "Prices rise 10%",
      title: "Four countries report house prices up 10%.",
      intro: "The number is identical. What produces it is not — so neither is what it implies about the next twenty years.",
      caption: "Same number. Different cause.",
      chains: {
        IN: { period: "Today", steps: ["Urbanisation", "Rising incomes", "Constrained useful supply", "Price"], dims: ["d01", "d03", "d07", "d09"] },
        CN: { period: "Boom years (to 2021)", steps: ["Credit", "Investment demand", "Presales", "Land finance", "Price"], dims: ["d16", "d18", "d23"] },
        JP: { period: "Tokyo, today", steps: ["Strong urban concentration", "Despite national population decline", "Price"], dims: ["d04", "d02", "d06"] },
        US: { period: "Recent cycles", steps: ["Low mortgage rates", "Constrained inventory", "Price"], dims: ["d12", "d07", "d20"] },
      },
    },
    {
      id: "fall", tab: "Prices fall 20%",
      title: "Now imagine house prices suddenly fall 20%.",
      intro: "The same asset-price move travels through different balance sheets. These are transmission channels, not predictions of a crash.",
      caption: "Price is the symptom. The balance sheets tell you the disease.",
      chains: {
        IN: { period: "Channels today", steps: ["Lower paper wealth for property-heavy households", "Weaker developer sales", "Some collateral stress", "Weaker investment sentiment"], dims: ["d15", "d16", "d14", "d24"],
              note: "Less pervasive equity extraction and no China-scale presale dependence may weaken some channels. No modern national episode of this kind has been established — a fact, not a forecast." },
        CN: { period: "Current downturn", steps: ["Household confidence", "Presales", "Developer cash", "Construction", "Land purchases", "Local-government finances"], dims: ["d23", "d16", "d17", "d18", "d24"] },
        JP: { period: "1990s", steps: ["Lower land values", "Corporate collateral", "Banks", "Borrower balance sheets", "Long adjustment"], dims: ["d22", "d23", "d24"],
              note: "This is the historical channel. Today’s configuration — large financial savings, limited equity extraction — is placed mid-left on systemic sensitivity." },
        US: { period: "2008", steps: ["Negative equity", "Mortgage defaults", "Foreclosures", "Mortgage-security losses", "Financial-institution stress"], dims: ["d13", "d11", "d14", "d24"],
              note: "Leverage relative to housing values is now well below pre-crisis peaks, and fixed-rate mortgages protect most payments from rate shocks." },
      },
    },
    {
      id: "leverage", tab: "Where the leverage sits",
      title: "“Financialised housing” means different things in different systems.",
      intro: "The question is not whether housing is financialised, but whose balance sheet carries the risk.",
      caption: "Housing financialisation depends on whose balance sheet carries the risk.",
      chains: null, // drawn from each country's `leverage` field
      dims: ["d11", "d14", "d16", "d18"],
    },
  ];

  /* "Four people each buy an apartment" — Fingerprint v1.0 */
  HSF.fourApartments = {
    IN: ["Urbanisation", "household formation", "constrained usable supply"],
    CN: ["Excess stock", "shrinking household formation", "developer deleveraging"],
    JP: ["Shrinking population", "highly responsive rebuilding", "depreciating structures"],
    US: ["Long-fixed leverage", "deep resale markets", "restrictive metropolitan zoning"],
  };
})(typeof self !== "undefined" ? self : globalThis);
