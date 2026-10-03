// Minimal service worker: enough to make the app installable.
// It doesn't cache anything, so it can't serve stale pages.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Chrome checks for a fetch handler when deciding installability
self.addEventListener("fetch", () => { });