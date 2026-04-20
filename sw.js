const CACHE_NAME = "ironproofservice-v2";
const APP_SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/script.js",
  "/supabase-config.js",
  "/offline.html",
];
const EXCLUDED_PATH_PREFIXES = [
  "/manifest.webmanifest",
  "/sw.js",
  "/icons/",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.protocol !== "http:" && url.protocol !== "https:") {
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (isExcludedRequest(url)) {
    return;
  }

  if (isHtmlNavigation(request)) {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html")),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request)
        .then((response) => {
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseCopy));
          return response;
        })
        .catch(() => new Response("", { status: 504, statusText: "Offline" }));
    }),
  );
});

function isHtmlNavigation(request) {
  return request.mode === "navigate" && request.headers.get("accept")?.includes("text/html");
}

function isExcludedRequest(url) {
  return EXCLUDED_PATH_PREFIXES.some((pathPrefix) => url.pathname.startsWith(pathPrefix));
}
