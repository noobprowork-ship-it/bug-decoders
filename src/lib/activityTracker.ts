/**
 * Lightweight in-app activity tracker for the Explore feature.
 *
 * Records page visits and feature interactions to localStorage so the
 * Explore module can synthesize hidden skills, behavioral patterns,
 * and career suggestions over time. Browser sandboxing makes true
 * device-wide screen-time tracking impossible, so this captures the
 * richest signal we can get: what the user actually does inside the
 * app.
 */

const KEY = "lifeos.activity.v1";
const MAX_EVENTS = 1000;

export type ActivityEvent = {
  type: "view" | "action";
  /** Route path for views, feature name for actions */
  target: string;
  /** ISO timestamp */
  at: string;
  /** Time spent in ms (only for views, set on the next navigation) */
  durationMs?: number;
  /** Optional metadata (e.g. action name) */
  meta?: Record<string, string | number>;
};

type Store = {
  events: ActivityEvent[];
  lastViewAt?: number;
  lastViewTarget?: string;
};

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
  } catch {
    /* quota exceeded — ignore */
  }
}

/** Record a route view. Closes the previous view's duration. */
export function trackView(target: string) {
  const store = read();
  const now = Date.now();

  if (store.lastViewAt && store.lastViewTarget) {
    const dur = Math.min(now - store.lastViewAt, 30 * 60 * 1000); // cap 30 min
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
}

/** Aggregate stats — used by the Explore page summary. */
export function summarize() {
  const events = getEvents();
  const now = Date.now();
  const week = now - 7 * 86400000;

  const viewsByTarget = new Map<string, { count: number; ms: number }>();
  const actionCounts = new Map<string, number>();
  let totalMs = 0;
  let viewsLast7d = 0;
  let actionsLast7d = 0;

  for (const e of events) {
    const t = new Date(e.at).getTime();
    if (e.type === "view") {
      const cur = viewsByTarget.get(e.target) || { count: 0, ms: 0 };
      cur.count += 1;
      cur.ms += e.durationMs || 0;
      viewsByTarget.set(e.target, cur);
      totalMs += e.durationMs || 0;
      if (t >= week) viewsLast7d += 1;
    } else {
      actionCounts.set(e.target, (actionCounts.get(e.target) || 0) + 1);
      if (t >= week) actionsLast7d += 1;
    }
  }

  return {
    totalEvents: events.length,
    viewsLast7d,
    actionsLast7d,
    totalMinutes: Math.round(totalMs / 60000),
    topPages: [...viewsByTarget.entries()]
      .map(([target, v]) => ({ target, count: v.count, minutes: Math.round(v.ms / 60000) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    topActions: [...actionCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
  };
}
