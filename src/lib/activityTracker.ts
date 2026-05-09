/**
 * Lightweight in-app activity tracker for the Explore feature.
 *
 * Records page visits and feature interactions to localStorage so the
 * Explore module can synthesize hidden skills, behavioral patterns,
 * and career suggestions over time. Browser sandboxing makes true
 * device-wide screen-time tracking impossible, so this captures the
 * richest signal we can get: what the user actually does inside the app.
 *
 * Additionally tracks:
 *  - Tab focus / blur time (actual active engagement)
 *  - Session count (each new tab session = new session)
 *  - Daily streaks
 */

const KEY          = "lifeos.activity.v1";
const KEY_SESSION  = "lifeos.activity.sessionId";
const KEY_FOCUS    = "lifeos.activity.focus";
const MAX_EVENTS   = 1200;

export type ActivityEvent = {
  type: "view" | "action" | "focus" | "blur";
  target: string;
  at: string;
  durationMs?: number;
  meta?: Record<string, string | number>;
};

type Store = {
  events: ActivityEvent[];
  lastViewAt?: number;
  lastViewTarget?: string;
  sessionCount?: number;
  firstSeenAt?: string;
};

type FocusStore = {
  totalFocusMs: number;
  lastFocusAt?: number;
  sessionFocusMs: number;
};

// ── Persistence helpers ────────────────────────────────────────────────────

function read(): Store {
  if (typeof window === "undefined") return { events: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { events: [] };
    const parsed = JSON.parse(raw) as Store;
    if (!Array.isArray(parsed.events)) return { events: [] };
    return parsed;
  } catch {
    return { events: [] };
  }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  try {
    if (store.events.length > MAX_EVENTS) {
      store.events = store.events.slice(-MAX_EVENTS);
    }
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch { /* quota exceeded */ }
}

function readFocus(): FocusStore {
  if (typeof window === "undefined") return { totalFocusMs: 0, sessionFocusMs: 0 };
  try {
    const raw = window.localStorage.getItem(KEY_FOCUS);
    if (!raw) return { totalFocusMs: 0, sessionFocusMs: 0 };
    return JSON.parse(raw) as FocusStore;
  } catch {
    return { totalFocusMs: 0, sessionFocusMs: 0 };
  }
}

function writeFocus(f: FocusStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY_FOCUS, JSON.stringify(f));
  } catch { /* ignore */ }
}

// ── Session tracking ───────────────────────────────────────────────────────

function getOrCreateSession(): string {
  if (typeof window === "undefined") return "ssr";
  let id = window.sessionStorage.getItem(KEY_SESSION);
  if (!id) {
    id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    window.sessionStorage.setItem(KEY_SESSION, id);
    const store = read();
    store.sessionCount = (store.sessionCount || 0) + 1;
    if (!store.firstSeenAt) store.firstSeenAt = new Date().toISOString();
    write(store);
  }
  return id;
}

// ── Tab focus tracking (opt-in, no permissions needed) ────────────────────

let _focusSetup = false;

function setupFocusTracking() {
  if (typeof window === "undefined" || _focusSetup) return;
  _focusSetup = true;

  // Record focus on startup
  const f = readFocus();
  f.lastFocusAt = document.hidden ? undefined : Date.now();
  writeFocus(f);

  document.addEventListener("visibilitychange", () => {
    const f = readFocus();
    if (!document.hidden) {
      // Tab gained focus
      f.lastFocusAt = Date.now();
      writeFocus(f);
    } else {
      // Tab lost focus — record elapsed
      if (f.lastFocusAt) {
        const elapsed = Math.min(Date.now() - f.lastFocusAt, 30 * 60 * 1000);
        f.totalFocusMs = (f.totalFocusMs || 0) + elapsed;
        f.sessionFocusMs = (f.sessionFocusMs || 0) + elapsed;
        f.lastFocusAt = undefined;
        writeFocus(f);
      }
    }
  });

  // Save on unload
  window.addEventListener("beforeunload", () => {
    const f = readFocus();
    if (f.lastFocusAt) {
      const elapsed = Math.min(Date.now() - f.lastFocusAt, 30 * 60 * 1000);
      f.totalFocusMs = (f.totalFocusMs || 0) + elapsed;
      f.sessionFocusMs = (f.sessionFocusMs || 0) + elapsed;
      f.lastFocusAt = undefined;
      writeFocus(f);
    }
  });
}

if (typeof window !== "undefined") {
  setupFocusTracking();
  getOrCreateSession();
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Record a route view. Closes the previous view's duration. */
export function trackView(target: string) {
  const store = read();
  const now = Date.now();

  if (store.lastViewAt && store.lastViewTarget) {
    const dur = Math.min(now - store.lastViewAt, 30 * 60 * 1000);
    const last = store.events[store.events.length - 1];
    if (last && last.type === "view" && last.target === store.lastViewTarget) {
      last.durationMs = dur;
    }
  }

  store.events.push({
    type: "view",
    target,
    at: new Date(now).toISOString(),
  });
  store.lastViewAt = now;
  store.lastViewTarget = target;
  write(store);
}

/** Record a feature interaction (button click, generation, etc.). */
export function trackAction(name: string, meta?: Record<string, string | number>) {
  const store = read();
  store.events.push({
    type: "action",
    target: name,
    at: new Date().toISOString(),
    meta,
  });
  write(store);
}

export function getEvents(): ActivityEvent[] {
  return read().events;
}

export function clearEvents() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.localStorage.removeItem(KEY_FOCUS);
}

/** Get live active focus minutes (including current unbroken focus streak). */
export function getLiveFocusMinutes(): number {
  const f = readFocus();
  let total = f.totalFocusMs || 0;
  if (f.lastFocusAt && !document.hidden) {
    total += Math.min(Date.now() - f.lastFocusAt, 30 * 60 * 1000);
  }
  return Math.round(total / 60000);
}

/** Aggregate stats — used by the Explore page summary. */
export function summarize() {
  const store    = read();
  const events   = store.events;
  const now      = Date.now();
  const week     = now - 7 * 86400000;

  const viewsByTarget  = new Map<string, { count: number; ms: number }>();
  const actionCounts   = new Map<string, number>();
  const dailyActivity  = new Map<string, number>(); // ISO date → event count
  let totalMs          = 0;
  let viewsLast7d      = 0;
  let actionsLast7d    = 0;

  for (const e of events) {
    const t   = new Date(e.at).getTime();
    const day = e.at.slice(0, 10);
    dailyActivity.set(day, (dailyActivity.get(day) || 0) + 1);

    if (e.type === "view") {
      const cur = viewsByTarget.get(e.target) || { count: 0, ms: 0 };
      cur.count += 1;
      cur.ms    += e.durationMs || 0;
      viewsByTarget.set(e.target, cur);
      totalMs += e.durationMs || 0;
      if (t >= week) viewsLast7d += 1;
    } else if (e.type === "action") {
      actionCounts.set(e.target, (actionCounts.get(e.target) || 0) + 1);
      if (t >= week) actionsLast7d += 1;
    }
  }

  // Compute streak
  let streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (let d = 0; d < 30; d++) {
    const date = new Date(now - d * 86400000).toISOString().slice(0, 10);
    if (dailyActivity.has(date)) streak++;
    else if (d > 0) break;
  }

  const focusMinutes = getLiveFocusMinutes();

  return {
    totalEvents:   events.length,
    viewsLast7d,
    actionsLast7d,
    totalMinutes:  Math.round(totalMs / 60000),
    focusMinutes,
    sessionCount:  store.sessionCount || 1,
    firstSeenAt:   store.firstSeenAt,
    streakDays:    streak,
    topPages: [...viewsByTarget.entries()]
      .map(([target, v]) => ({ target, count: v.count, minutes: Math.round(v.ms / 60000) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    topActions: [...actionCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    dailyActivity: [...dailyActivity.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-14),
  };
}
