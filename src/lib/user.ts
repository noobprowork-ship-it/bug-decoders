/**
 * Lightweight stored-user helpers. We keep the user's display name +
 * email locally so the home screen and assistant can greet them by
 * name without round-tripping to the API on every render.
 */

const KEY = "lifeos.user";

export type StoredUser = {
  id?: string;
  name?: string;
  email?: string;
  tier?: string;
  photoUrl?: string;
};

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as StoredUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: StoredUser | null) {
  if (typeof window === "undefined") return;
  if (!user) {
    window.localStorage.removeItem(KEY);
  } else {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(user));
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("lifeos:user", { detail: user }));
  }
}
