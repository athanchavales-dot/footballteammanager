// Clean cache version to ensure latest UI is served (no pass UI anywhere)
const PRECACHE = "bnfc-shell-v4";
const RUNTIME = "bnfc-runtime-v1";

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./style.css",
  "./script.js",
  "./players-editor.js",
  "./logo.png",
  "./Field.png",
  "./football-png-32.png",
  "./avatars/placeholder.jpg",  // ← add comma
  "./players.json",             // keep this
];


self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(PRECACHE).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== PRECACHE && k !== RUNTIME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const dest = req.destination;
  if (req.mode === "navigate" || dest === "document" || dest === "script" || dest === "style") {
    event.respondWith(networkFirst(req)); return;
  }
  if (dest === "image" || dest === "font") {
    event.respondWith(cacheFirst(req)); return;
  }
  event.respondWith(staleWhileRevalidate(req));
});

async function networkFirst(request) {
  try {
    const fresh = await fetch(request, { cache: "no-store" });
    const cache = await caches.open(RUNTIME);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") return caches.match("./index.html");
    throw err;
  }
}
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  const cache = await caches.open(RUNTIME);
  cache.put(request, res.clone());
  return res;
}
async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((res) => { cache.put(request, res.clone()); return res; }).catch(() => null);
  return cached || (await fetchPromise) || Response.error();
}
