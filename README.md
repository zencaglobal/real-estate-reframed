# Real Estate Reframed: companion site

The interactive companion site for **[Real Estate Reframed](https://zenca.global/p/real-estate-reframed-series)**, a 14-part series by [Zenca](https://zenca.global).

> Fourteen ways to separate the house, the investment, the financing, the lifestyle and the system around them, before putting them back together.

**Live:** https://real-estate-reframed.zenca.global/ (staging: https://zencaglobal.github.io/real-estate-reframed/)

None of these tools produce a score or a buy/sell verdict. They are educational frameworks, not financial, investment, tax or legal advice.

---

## What's here

| Path | Page | Opens (IST) | Companion to |
|---|---|---|---|
| `/` | **Hub**: series overview, tools, all 14 articles | 7 Dec 2026, 11:30 | Series launch |
| `/methodology/` | **Methodology & Concepts**: the series' reference vocabulary, 16 named concepts, evidence standards | 7 Dec 2026, 11:30 | The whole series |
| `/fingerprint/` | **Housing System Fingerprint Explorer**: compare the housing systems of India, China, Japan and the US across 24 qualitative dimensions | 21 Dec 2026, 11:30 | Article 3 |
| `/x-ray/` | **Property Decision X-Ray**: one property, one household, a full decision profile with stress tests and scenarios | 8 Mar 2027, 11:30 | Article 14 |
| `/worksheet/` | **Property Decision Worksheet**: a guided worksheet to work through before you commit | 8 Mar 2027, 11:30 | Article 14 |

Until its opening time, each page shows a countdown instead of its content.

## How it's built

- Plain HTML, CSS and JavaScript. There is no framework, no build step, no backend and no cookies.
- Fonts come from Google Fonts. Everything else is served from this repo.
- Routing is hash-based (`#/…`), so GitHub Pages needs no rewrite rules. `.nojekyll` makes Pages serve `_shared/` as-is.
- `_shared/` holds what all pages share:
  - `site.js`: the `window.ZencaSite` layer for links between pages, the unlock schedule, article links that switch on at publish time, and analytics;
  - `site.css` and `page.css`;
  - the favicon;
  - `og/`, the 1200×630 link-preview images.
- Each tool works on its own as well. `site.js` is optional for them.
- Every `?v=` on a script or stylesheet is a hash of that file, so browsers always fetch the current version after a deploy.

## Your data

- **The X-Ray and Worksheet** save what you enter only in your own browser (`localStorage` keys `zenca.xray.v1` and `zenca.worksheet.v1`). Nothing you type is sent anywhere.
- **Moving a case between the X-Ray and the Worksheet** happens inside your browser, which is why all the tools are served from one site.
- **X-Ray share links** carry the case inside the link itself, after the `#`. That part is never sent to a server.
- **Anonymous page visits** are counted with [GoatCounter](https://www.goatcounter.com/), which is cookie-free. Only page paths and fixed event names are recorded, never anything you enter.

## Previewing the schedule

Add one of these to any page address:

| Parameter | Effect |
|---|---|
| `?unlock=all` | Everything open |
| `?now=2026-12-22T12:00:00%2B05:30` | Show the site as at that moment |
| `?unlock=off` | Back to the real clock |

The setting lasts for the browser tab, and a small tag in the bottom-left corner shows when one is active.

## Contributing

This repository is **generated**: it is published from a separate source folder by a deploy script. That script runs every tool's test suite and a data-consistency check before it pushes, so edits made directly here will be overwritten on the next deploy. Corrections and feedback are welcome through [Zenca](https://zenca.global).

© Zenca. All rights reserved.
