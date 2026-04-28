import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, NeonButton } from "@/components/aurora/ui";
import { Scale, Check, X, Sparkles } from "lucide-react";

export const Route = createFileRoute("/ethics")({
  head: () => ({ meta: [{ title: "Ethics Panel — Aurora Mind OS" }] }),
  component: Ethics,
});

const pros = [
  "Aligns with your 5-year purpose vector",
  "Net-positive impact across 3 stakeholder groups",
  "Reversible within 90 days if needed",
  "Increases optionality for future decisions",
];
const cons = [
  "Short-term cash flow strain (≈3 months)",
  "Reduces social bandwidth temporarily",
  "Requires relocation in Q3",
];

function Ethics() {
  return (
    <Shell>
      <PageHeader eyebrow="Module 08" icon={Scale} title="AI Ethical Decision Panel" subtitle="Decide with foresight. Pros, cons, and the long-tail consequences — weighed in real time." />

      <GlowCard glow="purple" className="mb-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Decision under review</div>
        <h2 className="font-display text-2xl md:text-3xl font-bold">Should I leave my current role to start the company?</h2>
        <div className="flex gap-3 mt-4">
          <NeonButton><Check className="inline h-4 w-4 mr-2" />Proceed</NeonButton>
          <NeonButton variant="ghost"><X className="inline h-4 w-4 mr-2" />Hold</NeonButton>
        </div>
      </GlowCard>

      <div className="grid md:grid-cols-2 gap-4">
        <GlowCard glow="blue">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center"><Check className="h-4 w-4 text-primary" /></div>
            <h3 className="font-display text-lg font-semibold">Pros</h3>
          </div>
          <ul className="space-y-3">
            {pros.map((p, i) => (
              <li key={i} className="flex gap-3 text-sm animate-rise" style={{ animationDelay: `${i * 0.06}s` }}>
                <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </GlowCard>

        <GlowCard glow="pink">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center"><X className="h-4 w-4 text-accent" /></div>
            <h3 className="font-display text-lg font-semibold">Cons</h3>
          </div>
          <ul className="space-y-3">
            {cons.map((p, i) => (
              <li key={i} className="flex gap-3 text-sm animate-rise" style={{ animationDelay: `${i * 0.06}s` }}>
                <span className="h-1.5 w-1.5 rounded-full bg-accent mt-2 shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </GlowCard>
      </div>

      {/* Scale */}
      <GlowCard className="mt-6" glow="purple">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold">Aurora Verdict</h3>
          <div className="text-xs text-primary">Confidence 87%</div>
        </div>
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <div className="relative">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.25em] text-muted-foreground mb-2">
              <span>Hold</span><span>Proceed</span>
            </div>
            <div className="h-3 rounded-full bg-white/5 overflow-hidden relative">
              <div className="absolute inset-y-0 left-0 bg-aurora rounded-full" style={{ width: "72%" }} />
              <div className="absolute top-1/2 -translate-y-1/2 h-5 w-5 rounded-full bg-foreground shadow-neon" style={{ left: "calc(72% - 10px)" }} />
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm">"Long-term impact outweighs short-term friction. I recommend proceeding — with a 6-month runway buffer locked in first."</p>
          </div>
        </div>
      </GlowCard>
    </Shell>
  );
}
