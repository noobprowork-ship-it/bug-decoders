/**
 * Theme management — light / dark mode with localStorage persistence
 * and a custom event so listeners can react to changes.
 *
 * Default: LIGHT (a clean white palette). Users can flip to dark via the
 * ThemeToggle in the top-right; their choice is persisted.
 */

const KEY = "lifeos.theme";

export type Theme = "dark" | "light";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const raw = window.localStorage.getItem(KEY);
  return raw === "dark" ? "dark" : "light";
}

export function setTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "light") {
    root.classList.remove("dark");
    root.classList.add("light");
  } else {
    root.classList.remove("light");
    root.classList.add("dark");
  }
  try {
    window.localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("lifeos:theme", { detail: theme }));
}

export function applyStoredTheme() {
  setTheme(getStoredTheme());
}

export function toggleTheme(): Theme {
  const next: Theme = getStoredTheme() === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}
