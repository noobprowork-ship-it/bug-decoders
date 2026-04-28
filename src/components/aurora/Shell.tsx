import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Globe2, GitBranch, Clapperboard, Brain, Activity, Scale, Mic, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/goie", label: "GOIE", icon: Globe2 },
  { to: "/multiverse", label: "Multiverse", icon: GitBranch },
  { to: "/cinematic", label: "Cinematic", icon: Clapperboard },
  { to: "/mind", label: "Mind", icon: Brain },
  { to: "/identity", label: "Identity", icon: Activity },
  { to: "/ethics", label: "Ethics", icon: Scale },
  { to: "/voice", label: "Voice AI", icon: Mic },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });

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
              <div className="font-display font-bold text-sm tracking-wide">AURORA</div>
              <div className="text-[10px] text-muted-foreground tracking-[0.25em]">MIND OS</div>
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

          <div className="glass rounded-2xl p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-aurora flex items-center justify-center text-xs font-bold text-primary-foreground">A</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">Amit</div>
              <div className="text-[10px] text-muted-foreground">Online · Pro tier</div>
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
          <span className="font-display font-bold text-sm">AURORA</span>
        </Link>
        <Link to="/voice" className="h-9 w-9 rounded-full bg-aurora flex items-center justify-center animate-pulse-glow">
          <Mic className="h-4 w-4 text-primary-foreground" />
        </Link>
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
    </div>
  );
}
