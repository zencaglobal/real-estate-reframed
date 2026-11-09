/* ============================================================
   Source records and placement change log.
   Every placement cites at least one source_id below.
   URLs point to the publisher's release or data landing page;
   the specific release is named in the title.
   ============================================================ */

(function (root) {
  "use strict";
  const HSF = (root.HSF = root.HSF || {});
  const ACC = "2026-10";

  const S = (source_id, publisher, title, url, publication_date, geography, data_period, source_type, notes) =>
    ({ source_id, publisher, title, url, publication_date, accessed_date: ACC, geography, data_period, source_type, notes: notes || "" });

  HSF.sources = [
    /* ---------- Multilateral ---------- */
    S("un-wpp", "United Nations, DESA Population Division", "World Population Prospects 2024", "https://population.un.org/wpp/", "2024", "Global", "Estimates to 2023; projections to 2100", "Multilateral statistics",
      "Medium-variant projections: India and the US keep growing through at least 2054; China and Japan have peaked; India projected to peak around the early 2060s."),
    S("un-wup", "United Nations, DESA Population Division", "World Urbanization Prospects", "https://population.un.org/wup/", "2025", "Global", "Urbanisation estimates and projections to 2050", "Multilateral statistics",
      "India among the largest contributors to global city-population growth to 2050; Japan has experienced declining city populations."),
    S("wb-urban", "World Bank", "Urban population (% of total population), indicator SP.URB.TOTL.IN.ZS", "https://data.worldbank.org/indicator/SP.URB.TOTL.IN.ZS", "2026", "Global", "2025", "Multilateral statistics",
      "Comparable series: India ~36%, China ~66%, United States ~80%, Japan ~92%. China’s official measure (67.9%) differs slightly because methodologies differ."),
    S("wb-india-urban", "World Bank", "India urbanisation and urban services analysis (drawing on official projections)", "https://www.worldbank.org/en/country/india", "2025", "India", "Projection to 2036", "Multilateral research",
      "Around 600 million Indians could live in urban areas by 2036 (about 40% of the population)."),
    S("imf-china-a4", "International Monetary Fund", "People’s Republic of China: 2025 Article IV Consultation and Selected Issues", "https://www.imf.org/en/Countries/CHN", "2025-12 / 2026", "China", "2020–2025", "Multilateral research",
      "Property contraction in its fourth year; residential sales volume >50% below 2021 peak; starts down ~80%; housing investment 12.3% of GDP (2020) → 6.1% (2025); inventory overhang ~30 months of sales; sharper declines in lower-tier cities; land-sale financing ~2.4% of GDP (2020) → ~0.7% (2025)."),
    S("imf-china-presales", "International Monetary Fund", "IMF research on presales, developer finance and China’s property-sector vulnerabilities", "https://www.elibrary.imf.org/", "2022–2025", "China", "Pre-crisis to 2025", "Multilateral research",
      "Presales roughly 90% of home sales in pre-crisis years and a key form of construction finance; central to the build-up of vulnerabilities; local-government land-sale needs part of the feedback loop."),
    S("imf-china-demand", "International Monetary Fund", "IMF working papers on fundamental housing demand, homeownership and housing segmentation in China", "https://www.elibrary.imf.org/", "2023–2026", "China", "Projections over the following decade", "Multilateral research",
      "Fundamental demand for new housing could fall roughly 35–55% over a decade as household formation slows; homeownership above 90% in cited research; housing a large share of household wealth; market, legacy and rental housing deeply segmented (“too much yet not enough”)."),
    S("oecd-housing", "OECD", "OECD research on housing-supply responsiveness and land-use regulation", "https://www.oecd.org/en/topics/housing.html", "2019–2026", "OECD countries", "Multi-decade", "Multilateral research",
      "Credits Japan’s flexible, nationally standardised zoning for historically responsive housing supply; associates restrictive land-use regulation with weaker supply responsiveness."),
    S("oecd-us", "OECD", "OECD Economic Survey of the United States 2026 — housing recommendations", "https://www.oecd.org/en/countries/united-states.html", "2026", "United States", "2026", "Multilateral research",
      "Recommends reforming local zoning to allow denser multifamily construction near transit because current rules constrain supply."),

    /* ---------- India ---------- */
    S("in-niti", "NITI Aayog", "Report on urban affordable housing (supply barriers and vacant stock)", "https://www.niti.gov.in/", "2025–2026", "India", "Current policy diagnosis; vacancy figure rooted in older census data", "Official policy research",
      "Identifies constrained serviced land, delays in land conversion, infrastructure shortages, fragmented titles and development regulation as supply barriers; describes close to one crore vacant urban homes while acknowledging no reliable current national occupancy database; cites low rental yields, litigation/repossession fears and informal rentals."),
    S("in-aidis", "National Statistical Office (MoSPI), via PIB", "All India Debt and Investment Survey 2019 (NSS 77th round)", "https://www.mospi.gov.in/", "2021", "India", "2019", "Official household survey",
      "Urban household assets: land ~49%, buildings ~38% (together ~87%). Survey composition; not directly comparable with national-account balance sheets."),
    S("in-rera", "Government of India", "Real Estate (Regulation and Development) Act, 2016", "https://www.indiacode.nic.in/", "2016", "India", "In force since 2016–17", "Primary legislation",
      "Registration of covered projects before marketing or sale; applies to ongoing projects without completion certificates; 70% of buyer collections ring-fenced in project accounts. Reduces project risk; does not abolish it."),
    S("in-prs-title", "PRS Legislative Research", "Analysis of land titling in India (presumptive vs conclusive titles)", "https://prsindia.org/", "2020s", "India", "Current", "Independent policy research",
      "Registration records a transaction; the buyer bears substantial responsibility for verifying ownership history."),
    S("in-dolr", "Department of Land Resources, Ministry of Rural Development", "Digital India Land Records Modernisation Programme (DILRMP) and ULPIN", "https://dolr.gov.in/", "Ongoing", "India", "Current", "Official programme",
      "Digitised cadastral maps, registry integration, unique land parcel IDs and an explicit objective of moving toward conclusive titling."),
    S("in-rbi-eblr", "Reserve Bank of India", "Circular on external benchmark-based lending for new floating-rate retail loans", "https://www.rbi.org.in/", "2019", "India", "Effective October 2019", "Central bank regulation",
      "New floating-rate retail loans, including home loans, linked to an external benchmark — rate changes pass through to borrowers."),
    S("in-budget", "Ministry of Finance, Government of India", "Economic Survey — state tax revenues (stamp duty and registration)", "https://www.indiabudget.gov.in/economicsurvey/", "2025–2026", "India", "Recent fiscal years", "Official fiscal data",
      "Stamp and registration fees are a meaningful state tax category. No national analogue to China’s land-sale/LGFV model found."),

    /* ---------- China ---------- */
    S("cn-nbs", "National Bureau of Statistics of China", "Statistical Communiqué on 2025 National Economic and Social Development; population data", "https://www.stats.gov.cn/english/", "2026-02", "China", "2025", "Official statistics",
      "Population fell ~3.39 million in 2025; 23% aged 60+. Real-estate investment −17.2%, residential starts −19.8%, residential sales value −13.0% in 2025."),
    S("cn-reuters", "Reuters", "Reporting on China’s property sector (presale share, land-sale revenue, home prices)", "https://www.reuters.com/", "2025–2026", "China", "2024–2026", "Secondary (news) — context only",
      "Presales ~68% of new-home sales in 2025 (methodology differs from the IMF’s earlier ~90%); land-sale revenue down a further 16% in 2024. Context only; does not anchor a placement."),

    /* ---------- Japan ---------- */
    S("jp-hls", "Statistics Bureau of Japan", "2023 Housing and Land Survey", "https://www.stat.go.jp/english/data/jyutaku/index.html", "2024", "Japan", "2023", "Official statistics",
      "9.0 million vacant dwellings; 13.8% vacancy rate. Housing stock exceeds the number of households nationally."),
    S("jp-census", "Statistics Bureau of Japan", "2025 Population Census (preliminary results)", "https://www.stat.go.jp/english/data/kokusei/index.html", "2026", "Japan", "2020–2025", "Official statistics",
      "Population down 2.5% between 2020 and 2025."),
    S("jp-mlit-land", "Ministry of Land, Infrastructure, Transport and Tourism (MLIT)", "Land prices and White Paper on Land", "https://www.mlit.go.jp/en/", "2026", "Japan", "1980s–2026", "Official statistics",
      "Nationwide land prices surged into 1991, then declined for years; residential land began a sustained recovery around 2018; Tokyo residential land still rising in 2026. MLIT describes the collapse as destroying the old “land myth”."),
    S("jp-mlit-homes", "Ministry of Land, Infrastructure, Transport and Tourism (MLIT)", "Existing-home market policy and valuation reform; existing-home transaction index", "https://www.mlit.go.jp/en/", "2020s", "Japan", "Current", "Official policy",
      "Acknowledges a long-standing convention in which the value of an older detached house approached zero after roughly 20–25 years; existing homes historically a low share of transactions; reforms target inspection, valuation and renovation; monthly existing-home transaction index published."),
    S("jp-boj-fsr", "Bank of Japan", "Financial System Report — housing loans", "https://www.boj.or.jp/en/research/brp/fsr/index.htm", "2025–2026", "Japan", "Current", "Central bank research",
      "Variable-rate loans constitute the majority of housing loans."),
    S("jp-boj-fof", "Bank of Japan", "Flow of Funds Accounts", "https://www.boj.or.jp/en/statistics/sj/index.htm", "2026", "Japan", "Q1 2026", "Central bank statistics",
      "Household financial assets roughly ¥2,386 trillion, with deposits a major component."),

    /* ---------- United States ---------- */
    S("us-fed-z1", "Board of Governors of the Federal Reserve System", "Financial Accounts of the United States (Z.1) — household balance sheet", "https://www.federalreserve.gov/releases/z1/", "2026", "United States", "Q2 2026", "Central bank statistics",
      "Owner-occupied real estate ~$49.8 trillion; financial assets ~$153.5 trillion. Aggregate national-account data; distribution across households differs."),
    S("us-fed-fsr", "Board of Governors of the Federal Reserve System", "Financial Stability Report — household leverage analysis", "https://www.federalreserve.gov/publications/financial-stability-report.htm", "2025", "United States", "2025", "Central bank research",
      "Mortgage balances relative to housing values well below pre-GFC peaks."),
    S("us-fed-supply", "Board of Governors of the Federal Reserve System", "Federal Reserve research and remarks on the housing shortfall and land-use constraints", "https://www.federalreserve.gov/", "2026", "United States", "2026", "Central bank research",
      "Estimates of a national housing shortfall of roughly 2 million to 5.5 million units; local zoning, permitting and land-use restrictions constrain where and how densely housing can be built."),
    S("us-fed-gfc", "Board of Governors of the Federal Reserve System", "Post-crisis analysis of the 2000s housing boom and bust", "https://www.federalreserve.gov/", "2010s", "United States", "2000–2010", "Central bank research",
      "Feedback between house-price optimism and mortgage-market developments; falling prices, defaults, foreclosures and mortgage-market stress reinforced each other."),
    S("us-nyfed", "Federal Reserve Bank of New York", "Quarterly Report on Household Debt and Credit", "https://www.newyorkfed.org/microeconomics/hhdc", "2026-08", "United States", "Q2 2026", "Central bank statistics",
      "Mortgage balances ~$13.1 trillion; HELOC balances ~$459 billion."),
    S("us-freddie", "Freddie Mac", "Freddie Mac research: 30-year fixed share, rate lock-in, cash-out refinance volumes", "https://www.freddiemac.com/research", "2021–2025", "United States", "2021–2025", "Industry / GSE research",
      "More than 90% of home loans purchased in 2023 were 30-year fixed; lock-in worth tens of thousands of dollars per borrower and a factor suppressing existing-home inventory; ~$248 billion extracted through conventional cash-out refinancing in 2021."),
    S("us-fhfa", "Federal Housing Finance Agency", "Fannie Mae and Freddie Mac — mortgage securitisation and the secondary market", "https://www.fhfa.gov/", "Ongoing", "United States", "Current", "Regulator",
      "GSEs buy mortgages, package them into MBS and guarantee payments, letting lenders recycle capital; the 30-year fixed-rate mortgage has historically been the dominant product."),
    S("us-census-hvs", "U.S. Census Bureau", "Housing Vacancies and Homeownership (CPS/HVS)", "https://www.census.gov/housing/hvs/index.html", "2026-07", "United States", "Q2 2026", "Official statistics",
      "Homeowner vacancy 1.2%; rental vacancy 7.3%; homeownership 65.0%."),
    S("us-census-pop", "U.S. Census Bureau", "National population estimates (Vintage 2025)", "https://www.census.gov/programs-surveys/popest.html", "2025-12", "United States", "2024–2025", "Official statistics",
      "Population growth slowed to about 0.5% in 2024–25, with net international migration the main contributor."),
    S("us-nber", "National Bureau of Economic Research", "NBER working paper on the slowdown in U.S. housing-stock growth", "https://www.nber.org/", "2025", "United States", "1980–2020", "Academic research",
      "Had the housing stock grown in 2000–2020 at its 1980–2000 rate, roughly 15 million more units would exist."),
    S("us-urban", "Urban Institute", "State and local finance data — property taxes", "https://www.urban.org/", "2020s", "United States", "Recent fiscal years", "Independent policy research",
      "Recurring property taxes are a major source of local-government revenue."),

    /* ---------- Real Estate Reframed synthesis ---------- */
    S("rer-fingerprint", "Zenca — Real Estate Reframed", "Housing System Fingerprint v1.0", "", "2026", "India, China, Japan, United States", "Synthesis as of 2026", "Editorial synthesis",
      "Canonical 24 dimensions, endpoint semantics, launch placements and country labels. Used directly where a placement is a synthesis judgement."),
    S("rer-crosscountry", "Zenca — Real Estate Reframed", "Cross-Country Housing Systems Comparison: India × China × Japan × United States", "", "2026", "India, China, Japan, United States", "Synthesis as of 2026", "Editorial synthesis",
      "Country mechanisms, feedback loops, crisis archetypes and transmission channels; built on Dossiers B, G and H."),
  ];

  /* Placement change log. History is appended, never overwritten. */
  HSF.changelog = [
    { country_id: "*", dimension_id: "*", previous_position: null, new_position: "Launch placements",
      effective_date: "2026-10", reason: "Explorer v1.0 publishes the 96 launch placements from Housing System Fingerprint v1.0.",
      source_ids: ["rer-fingerprint"], reviewer: "Real Estate Reframed editorial" },
    { country_id: "CN", dimension_id: "d23", previous_position: "R", new_position: "MR",
      effective_date: "2026", reason: "Moved inside the extreme during Fingerprint v1.0 lock: the 2021–26 downturn is itself weakening long-held expectations of appreciation (sales volume >50% below 2021 peak by late 2025).",
      source_ids: ["imf-china-a4", "rer-fingerprint"], reviewer: "Real Estate Reframed editorial" },
    { country_id: "IN", dimension_id: "d10", previous_position: "L", new_position: "L",
      effective_date: "2026-10", reason: "Rationale only, no marker move: Infrastructure maturity now explicitly covers water supply, groundwater, sewage and wastewater, drainage and power. India’s rationale adds NITI Aayog’s finding on constrained serviced urban land.",
      source_ids: ["in-niti"], reviewer: "Real Estate Reframed editorial" },
  ];
})(typeof self !== "undefined" ? self : globalThis);
