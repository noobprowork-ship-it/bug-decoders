import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader } from "@/components/aurora/ui";
import { Mic, Globe, Languages, Volume2 } from "lucide-react";

export const Route = createFileRoute("/voice")({
  head: () => ({ meta: [{ title: "Voice AI Companion — Aurora Mind OS" }] }),
  component: Voice,
});

function Voice() {
  return (
    <Shell>
      <PageHeader eyebrow="Module 09" icon={Mic} title="Voice AI Companion" subtitle="Always on. Multilingual. Speaks in the tone you need — gentle coach, sharp strategist, or quiet friend." />

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Orb */}
        <GlowCard glow="pink" className="lg:col-span-2 flex flex-col items-center justify-center min-h-[480px]">
          <div className="relative h-64 w-64">
            {/* Outer rings */}
            <div className="absolute inset-0 rounded-full border border-primary/20 animate-orbit" />
            <div className="absolute inset-6 rounded-full border border-accent/20 animate-orbit" style={{ animationDirection: "reverse", animationDuration: "30s" }} />
            <div className="absolute inset-12 rounded-full border border-[oklch(0.7_0.22_295)]/30 animate-orbit" style={{ animationDuration: "15s" }} />

            {/* Orb */}
            <div className="absolute inset-16 rounded-full bg-aurora animate-pulse-glow" />
            <div className="absolute inset-20 rounded-full bg-background/40 backdrop-blur-xl flex items-center justify-center">
              <Mic className="h-10 w-10 text-primary" />
            </div>

            {/* Sound waves */}
            <svg className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-48 h-12" viewBox="0 0 200 50">
              {[10, 25, 18, 35, 22, 40, 28, 16, 30, 20].map((h, i) => (
                <rect key={i} x={i * 20} y={25 - h / 2} width="8" height={h} rx="4" fill="oklch(0.78 0.18 230)">
                  <animate attributeName="height" values={`${h};${h*2};${h}`} dur={`${0.8 + i * 0.1}s`} repeatCount="indefinite" />
                  <animate attributeName="y" values={`${25-h/2};${25-h};${25-h/2}`} dur={`${0.8 + i * 0.1}s`} repeatCount="indefinite" />
                </rect>
              ))}
            </svg>
          </div>

          <div className="mt-20 text-center">
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">Listening</div>
            <p className="font-display text-xl">"Hey Aurora, what should I focus on today?"</p>
          </div>
        </GlowCard>

        {/* Controls */}
        <div className="space-y-4">
          <GlowCard glow="blue">
            <div className="flex items-center gap-2 mb-4"><Languages className="h-4 w-4 text-primary" /><h3 className="font-display font-semibold">Language</h3></div>
            <div className="grid grid-cols-2 gap-2">
              {["English", "हिन्दी", "Español", "日本語", "Français", "العربية"].map((l, i) => (
                <button key={l} className={`rounded-xl py-2 text-sm transition ${i===0 ? "bg-aurora text-primary-foreground shadow-neon" : "glass hover:bg-white/10"}`}>{l}</button>
              ))}
            </div>
          </GlowCard>

          <GlowCard glow="purple">
            <div className="flex items-center gap-2 mb-4"><Volume2 className="h-4 w-4 text-accent" /><h3 className="font-display font-semibold">Tone</h3></div>
            <div className="space-y-2">
              {["Gentle coach", "Sharp strategist", "Quiet friend", "Bold motivator"].map((t, i) => (
                <button key={t} className={`w-full text-left rounded-xl px-4 py-2.5 text-sm transition flex items-center justify-between ${i===1 ? "bg-aurora text-primary-foreground shadow-neon" : "glass hover:bg-white/10"}`}>
                  {t}
                  {i===1 && <span className="text-[10px] uppercase tracking-widest">Active</span>}
                </button>
              ))}
            </div>
          </GlowCard>

          <GlowCard glow="pink">
            <div className="flex items-center gap-2 mb-2"><Globe className="h-4 w-4 text-primary" /><h3 className="font-display font-semibold">Status</h3></div>
            <div className="flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span>Online · Real-time mode</span>
            </div>
          </GlowCard>
        </div>
      </div>
    </Shell>
  );
}
