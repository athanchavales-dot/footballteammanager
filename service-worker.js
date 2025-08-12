// service-worker.js — auto-updating strategy (no manual version bumps needed)

// A tiny, stable cache key for the core shell + a runtime cache for everything else
const PRECACHE = "bnfc-shell-v1";
const RUNTIME = "bnfc-runtime-v1";

// Minimal shell to render the app offline; the rest is cached at runtime
const SHELL_ASSETS = [
    "./",
    "./index.html",
    "./manifest.json",
    "./style.css",
    "./script.js",
    "./players-editor.js",
    "./logo.png",
    "./Field.png",
    // keep a placeholder so avatars always have a fallback:
    "./avatars/placeholder.jpg"
];

// Install: cache the app shell
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(PRECACHE).then((cache) => cache.addAll(SHELL_ASSETS))
    );
    self.skipWaiting();
});

// Activate: delete any caches we don't recognize, claim clients
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((k) => k !== PRECACHE && k !== RUNTIME)
                    .map((k) => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

// Fetch: smart strategy per file type
self.addEventListener("fetch", (event) => {
    const req = event.request;

    // Only handle GET requests
    if (req.method !== "GET") return;

    // Always try the network first for navigations and for JS/CSS
    const dest = req.destination;
    if (req.mode === "navigate" || dest === "document" || dest === "script" || dest === "style") {
        event.respondWith(networkFirst(req));
        return;
    }

    // Images & fonts: cache-first (fast) with network fill
    if (dest === "image" || dest === "font") {
        event.respondWith(cacheFirst(req));
        return;
    }

    // Everything else: stale-while-revalidate
    event.respondWith(staleWhileRevalidate(req));
});

// --- Strategies -------------------------------------------------------------

async function networkFirst(request) {
    try {
        const fresh = await fetch(request, { cache: "no-store" });
        const cache = await caches.open(RUNTIME);
        cache.put(request, fresh.clone());
        return fresh;
    } catch (err) {
        // Offline fallback
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
            // last resort: serve shell
            return caches.match("./index.html");
        }
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

    const fetchPromise = fetch(request)
        .then((res) => {
            cache.put(request, res.clone());
            return res;
        })
        .catch(() => null);

    return cached || (await fetchPromise) || Response.error();
}
