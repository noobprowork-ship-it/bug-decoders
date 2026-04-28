import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, StatChip, NeonButton } from "@/components/aurora/ui";
import { Sparkles, Mic, ArrowUpRight, Globe2, GitBranch, Brain, TrendingUp, Zap, Clapperboard } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Aurora Mind OS" }] }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8 animate-rise">
        <div>
          <div className="text-xs tracking-[0.3em] uppercase text-muted-foreground mb-2">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
          <h1 className="text-3xl md:text-5xl font-bold">Welcome, <span className="text-gradient">Amit</span></h1>
          <p className="text-muted-foreground mt-1">Your timeline is converging on a high-momentum week.</p>
        </div>
        <NeonButton><Mic className="inline h-4 w-4 mr-2" /> Talk to Aurora</NeonButton>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatChip label="Momentum" value="92%" />
        <StatChip label="Opportunities" value="14" accent="purple" />
        <StatChip label="Decisions" value="3" accent="pink" />
        <StatChip label="Future Score" value="A+" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Insights */}
        <GlowCard className="lg:col-span-2" glow="blue">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Today's Insight</div>
              <h3 className="text-xl font-display font-semibold mt-1">Your skill graph crossed escape velocity</h3>
            </div>
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          {/* Mock graph */}
          <div className="h-44 relative mt-2">
            <svg viewBox="0 0 400 160" className="w-full h-full">
              <defs>
                <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.78 0.18 230)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="oklch(0.78 0.18 230)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0,130 C50,120 80,110 120,90 S200,40 260,50 320,30 400,20 L400,160 L0,160 Z" fill="url(#g1)" />
              <path d="M0,130 C50,120 80,110 120,90 S200,40 260,50 320,30 400,20" fill="none" stroke="oklch(0.78 0.18 230)" strokeWidth="2" />
              {[[120,90],[200,55],[260,50],[340,28]].map(([x,y],i)=>(
                <circle key={i} cx={x} cy={y} r="4" fill="oklch(0.7 0.22 320)" className="animate-pulse" />
              ))}
            </svg>
          </div>
        </GlowCard>

        {/* Aurora Companion */}
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
            <p className="text-sm">"You have 3 high-leverage choices today. Want me to walk you through them?"</p>
            <Link to="/voice"><NeonButton className="mt-4">Open Companion</NeonButton></Link>
          </div>
        </GlowCard>

        {/* Modules grid */}
        <ModuleTile to="/goie" title="GOIE" desc="Global opportunities" icon={Globe2} glow="blue" />
        <ModuleTile to="/multiverse" title="Multiverse" desc="Simulate parallel paths" icon={GitBranch} glow="purple" />
        <ModuleTile to="/cinematic" title="Cinematic" desc="Your future, as a film" icon={Clapperboard} glow="pink" />
        <ModuleTile to="/mind" title="Mind Universe" desc="Map your inner cosmos" icon={Brain} glow="purple" />
        <ModuleTile to="/identity" title="Identity Tracker" desc="Skill & growth signals" icon={TrendingUp} glow="blue" />
        <ModuleTile to="/ethics" title="Ethics Panel" desc="Decide with foresight" icon={Zap} glow="pink" />
      </div>
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
