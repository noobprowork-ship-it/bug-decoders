/**
 * LifeOS Service Worker — handles Web Push notifications.
 *
 * Installed automatically when the user subscribes to push notifications
 * via the Explore page. Receives push events from the backend (sent via
 * web-push / VAPID) and shows a browser notification with a click handler
 * that opens /explore.
 */

const CACHE_NAME = "lifeos-sw-v1";

// ── Install / activate ────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  // Skip waiting so new SW activates immediately
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Prune old caches if we ever add static caching
      caches.keys().then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      ),
    ])
  );
});

// ── Push event ─────────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "LifeOS", body: event.data?.text() || "You have a new notification." };
  }

  const title   = data.title   || "LifeOS";
  const body    = data.body    || "Check your latest insights.";
  const icon    = data.icon    || "/favicon.ico";
  const badge   = data.badge   || "/favicon.ico";
  const tag     = data.tag     || "lifeos-push";
  const url     = data.data?.url || "/explore";
  const renotify = data.renotify ?? false;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      renotify,
      silent: false,
      data: { url },
      // Vibration pattern for mobile: [vibrate, pause, vibrate]
      vibrate: [120, 60, 120],
      actions: [
        { action: "open",    title: "Open Explore" },
        { action: "dismiss", title: "Dismiss" },
      ],
    })
  );
});

// ── Notification click ─────────────────────────────────────────────────────

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/explore";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Focus an existing tab if one is open
        for (const client of clients) {
          if (new URL(client.url).pathname === url && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise open a new tab
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

// ── Push subscription change ───────────────────────────────────────────────
// Fires when the browser auto-rotates a subscription (rare but possible)

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: event.oldSubscription?.options?.applicationServerKey,
      })
      .then((newSub) =>
        fetch("/api/notifications/subscribe", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ subscription: newSub.toJSON() }),
        })
      )
      .catch((err) => console.warn("[sw] pushsubscriptionchange failed:", err))
  );
});
