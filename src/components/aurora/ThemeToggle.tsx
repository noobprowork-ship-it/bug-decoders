import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { applyStoredTheme, getStoredTheme, toggleTheme, type Theme } from "@/lib/theme";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    applyStoredTheme();
    setTheme(getStoredTheme());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<Theme>).detail;
      if (detail === "light" || detail === "dark") setTheme(detail);
    };
    window.addEventListener("lifeos:theme", onChange);
    return () => window.removeEventListener("lifeos:theme", onChange);
  }, []);

  function onClick() {
    const next = toggleTheme();
    setTheme(next);
  }

  const isDark = theme === "dark";
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  if (compact) {
    return (
      <button
        onClick={onClick}
        aria-label={label}
        title={label}
        className="h-9 w-9 rounded-full glass flex items-center justify-center hover:bg-white/10 transition"
      >
        <Icon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex items-center gap-2 px-3 py-2 rounded-xl glass text-xs hover:bg-white/10 transition"
    >
      <Icon className="h-4 w-4" />
      <span className="font-medium">{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
