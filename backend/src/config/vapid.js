/**
 * VAPID configuration for Web Push notifications.
 *
 * Keys are read from environment variables so they survive server restarts
 * (push subscriptions are tied to the public key — changing it invalidates
 * all existing subscriptions). Generate once with:
 *   node -e "import('web-push').then(w=>console.log(JSON.stringify(w.default.generateVAPIDKeys())))"
 * Then save VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY to your env secrets.
 *
 * Falls back to the bundled dev keys below so the feature works locally
 * without any setup — do NOT use the fallback keys in production.
 */

import webpush from "web-push";

const DEV_PUBLIC  = "BCA3I_k2CCVAlqJFWQJC_CwvdVXCJ8VKOiVzxWzwhZzPudjYMeth7ljidol8oFq3JwUMJoBmXAC0Pu7NBY96Ol4";
const DEV_PRIVATE = "eMbLKcvW6mXSlu6meuMyAFiCIPO-BgfLK60Rg-S6-pI";

export const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  || DEV_PUBLIC;
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || DEV_PRIVATE;
export const VAPID_SUBJECT     = process.env.VAPID_SUBJECT     || "mailto:lifeos@replit.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export { webpush };

if (!process.env.VAPID_PUBLIC_KEY) {
  console.warn(
    "[push] VAPID_PUBLIC_KEY not set — using dev keys. " +
    "Set VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY in env secrets for production."
  );
}
