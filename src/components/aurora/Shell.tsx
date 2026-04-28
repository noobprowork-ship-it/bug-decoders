import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Globe2, GitBranch, Clapperboard, Brain, Mic, Sparkles, Compass } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { AssistantBot } from "./AssistantBot";
import { ThemeToggle } from "./ThemeToggle";
import { trackView } from "@/lib/activityTracker";
import { applyStoredTheme } from "@/lib/theme";
import { getStoredUser } from "@/lib/user";

const nav = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/goie", label: "GOIE", icon: Globe2 },
  { to: "/multiverse", label: "Multiverse", icon: GitBranch },
  { to: "/cinematic", label: "Cinematic", icon: Clapperboard },
  { to: "/mind", label: "Mind", icon: Brain },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/voice", label: "Voice AI", icon: Mic },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });

  // Apply stored theme + record this page view (Explore feature uses this).
  useEffect(() => {
    applyStoredTheme();
  }, []);
  useEffect(() => {
    trackView(path);
  }, [path]);

  const user = getStoredUser();
  const initial = (user?.name || user?.email || "L").slice(0, 1).toUpperCase();
  const displayName = user?.name || (user?.email ? user.email.split("@")[0] : "You");

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 z-40 p-4">
        <div className="glass-strong rounded-3xl flex-1 flex flex-col p-5">
          <Link to="/" className="flex items-center gap-3 mb-8 group">
            <div className="relative h-10 w-10 rounded-2xl bg-aurora animate-pulse-glow flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-display font-bold text-sm tracking-wide">LIFEOS</div>
              <div className="text-[10px] text-muted-foreground tracking-[0.25em]">YOUR LIFE, OPERATED</div>
            </div>
          </Link>

          <nav className="flex-1 space-y-1">
            {nav.map((item) => {
              const active = path === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                    active
                      ? "bg-aurora text-primary-foreground shadow-neon"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-3 mb-3 flex items-center justify-between">
            <ThemeToggle />
          </div>

          <div className="glass rounded-2xl p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-aurora flex items-center justify-center text-xs font-bold text-primary-foreground">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{displayName}</div>
              <div className="text-[10px] text-muted-foreground">Online · LifeOS ready</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-40 glass-strong border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-aurora flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-sm">LIFEOS</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle compact />
          <Link to="/voice" className="h-9 w-9 rounded-full bg-aurora flex items-center justify-center animate-pulse-glow">
            <Mic className="h-4 w-4 text-primary-foreground" />
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 pb-24 lg:pb-6">
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass-strong border-t border-border/50 px-2 py-2">
        <div className="flex items-center justify-around overflow-x-auto">
          {nav.slice(0, 5).map((item) => {
            const active = path === item.to;
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}>
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Floating AI Assistant — middle-right edge, on every page */}
      <AssistantBot />
    </div>
  );
}
