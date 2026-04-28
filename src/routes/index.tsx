import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Mic, ChromeIcon, Mail, ArrowRight, Brain, Globe2, GitBranch, Clapperboard, Activity, Scale } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Aurora Mind OS — Enter the Future" },
      { name: "description", content: "Login to Aurora Mind OS — the next-generation intelligent life operating system." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary/30 blur-[120px] animate-float" />
      <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-accent/20 blur-[140px] animate-float" style={{ animationDelay: "2s" }} />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">
        {/* Nav */}
        <nav className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-aurora animate-pulse-glow flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-display font-bold tracking-wide">AURORA</div>
              <div className="text-[10px] text-muted-foreground tracking-[0.3em] -mt-1">MIND OS</div>
            </div>
          </div>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition">
            Skip to dashboard →
          </Link>
        </nav>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Hero */}
          <div className="animate-rise">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-6">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground">Next-Gen Intelligence</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] mb-6">
              Operate your <span className="text-gradient">life</span> like the future already happened.
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-lg">
              Aurora Mind OS fuses global opportunity intelligence, multiverse simulation, and an AI companion into one holographic interface.
            </p>

            <div className="flex flex-wrap gap-3 mb-10">
              <Link to="/dashboard" className="group inline-flex items-center gap-2 bg-aurora text-primary-foreground px-6 py-3.5 rounded-2xl font-medium shadow-neon hover:scale-[1.02] transition">
                Enter Aurora <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
              </Link>
              <button className="inline-flex items-center gap-2 glass px-6 py-3.5 rounded-2xl font-medium hover:bg-white/10 transition">
                <Mic className="h-4 w-4 text-accent" /> Voice Login
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-md">
              {[
                { icon: Globe2, label: "GOIE" },
                { icon: GitBranch, label: "Multiverse" },
                { icon: Brain, label: "Mind Map" },
              ].map((m) => (
                <div key={m.label} className="glass rounded-2xl p-3 text-center">
                  <m.icon className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <div className="text-[10px] text-muted-foreground tracking-wide">{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Login Card */}
          <div className="relative animate-rise" style={{ animationDelay: "0.15s" }}>
            {/* Floating orb */}
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-20">
              <div className="relative h-24 w-24">
                <div className="absolute inset-0 rounded-full bg-aurora animate-pulse-glow" />
                <div className="absolute inset-2 rounded-full bg-background/60 backdrop-blur-xl flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <div className="absolute -inset-4 rounded-full border border-primary/30 animate-orbit" />
                <div className="absolute -inset-8 rounded-full border border-accent/20 animate-orbit" style={{ animationDirection: "reverse", animationDuration: "30s" }} />
              </div>
            </div>

            <div className="glass-strong rounded-[2rem] p-8 pt-20 shadow-soft">
              <div className="text-center mb-8">
                <h2 className="font-display text-2xl font-bold mb-2">Welcome back</h2>
                <p className="text-sm text-muted-foreground">Your AI companion is online.</p>
              </div>

              <div className="space-y-3 mb-6">
                <button className="w-full flex items-center justify-center gap-3 glass rounded-2xl py-3.5 hover:bg-white/10 transition group">
                  <ChromeIcon className="h-5 w-5 text-primary" />
                  <span className="font-medium text-sm">Continue with Google</span>
                </button>
                <button className="w-full flex items-center justify-center gap-3 glass rounded-2xl py-3.5 hover:bg-white/10 transition">
                  <Mail className="h-5 w-5 text-accent" />
                  <span className="font-medium text-sm">Continue with Email</span>
                </button>
                <button className="w-full flex items-center justify-center gap-3 bg-aurora text-primary-foreground rounded-2xl py-3.5 shadow-neon hover:scale-[1.01] transition font-medium text-sm">
                  <Mic className="h-5 w-5" />
                  Voice Login
                </button>
              </div>

              <div className="text-center text-xs text-muted-foreground">
                By continuing you agree to operate at <span className="text-primary">light speed</span>.
              </div>
            </div>

            {/* Modules preview chips */}
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {[Clapperboard, Activity, Scale].map((Icon, i) => (
                <div key={i} className="h-9 w-9 rounded-xl glass flex items-center justify-center">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
