/*
 * Service worker: makes the site installable and readable offline.
 *
 * - Pages: network first, so readers always get the latest text when online. A copy of each page
 *   is kept for offline reading, with /offline as the fallback for pages never opened.
 * - Next.js build files (/_next/static/…): cache first. Their names change whenever their content
 *   does, so a cached copy is never out of date.
 * - Everything else goes straight to the network: /api (issue reports, keep-alive), /internal-review,
 *   other sites, icons, and Next.js's in-app navigation requests. When an in-app navigation fails
 *   offline, Next.js falls back to a full page load, which this worker answers from the cache.
 *
 * Pages opened through in-app links never pass through here as pages, so the app asks for them to
 * be saved (CACHE_URLS messages from components/pwa.tsx), as does Settings → "Save all Parts".
 *
 * Bump VERSION to drop every cached file on the next visit.
 */
const VERSION = "1";
const PAGES = `qj-pages-v${VERSION}`;
const BUILD = `qj-build-v${VERSION}`;
const OFFLINE = "/offline";
const SHELL = ["/", OFFLINE]; // saved at install, never evicted
const MAX_PAGES = 200; // the most recently saved pages are kept
const BUILD_LIMIT = 400; // above this, build files that no saved page uses any more are removed
const FRESH_MS = 12 * 60 * 60 * 1000; // a page saved more recently than this isn't downloaded again just to save it

const ORIGIN = self.location.origin;
const SAVED_AT = "x-qj-saved-at";

/** Absolute URL without query or hash: /parts/1?x and /parts/1#sec-verses share one saved copy. */
function key(input) {
  const url = new URL(input, ORIGIN);
  url.search = "";
  url.hash = "";
  return url.href;
}

function handled(url) {
  return (
    url.origin === ORIGIN &&
    !url.pathname.startsWith("/api/") &&
    !url.pathname.startsWith("/internal-review") &&
    url.pathname !== "/sw.js" &&
    !url.searchParams.has("_rsc")
  );
}

const isBuildFile = (url) => url.pathname.startsWith("/_next/static/");

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      for (const path of SHELL) await savePage(path, { force: true }).catch(() => undefined);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Lets the page request start while this worker is still starting up.
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => undefined);
      for (const name of await caches.keys()) if (name.startsWith("qj-") && name !== PAGES && name !== BUILD) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (!handled(url)) return;
  if (request.mode === "navigate") event.respondWith(networkFirst(event));
  else if (isBuildFile(url)) event.respondWith(cacheFirst(event));
});

async function networkFirst(event) {
  try {
    const response = (await event.preloadResponse) || (await fetch(event.request));
    if (response.ok && response.type === "basic") event.waitUntil(storePage(key(event.request.url), response.clone()));
    return response;
  } catch {
    const pages = await caches.open(PAGES);
    return (
      (await pages.match(key(event.request.url))) ||
      (await pages.match(key(OFFLINE))) ||
      new Response("You are offline.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })
    );
  }
}

async function cacheFirst(event) {
  const build = await caches.open(BUILD);
  const id = key(event.request.url);
  const saved = await build.match(id);
  if (saved) return saved;
  const response = await fetch(event.request);
  if (response.ok && response.type === "basic") event.waitUntil(build.put(id, response.clone()));
  return response;
}

/** Stores a page with the time it was saved (a fresh Response also drops any redirect flag). */
async function storePage(id, response) {
  const headers = new Headers(response.headers);
  headers.set(SAVED_AT, String(Date.now()));
  const pages = await caches.open(PAGES);
  await pages.put(id, new Response(await response.blob(), { status: response.status, statusText: response.statusText, headers }));
  await trimPages(pages);
}

/** Saves a page and the build files its HTML names (scripts, styles, preloaded fonts). */
async function savePage(path, { force = false } = {}) {
  const id = key(path);
  if (!force) {
    const saved = await (await caches.open(PAGES)).match(id);
    if (saved && Date.now() - Number(saved.headers.get(SAVED_AT) || 0) < FRESH_MS) return;
  }
  const response = await fetch(id);
  if (!response.ok || response.type !== "basic") throw new Error(`HTTP ${response.status}`);
  const html = await response.clone().text();
  await storePage(id, response);
  for (const file of buildFilesIn(html)) await saveBuildFile(file).catch(() => undefined);
}

async function saveBuildFile(href) {
  const build = await caches.open(BUILD);
  const id = key(href);
  if (await build.match(id)) return;
  const response = await fetch(id);
  if (response.ok && response.type === "basic") await build.put(id, response);
}

/** Every /_next/static/… path in a page (attributes, and the escaped JSON Next.js embeds). */
function buildFilesIn(text) {
  return new Set(Array.from(text.matchAll(/\/_next\/static\/[^"'()\s?#\\]+/g), (m) => key(m[0])));
}

/** Font files a stylesheet points to, resolved against the stylesheet's own address. */
function fontsIn(css, base) {
  const found = [];
  for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
    try {
      const url = new URL(m[1], base);
      if (url.origin === ORIGIN && isBuildFile(url)) found.push(key(url));
    } catch {
      /* data: URLs and the like */
    }
  }
  return found;
}

async function trimPages(pages) {
  const keep = new Set(SHELL.map(key));
  const saved = (await pages.keys()).filter((request) => !keep.has(request.url)); // oldest first
  for (const request of saved.slice(0, Math.max(0, saved.length - MAX_PAGES))) await pages.delete(request);
}

/**
 * Each deploy brings new build files. Once there are more than BUILD_LIMIT, keep only those that a
 * saved page still uses (plus the fonts their stylesheets use), so saved pages keep working offline.
 */
async function collectGarbage() {
  const build = await caches.open(BUILD);
  const files = await build.keys();
  if (files.length <= BUILD_LIMIT) return;
  const pages = await caches.open(PAGES);
  const live = new Set();
  for (const request of await pages.keys()) {
    const page = await pages.match(request);
    if (page) for (const file of buildFilesIn(await page.text())) live.add(file);
  }
  for (const request of files) {
    if (!live.has(request.url) || !new URL(request.url).pathname.endsWith(".css")) continue;
    const css = await build.match(request);
    if (css) for (const font of fontsIn(await css.text(), request.url)) live.add(font);
  }
  for (const request of files) if (!live.has(request.url)) await build.delete(request);
}

/**
 * { type: "CACHE_URLS", urls, force? } saves pages and build files for offline reading. With a
 * MessagePort attached, progress is reported as { type: "PROGRESS" | "DONE", done, failed, total }.
 */
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "CACHE_URLS" || !Array.isArray(data.urls)) return;
  const port = event.ports && event.ports[0];
  event.waitUntil(
    (async () => {
      const total = data.urls.length;
      let done = 0;
      let failed = 0;
      for (const raw of data.urls) {
        try {
          const url = new URL(String(raw), ORIGIN);
          if (!handled(url)) throw new Error("Not saved for offline reading");
          if (isBuildFile(url)) await saveBuildFile(url.href);
          else await savePage(url.href, { force: data.force === true });
          done++;
        } catch {
          failed++;
        }
        if (port) port.postMessage({ type: "PROGRESS", done, failed, total });
      }
      await collectGarbage().catch(() => undefined);
      if (port) port.postMessage({ type: "DONE", done, failed, total });
    })(),
  );
});
