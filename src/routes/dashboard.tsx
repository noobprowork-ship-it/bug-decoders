import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, StatChip, NeonButton } from "@/components/aurora/ui";
import { Sparkles, Mic, ArrowUpRight, Globe2, GitBranch, Brain, TrendingUp, Zap, Clapperboard, Loader2 } from "lucide-react";
import { dashboard } from "@/lib/api";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Aurora Mind OS" }] }),
  component: Dashboard,
});

type Data = {
  user?: { name?: string; tier?: string };
  metrics?: {
    momentumPct: number;
    opportunitiesCount: number;
    decisionsCount: number;
    futureScore: string;
    sessionsLast7d: number;
    sessionsPrior7d: number;
  };
  insights?: string[];
  predictions?: { horizon: string; claim: string; confidence: number }[];
  recentActivity?: { type: string; title: string; at: string }[];
  topOpportunities?: { title: string; score: number; category: string }[];
};

function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboard.get()
      .then((d) => setData(d as Data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  const name = data?.user?.name || "friend";
  const m = data?.metrics;

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8 animate-rise">
        <div>
          <div className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-2">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <h1 className="text-3xl md:text-5xl font-bold">
            Welcome, <span className="text-gradient">{name}</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            {m?.sessionsLast7d
              ? `${m.sessionsLast7d} sessions in the last 7 days — momentum building.`
              : "Try a module below — Aurora is online and ready."}
          </p>
        </div>
        <Link to="/voice"><NeonButton><Mic className="inline h-4 w-4 mr-2" /> Talk to Aurora</NeonButton></Link>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your live dashboard…
        </div>
      )}
      {error && (
        <GlowCard glow="pink" className="mb-6">
          <div className="text-sm">Couldn't load dashboard: {error}</div>
        </GlowCard>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatChip label="Momentum" value={m ? `${m.momentumPct}%` : "—"} />
        <StatChip label="Opportunities" value={m ? String(m.opportunitiesCount) : "—"} accent="purple" />
        <StatChip label="Decisions" value={m ? String(m.decisionsCount) : "—"} accent="pink" />
        <StatChip label="Future Score" value={m?.futureScore || "—"} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <GlowCard className="lg:col-span-2" glow="blue">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Today's insights</div>
              <h3 className="text-xl font-display font-semibold mt-1">
                {data?.insights?.[0] || "Tap a module to start your timeline"}
              </h3>
            </div>
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {(data?.insights || []).slice(1).map((s, i) => <li key={i}>· {s}</li>)}
            {(!data?.insights || data.insights.length === 0) && !loading && (
              <li className="text-muted-foreground">Aurora will surface insights as you use the modules.</li>
            )}
          </ul>
          {data?.predictions && data.predictions.length > 0 && (
            <div className="mt-5 pt-4 border-t border-white/5">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Predictions</div>
              <div className="grid sm:grid-cols-2 gap-2">
                {data.predictions.map((p, i) => (
                  <div key={i} className="glass rounded-xl p-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{p.horizon} · {Math.round((p.confidence || 0) * 100)}%</div>
                    <div className="text-sm mt-1">{p.claim}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlowCard>

        <GlowCard glow="pink">
          <div className="flex flex-col items-center text-center">
            <div className="relative h-24 w-24 mb-4">
              <div className="absolute inset-0 rounded-full bg-aurora animate-pulse-glow" />
              <div className="absolute inset-2 rounded-full bg-background/60 backdrop-blur-xl flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <div className="absolute -inset-3 rounded-full border border-primary/30 animate-orbit" />
            </div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1">Aurora</div>
            <p className="text-sm">Ask me anything — life, work, decisions, ideas.</p>
            <Link to="/voice"><NeonButton className="mt-4">Open companion</NeonButton></Link>
          </div>
        </GlowCard>

        <ModuleTile to="/goie" title="GOIE" desc="Global opportunities" icon={Globe2} glow="blue" />
        <ModuleTile to="/multiverse" title="Multiverse" desc="Simulate parallel paths" icon={GitBranch} glow="purple" />
        <ModuleTile to="/cinematic" title="Cinematic" desc="Your future, as a film" icon={Clapperboard} glow="pink" />
        <ModuleTile to="/mind" title="Mind Universe" desc="Map your inner cosmos" icon={Brain} glow="purple" />
        <ModuleTile to="/identity" title="Identity Tracker" desc="Skill & growth signals" icon={TrendingUp} glow="blue" />
        <ModuleTile to="/ethics" title="Ethics Panel" desc="Decide with foresight" icon={Zap} glow="pink" />
      </div>

      {(data?.recentActivity?.length || data?.topOpportunities?.length) ? (
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          {data?.recentActivity && data.recentActivity.length > 0 && (
            <GlowCard glow="blue">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Recent activity</div>
              <ul className="space-y-2 text-sm">
                {data.recentActivity.map((a, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate">{a.title}</span>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground shrink-0">{a.type}</span>
                  </li>
                ))}
              </ul>
            </GlowCard>
          )}
          {data?.topOpportunities && data.topOpportunities.length > 0 && (
            <GlowCard glow="purple">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Top opportunities</div>
              <ul className="space-y-2 text-sm">
                {data.topOpportunities.map((o, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate">{o.title}</span>
                    <span className="font-bold text-primary shrink-0">{o.score}</span>
                  </li>
                ))}
              </ul>
            </GlowCard>
          )}
        </div>
      ) : null}
    </Shell>
  );
}

function ModuleTile({ to, title, desc, icon: Icon, glow }: any) {
  return (
    <Link to={to} className="group">
      <GlowCard glow={glow} className="h-full hover:scale-[1.02] transition-transform">
        <div className="flex items-start justify-between mb-6">
          <div className="h-11 w-11 rounded-2xl bg-aurora/20 border border-primary/30 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
        </div>
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </GlowCard>
    </Link>
  );
}
