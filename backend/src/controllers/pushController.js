import { webpush, VAPID_PUBLIC_KEY } from "../config/vapid.js";
import { tryPg, pgQuery, isPgReady } from "../config/postgres.js";
import { openai } from "../config/openai.js";
import { tryAI } from "../utils/ai.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

/** GET /api/notifications/vapid-public-key — frontend needs this to subscribe */
export function getVapidKey(_req, res) {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
}

/** POST /api/notifications/subscribe — save a push subscription */
export async function subscribe(req, res, next) {
  try {
    const sub = req.body?.subscription;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return res.status(400).json({ error: "Invalid subscription object" });
    }

    const userId = req.user?.id || null;
    const endpoint = sub.endpoint;

    await tryPg(async () => {
      await pgQuery(
        `INSERT INTO lifeos_push_subscriptions (user_id, endpoint, subscription_json, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (endpoint) DO UPDATE
           SET user_id           = EXCLUDED.user_id,
               subscription_json = EXCLUDED.subscription_json,
               updated_at        = NOW()`,
        [userId, endpoint, JSON.stringify(sub)]
      );
    });

    console.log("[push] subscription saved:", endpoint.slice(-30));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/notifications/subscribe — remove a subscription */
export async function unsubscribe(req, res, next) {
  try {
    const endpoint = req.body?.endpoint;
    if (!endpoint) return res.status(400).json({ error: "endpoint required" });

    await tryPg(async () => {
      await pgQuery("DELETE FROM lifeos_push_subscriptions WHERE endpoint = $1", [endpoint]);
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/** POST /api/notifications/test — send a test notification to the caller's subscription */
export async function sendTest(req, res, next) {
  try {
    const sub = req.body?.subscription;
    if (!sub?.endpoint) return res.status(400).json({ error: "subscription required" });

    const payload = JSON.stringify({
      title: "LifeOS · Test notification",
      body:  "Push notifications are working! Your weekly insights will arrive here.",
      icon:  "/icon-192.png",
      badge: "/icon-72.png",
      tag:   "lifeos-test",
      data:  { url: "/explore" },
    });

    await webpush.sendNotification(sub, payload);
    res.json({ ok: true });
  } catch (err) {
    console.warn("[push] test send failed:", err.message);
    // 410 Gone / 404 = subscription expired — clean it up
    if (err.statusCode === 410 || err.statusCode === 404) {
      await tryPg(async () => {
        await pgQuery("DELETE FROM lifeos_push_subscriptions WHERE endpoint = $1", [req.body?.subscription?.endpoint]);
      });
      return res.status(410).json({ error: "Subscription expired. Please re-subscribe." });
    }
    next(err);
  }
}

/**
 * sendWeeklyInsights — called by the backend scheduler.
 * Generates a short AI-written insight blurb and broadcasts it
 * to every stored subscription.
 */
export async function sendWeeklyInsights() {
  if (!isPgReady()) {
    console.log("[push] postgres not ready — skipping weekly send");
    return;
  }

  const rows = await tryPg(async () => {
    const r = await pgQuery(
      "SELECT endpoint, subscription_json FROM lifeos_push_subscriptions ORDER BY updated_at DESC LIMIT 500"
    );
    return r.rows;
  });

  if (!rows?.length) {
    console.log("[push] no subscriptions — skipping weekly send");
    return;
  }

  // Generate a brief weekly insight via AI (or use a deterministic one)
  let insightText = "Open your Explore module to see your weekly behavior report — new patterns uncovered!";
  try {
    const day = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const completion = await tryAI(() =>
      openai.chat.completions.create({
        model: CHAT_MODEL,
        max_tokens: 60,
        messages: [
          {
            role: "system",
            content:
              "Write a single short, motivating push notification body (max 70 chars) that prompts a LifeOS user to check their weekly Explore behavior report. Vary the phrasing each time. No quotes.",
          },
          { role: "user", content: `Today is ${day}. Write the notification body.` },
        ],
      })
    );
    const text = completion.choices?.[0]?.message?.content?.trim();
    if (text) insightText = text;
  } catch (e) {
    console.warn("[push] AI insight gen failed, using default:", e.message);
  }

  const payload = JSON.stringify({
    title: "LifeOS · Weekly Insight Ready",
    body:  insightText,
    icon:  "/icon-192.png",
    badge: "/icon-72.png",
    tag:   "lifeos-weekly",
    renotify: true,
    data: { url: "/explore" },
  });

  let sent = 0;
  let failed = 0;
  const expired = [];

  await Promise.allSettled(
    rows.map(async (row) => {
      try {
        const sub = JSON.parse(row.subscription_json);
        await webpush.sendNotification(sub, payload);
        sent++;
      } catch (err) {
        failed++;
        if (err.statusCode === 410 || err.statusCode === 404) {
          expired.push(row.endpoint);
        }
      }
    })
  );

  // Clean up expired subscriptions
  if (expired.length) {
    await tryPg(async () => {
      await pgQuery(
        "DELETE FROM lifeos_push_subscriptions WHERE endpoint = ANY($1)",
        [expired]
      );
    });
  }

  // Record last-sent timestamp
  await tryPg(async () => {
    await pgQuery(
      `INSERT INTO lifeos_push_meta (key, value, updated_at)
       VALUES ('last_weekly_sent', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [new Date().toISOString()]
    );
  });

  console.log(`[push] weekly insights sent: ${sent} ok, ${failed} failed, ${expired.length} expired cleaned`);
}

/**
 * shouldSendWeekly — true if it's been ≥7 days since last weekly send.
 * Reads from Postgres so the check survives server restarts.
 */
export async function shouldSendWeekly() {
  if (!isPgReady()) return false;
  const row = await tryPg(async () => {
    const r = await pgQuery(
      "SELECT value FROM lifeos_push_meta WHERE key = 'last_weekly_sent'",
      []
    );
    return r.rows[0];
  });
  if (!row) return true; // Never sent — go ahead
  const lastSent = new Date(row.value).getTime();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - lastSent >= sevenDays;
}
