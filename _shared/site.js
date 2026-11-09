/* ============================================================
   Real Estate Reframed: shared site layer (window.ZencaSite)
   Owned by the deployment chat. Contract: DEPLOYMENT-PLAN.md §3a.
   URLs and dates: URL-REGISTRY.md (keep the two in sync).

   Loaded in <head> of every page, before the page's own scripts:
     <script src="../_shared/site.js" data-zenca-tool="xray"></script>
   Optional attribute data-zenca-analytics="self" = the page counts its
   own page views (the Worksheet); site.js then only provides track().

   Everything here is optional for the tools: each one must still work
   when this file is absent.
   ============================================================ */
(function () {
  "use strict";

  var SCRIPT = document.currentScript;
  var TOOL = (SCRIPT && SCRIPT.getAttribute("data-zenca-tool")) || "hub";
  var SELF_COUNT = SCRIPT && SCRIPT.getAttribute("data-zenca-analytics") === "self";
  var ROOT = SCRIPT ? new URL("../", SCRIPT.src).href : "../";

  /* Folder names. The source folders in output/ have long names; the deploy
     script rewrites this block to the published names. Do not reformat the
     marker lines. */
  // @zenca-folders-start
  var FOLDERS = { xray: "x-ray/", fingerprint: "fingerprint/", worksheet: "worksheet/", methodology: "methodology/" };
  // @zenca-folders-end

  /* Unlock schedule (IST). Source: DEPLOYMENT-PLAN.md §8. */
  var SCHEDULE = {
    hub:         "2026-12-07T11:30:00+05:30",
    methodology: "2026-12-07T11:30:00+05:30",
    fingerprint: "2026-12-21T11:30:00+05:30",
    xray:        "2027-03-08T11:30:00+05:30",
    worksheet:   "2027-03-08T11:30:00+05:30"
  };

  /* Series and articles. Source: URL-REGISTRY.md §2. A URL is exposed only
     once its publish time has passed (same clock as the unlock). */
  var SUBSTACK = "https://zenca.global/p/";
  var SERIES = { url: SUBSTACK + "real-estate-reframed-series", at: "2026-12-07T11:30:00+05:30" };
  var ARTICLES = [
    [1,  "What Are You Actually Buying?",                                  "2026-12-07"],
    [2,  "Your House Doesn’t Really Have A Price",                     "2026-12-14"],
    [3,  "Your House’s Last Five Years Won’t Predict The Next Twenty", "2026-12-21"],
    [4,  "The Return You Think You Made On Your House Is Probably Wrong",  "2026-12-28"],
    [5,  "Housing Always Costs Money, Even When You Own It",          "2027-01-04"],
    [6,  "The Magic Of Real Estate Is Often Leverage",                     "2027-01-11"],
    [7,  "Your Rental Property Is A Business, Not Passive Income",         "2027-01-18"],
    [8,  "Your Parents’ 100× Is Not Your Forecast",              "2027-01-25"],
    [9,  "Rich On Paper, Concentrated In Reality",                         "2027-02-01"],
    [10, "Why We Love Real Estate So Much",                                "2027-02-08"],
    [11, "Buying From A Builder Means Buying More Than A House",           "2027-02-15"],
    [12, "The Parallel Economy Around Property",                           "2027-02-22"],
    [13, "Can Housing Be Affordable And A Great Investment?",              "2027-03-01"],
    [14, "So, Should You Buy This Property?",                              "2027-03-08"]
  ].map(function (a) {
    return { n: a[0], title: a[1], url: SUBSTACK + "real-estate-reframed-" + a[0] + "-14", at: a[2] + "T11:30:00+05:30" };
  });

  /* Teaser copy for locked pages. */
  var PAGES = {
    hub:         { name: "Real Estate Reframed", line: "Fourteen ways to separate the house, the investment, the financing, the lifestyle and the system around them, before putting them back together.", article: 1 },
    methodology: { name: "Methodology & Concepts", line: "A reference guide to the language, frameworks and evidence standards behind Real Estate Reframed.", article: 1 },
    fingerprint: { name: "Housing System Fingerprint Explorer", line: "What kind of housing machine are you looking at? Compare the housing systems of India, China, Japan and the United States.", article: 3 },
    xray:        { name: "Property Decision X‑Ray", line: "X-ray this property, for this person, at this price. A diagnostic, not an oracle.", article: 14 },
    worksheet:   { name: "Property Decision Worksheet", line: "Should this property fit into your financial life? A guided worksheet to work through before you commit.", article: 14 }
  };

  /* ---------- Storage (preview overrides only; never required) ---------- */
  var PREVIEW_KEY = "zenca.rer.preview";
  function ssGet(k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { if (v == null) window.sessionStorage.removeItem(k); else window.sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  /* ---------- Clock ----------
     ?unlock=all  → everything open (kept for this tab)
     ?now=<ISO>   → pretend it is that moment (kept for this tab)
     ?unlock=off  → clear both
     Otherwise the device clock, corrected by the server's Date header. */
  var preview = {};
  try { preview = JSON.parse(ssGet(PREVIEW_KEY) || "{}") || {}; } catch (e) { preview = {}; }
  (function readParams() {
    var q = new URLSearchParams(location.search);
    if (q.get("unlock") === "off") preview = {};
    if (q.get("unlock") === "all") preview.all = true;
    var n = q.get("now");
    if (n && !isNaN(Date.parse(n))) { preview.now = n; delete preview.all; }
    ssSet(PREVIEW_KEY, Object.keys(preview).length ? JSON.stringify(preview) : null);
  })();

  var offset = 0;
  var startReal = Date.now();
  function now() {
    if (preview.now) return Date.parse(preview.now) + (Date.now() - startReal);
    return Date.now() + offset;
  }
  function ts(iso) { return Date.parse(iso); }

  function isOpen(tool) {
    if (preview.all) return true;
    var at = SCHEDULE[tool];
    return !at || now() >= ts(at);
  }
  function opensAt(tool) {
    var at = SCHEDULE[tool];
    return at ? new Date(at) : null;
  }
  function published(iso) { return preview.all || now() >= ts(iso); }

  /* ---------- Links ---------- */
  function buildLinks() {
    var art = function (n) { var a = ARTICLES[n - 1]; return published(a.at) ? a.url : null; };
    return {
      hub: ROOT,
      xray: ROOT + FOLDERS.xray,
      fingerprint: ROOT + FOLDERS.fingerprint,
      worksheet: ROOT + FOLDERS.worksheet,
      methodology: ROOT + FOLDERS.methodology,
      series: published(SERIES.at) ? SERIES.url : null,
      article3: art(3),
      article13: art(13),
      article14: art(14)
    };
  }

  /* ---------- Analytics (GoatCounter, cookie-free) ----------
     Paths are always set explicitly; the fragment is never sent. */
  var PREFIX = { hub: "", methodology: "/methodology", xray: "/x-ray", fingerprint: "/fingerprint", worksheet: "/worksheet" }[TOOL] || "";
  var ROUTES = {
    xray: /^(|method|case\/(frame|property|financing|household|life|redlines|scenarios|review|report)|explore\/(return|housing-cost|leverage|rental|balance-sheet|utility|under-construction|appreciation))$/,
    fingerprint: /^(|explore|method|country\/(IN|CN|JP|US))$/
  };
  var queue = [];
  var pollTimer = null;
  var pageLocked = false;
  function gcReady() { return !!(window.goatcounter && typeof window.goatcounter.count === "function"); }
  function flush() {
    while (queue.length && gcReady()) {
      try { window.goatcounter.count(queue.shift()); } catch (e) { /* ignore */ }
    }
    if (!queue.length && pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }
  function send(item) {
    queue.push(item);
    if (gcReady()) return flush();
    if (!pollTimer) {
      var tries = 0;
      pollTimer = setInterval(function () {
        tries++;
        flush();
        if (tries > 60 && pollTimer) { clearInterval(pollTimer); pollTimer = null; queue = []; }
      }, 250);
    }
  }
  function track(path, isEvent) {
    if (pageLocked) return;                       // only the teaser view is counted on a locked page
    var p = String(path == null ? "" : path).split("#")[0].split("?")[0].replace(/^\/+/, "");
    send({ path: PREFIX + "/" + p, title: isEvent ? p : document.title, event: !!isEvent });
  }
  function routeOf() {
    var r = location.hash.replace(/^#\/?/, "").split("?")[0].replace(/\/+$/, "");
    if (TOOL === "xray" && /^shared(\/|$)/.test(r)) return "shared";
    var re = ROUTES[TOOL];
    if (!re) return "";
    return re.test(r) ? r : "other";
  }
  function autoCount() {
    if (SELF_COUNT) return;
    if (pageLocked) { send({ path: PREFIX + "/teaser", title: document.title }); return; }
    track(routeOf(), false);
    if (ROUTES[TOOL]) window.addEventListener("hashchange", function () { track(routeOf(), false); });
  }

  /* ---------- DOM helpers ---------- */
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function fmtDate(iso) {
    // Shown in IST, the publishing timezone, whatever the reader's device says.
    var d = new Date(ts(iso) + 5.5 * 3600 * 1000);
    return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function unlink(a) {
    var span = el("span", (a.className ? a.className + " " : "") + "zenca-unlinked", a.textContent);
    a.parentNode.replaceChild(span, a);
    return span;
  }

  function wireLinks(links) {
    // Site links: data-zenca-link="series|hub|xray|…"
    Array.prototype.forEach.call(document.querySelectorAll("a[data-zenca-link]"), function (a) {
      var v = links[a.getAttribute("data-zenca-link")];
      if (v) a.href = v; else unlink(a);
    });
    // Tool links that should only be live once the tool is open: data-zenca-gate="fingerprint"
    Array.prototype.forEach.call(document.querySelectorAll("a[data-zenca-gate]"), function (a) {
      var t = a.getAttribute("data-zenca-gate");
      if (isOpen(t)) return;
      var s = unlink(a);
      s.appendChild(el("span", "zenca-opens", " (opens " + fmtDate(SCHEDULE[t]) + ")"));
    });
    // Article references: data-zenca-article="3" → link once published, plain text before
    Array.prototype.forEach.call(document.querySelectorAll("[data-zenca-article]"), function (node) {
      var a = ARTICLES[Number(node.getAttribute("data-zenca-article")) - 1];
      if (!a) return;
      if (published(a.at)) {
        if (node.tagName === "A") { node.href = a.url; node.target = "_blank"; node.rel = "noopener"; }
      } else if (node.tagName === "A") {
        var s = unlink(node);
        if (node.hasAttribute("data-zenca-show-date")) s.appendChild(el("span", "zenca-opens", " · " + fmtDate(a.at)));
      }
    });
    // Status labels: data-zenca-status="fingerprint" → "Open" or "Opens 21 Dec 2026"
    Array.prototype.forEach.call(document.querySelectorAll("[data-zenca-status]"), function (node) {
      var t = node.getAttribute("data-zenca-status");
      var open = isOpen(t);
      node.textContent = open ? "Open now" : "Opens " + fmtDate(SCHEDULE[t]);
      node.classList.add(open ? "is-open" : "is-locked");
    });
  }

  /* ---------- Locked page: teaser ---------- */
  function countdownText() {
    var ms = Math.max(0, ts(SCHEDULE[TOOL]) - now());
    var m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
    return (d ? d + (d === 1 ? " day, " : " days, ") : "") + h + (h === 1 ? " hour, " : " hours, ") + mm + (mm === 1 ? " minute" : " minutes");
  }
  function showTeaser() {
    var app = document.getElementById("app");
    if (app) { app.setAttribute("inert", ""); app.setAttribute("aria-hidden", "true"); }
    var page = PAGES[TOOL] || PAGES.hub;
    var art = ARTICLES[page.article - 1];
    var box = el("section", "zenca-teaser zenca-deploy-ui");
    box.setAttribute("aria-labelledby", "zenca-teaser-title");
    var inner = el("div", "zenca-teaser-inner");
    inner.appendChild(el("p", "zenca-teaser-eyebrow", "Real Estate Reframed · coming soon"));
    var h = el("h1", "zenca-teaser-title", page.name); h.id = "zenca-teaser-title";
    inner.appendChild(h);
    inner.appendChild(el("p", "zenca-teaser-line", page.line));
    var when = el("p", "zenca-teaser-when");
    when.appendChild(document.createTextNode("Opens " + fmtDate(SCHEDULE[TOOL]) + " at 11:30 IST"));
    inner.appendChild(when);
    var cd = el("p", "zenca-teaser-countdown", countdownText());
    cd.setAttribute("aria-live", "off");
    inner.appendChild(cd);
    var note = el("p", "zenca-teaser-note");
    note.appendChild(document.createTextNode(TOOL === "hub" || TOOL === "methodology"
      ? "The series begins with Article 1, “" + art.title + "”"
      : "It arrives alongside Article " + art.n + ", “" + art.title + "”"));
    inner.appendChild(note);
    var actions = el("p", "zenca-teaser-actions");
    if (TOOL !== "hub" && isOpen("hub")) {
      var hub = el("a", "zenca-btn", "Explore Real Estate Reframed"); hub.href = ROOT; actions.appendChild(hub);
    }
    var sub = el("a", "zenca-btn zenca-btn-ghost", "Follow Zenca on Substack");
    sub.href = "https://zencaglobal.substack.com/"; sub.target = "_blank"; sub.rel = "noopener";
    actions.appendChild(sub);
    inner.appendChild(actions);
    box.appendChild(inner);
    if (app && app.parentNode) app.parentNode.insertBefore(box, app.nextSibling);
    else document.body.insertBefore(box, document.body.firstChild);
    setInterval(function () {
      if (now() >= ts(SCHEDULE[TOOL])) { location.reload(); return; }
      cd.textContent = countdownText();
    }, 1000);
  }

  /* ---------- Server clock check ----------
     The device clock decides the first render. If the server's clock moves
     any page or link across an unlock time, reload once. */
  function snapshot() { return Object.keys(SCHEDULE).map(isOpen).join(",") + "|" + ARTICLES.map(function (a) { return published(a.at); }).join(","); }
  function checkServerClock() {
    if (preview.now || preview.all || !/^https?:$/.test(location.protocol) || !window.fetch) return;
    var before = snapshot();
    fetch(location.href.split("#")[0], { method: "HEAD", cache: "no-store" }).then(function (r) {
      var d = Date.parse(r.headers.get("Date") || "");
      if (isNaN(d)) return;
      var diff = d - Date.now();
      if (Math.abs(diff) < 60000) { ssSet("zenca.rer.clockReload", null); return; }   // device clock is fine
      offset = diff;
      if (snapshot() !== before && !ssGet("zenca.rer.clockReload")) {
        ssSet("zenca.rer.clockReload", "1");
        location.reload();
      }
    }).catch(function () { /* offline or blocked: keep the device clock */ });
  }

  /* ---------- Public API ---------- */
  var links = buildLinks();
  window.ZencaSite = {
    tool: TOOL,
    links: links,
    isOpen: isOpen,
    opensAt: opensAt,
    track: track,
    articles: ARTICLES.map(function (a) { return { n: a.n, title: a.title, publishesAt: new Date(a.at), url: published(a.at) ? a.url : null }; }),
    schedule: SCHEDULE
  };

  pageLocked = !isOpen(TOOL);
  if (pageLocked) document.documentElement.classList.add("zenca-locked");
  if (preview.all || preview.now) document.documentElement.classList.add("zenca-preview");

  function onReady() {
    wireLinks(links);
    if (pageLocked) showTeaser();
    if (preview.all || preview.now) {
      var tag = el("div", "zenca-preview-tag zenca-deploy-ui", preview.all ? "Preview: everything unlocked" : "Preview: clock set to " + preview.now);
      var off = el("a", null, "reset"); off.href = "?unlock=off" + location.hash;
      tag.appendChild(document.createTextNode(" · ")); tag.appendChild(off);
      document.body.appendChild(tag);
    }
    autoCount();
    checkServerClock();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", onReady);
  else onReady();
})();
