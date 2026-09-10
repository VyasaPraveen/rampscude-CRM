const CACHE_NAME = "ramps-cube-crm-v3";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

/**
 * The sync endpoint must never be cached. Its responses carry the whole
 * workspace (customer PII), and a cached copy replayed on a network failure
 * would look like a successful poll — the app would then apply stale records
 * over newer local edits. Always go to the network, and let the client's own
 * error handling mark sync as offline when it fails.
 */
function isApiRequest(url) {
  return url.pathname.endsWith("/api.php");
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  // Only ever handle same-origin traffic; anything else goes straight to the network.
  if (url.origin !== self.location.origin) return;
  if (isApiRequest(url)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache real, complete same-origin responses. Opaque/partial replies
        // would poison the cache with something we can never validate.
        if (response.ok && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/")))
  );
});
