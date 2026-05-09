/**
 * Push notification helpers for LifeOS.
 *
 * Flow:
 *  1. Register the service worker (sw.js in the public root).
 *  2. Fetch the VAPID public key from the backend.
 *  3. Subscribe via PushManager using that key.
 *  4. POST the subscription object to /api/notifications/subscribe.
 *  5. Optionally trigger a test notification to confirm end-to-end.
 *
 * The subscription is cached in localStorage so we don't re-register on
 * every visit. On unsubscribe the entry is removed both from the browser
 * and the backend database.
 */

const SW_PATH      = "/sw.js";
const KEY_SUB      = "lifeos.push.subscription";
const KEY_ENDPOINT = "lifeos.push.endpoint";

export type PushStatus = "unsupported" | "denied" | "default" | "subscribed";

/** True when the browser supports service workers + Push API */
export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Return the current subscription state without requesting permission */
export function getPushStatus(): PushStatus {
  if (!isPushSupported()) return "unsupported";
  const perm = Notification.permission;
  if (perm === "denied") return "denied";
  if (typeof window !== "undefined" && window.localStorage.getItem(KEY_ENDPOINT)) return "subscribed";
  return perm === "granted" ? "subscribed" : "default";
}

/** Register the service worker (idempotent — safe to call on every mount) */
async function registerSW(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  // Wait until the SW is active
  await navigator.serviceWorker.ready;
  return reg;
}

/** Convert a base64url VAPID public key to Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Fetch VAPID public key from backend */
async function fetchVapidKey(): Promise<string> {
  const resp = await fetch("/api/notifications/vapid-public-key");
  if (!resp.ok) throw new Error("Could not fetch VAPID public key");
  const data = await resp.json();
  return data.publicKey as string;
}

/** Send the subscription object to the backend */
async function saveSubscription(sub: PushSubscription, token: string | null): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await fetch("/api/notifications/subscribe", {
    method:      "POST",
    headers,
    credentials: "same-origin",
    body:        JSON.stringify({ subscription: sub.toJSON() }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error || "Failed to save subscription");
  }
}

/**
 * Main subscribe function.
 * Requests notification permission → registers SW → creates push subscription → saves to backend.
 * Returns the PushSubscription on success.
 */
export async function subscribeToPush(token: string | null = null): Promise<PushSubscription> {
  if (!isPushSupported()) throw new Error("Push notifications are not supported in this browser.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission denied.");

  const [reg, vapidKey] = await Promise.all([registerSW(), fetchVapidKey()]);

  // Check if already subscribed
  let sub = await reg.pushManager.getSubscription();

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  await saveSubscription(sub, token);

  // Cache the endpoint locally so we can detect subscribed state on reload
  window.localStorage.setItem(KEY_ENDPOINT, sub.endpoint);
  window.localStorage.setItem(KEY_SUB, JSON.stringify(sub.toJSON()));

  return sub;
}

/** Unsubscribe the browser and notify the backend */
export async function unsubscribeFromPush(token: string | null = null): Promise<void> {
  const endpoint = window.localStorage.getItem(KEY_ENDPOINT);
  if (endpoint) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    fetch("/api/notifications/subscribe", {
      method:      "DELETE",
      headers,
      credentials: "same-origin",
      body:        JSON.stringify({ endpoint }),
    }).catch(() => {}); // best-effort
  }

  window.localStorage.removeItem(KEY_ENDPOINT);
  window.localStorage.removeItem(KEY_SUB);

  // Also unsubscribe at browser level
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
    const sub = await reg?.pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch { /* ignore */ }
}

/** Send a test push to confirm end-to-end delivery */
export async function sendTestPush(token: string | null = null): Promise<void> {
  const raw = window.localStorage.getItem(KEY_SUB);
  if (!raw) throw new Error("Not subscribed — subscribe first.");
  const sub = JSON.parse(raw);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const resp = await fetch("/api/notifications/test", {
    method:      "POST",
    headers,
    credentials: "same-origin",
    body:        JSON.stringify({ subscription: sub }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err?.error || "Test notification failed");
  }
}
