import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Mail, ChromeIcon, ArrowRight, Brain, Globe2, GitBranch, Clapperboard } from "lucide-react";
import { LoginModal, type LoginMode } from "@/components/aurora/LoginModal";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LifeOS — Enter the Future" },
      { name: "description", content: "Login to LifeOS — your intelligent life operating system." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [modal, setModal] = useState<LoginMode | null>(null);

  return (
    <div className="min-h-screen relative overflow-hidden">
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
              <div className="font-display font-bold tracking-wide">LIFEOS</div>
              <div className="text-[10px] text-muted-foreground tracking-[0.3em] -mt-1">YOUR LIFE, OPERATED</div>
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
              LifeOS fuses global opportunity intelligence, multiverse simulation, and an always-on AI companion into one holographic interface.
            </p>

            <div className="flex flex-wrap gap-3 mb-10">
              <Link to="/dashboard" className="group inline-flex items-center gap-2 bg-aurora text-primary-foreground px-6 py-3.5 rounded-2xl font-medium shadow-neon hover:scale-[1.02] transition">
                Enter LifeOS <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
              </Link>
              <button
                onClick={() => setModal("email")}
                className="inline-flex items-center gap-2 glass px-6 py-3.5 rounded-2xl font-medium hover:bg-white/10 transition"
              >
                <Mail className="h-4 w-4 text-accent" /> Sign in
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
                <h2 className="font-display text-2xl font-bold mb-2">Welcome to LifeOS</h2>
                <p className="text-sm text-muted-foreground">Your AI companion is online.</p>
              </div>

              <div className="space-y-3 mb-6">
                <button
                  onClick={() => setModal("google")}
                  className="w-full flex items-center justify-center gap-3 glass rounded-2xl py-3.5 hover:bg-white/10 transition border border-white/10"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="font-medium text-sm">Continue with Google</span>
                </button>
                <button
                  onClick={() => setModal("email")}
                  className="w-full flex items-center justify-center gap-3 bg-aurora text-primary-foreground rounded-2xl py-3.5 shadow-neon hover:scale-[1.01] transition font-medium text-sm"
                >
                  <Mail className="h-5 w-5" />
                  Sign in with Email
                </button>
              </div>

              <p className="text-center text-xs text-muted-foreground">
                New here?{" "}
                <button onClick={() => setModal("email")} className="text-primary hover:underline">
                  Create an account
                </button>
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {[Clapperboard, Brain, Globe2].map((Icon, i) => (
                <div key={i} className="h-9 w-9 rounded-xl glass flex items-center justify-center">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <LoginModal
          mode={modal}
          onClose={() => setModal(null)}
          onSuccess={() => {
            setModal(null);
            navigate({ to: "/dashboard" });
          }}
        />
      )}
    </div>
  );
}
