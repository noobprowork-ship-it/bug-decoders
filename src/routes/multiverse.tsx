import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, NeonButton } from "@/components/aurora/ui";
import { GitBranch, Sparkles } from "lucide-react";

export const Route = createFileRoute("/multiverse")({
  head: () => ({ meta: [{ title: "Multiverse — Aurora Mind OS" }] }),
  component: Multiverse,
});

const paths = [
  {
    name: "Path A · Engineering",
    glow: "blue" as const,
    moments: [
      { y: "Year 1", t: "Deep systems immersion" },
      { y: "Year 3", t: "Lead architect at scaling startup" },
      { y: "Year 5", t: "Co-found AI infra company" },
      { y: "Year 10", t: "Acquired · 9-figure exit" },
    ],
    score: { wealth: 88, impact: 76, fulfillment: 72 },
  },
  {
    name: "Path B · Business",
    glow: "pink" as const,
    moments: [
      { y: "Year 1", t: "MBA · operator track" },
      { y: "Year 3", t: "PM at category-defining co." },
      { y: "Year 5", t: "VP, scaling P&L globally" },
      { y: "Year 10", t: "CEO · public company" },
    ],
    score: { wealth: 82, impact: 84, fulfillment: 79 },
  },
];

function Multiverse() {
  return (
    <Shell>
      <PageHeader eyebrow="Module 04" icon={GitBranch} title="Choice Multiverse Simulator" subtitle="Branch your timeline. See how your decisions ripple across 10 years in parallel." />

      <div className="flex flex-wrap gap-3 mb-6">
        <NeonButton><Sparkles className="inline h-4 w-4 mr-2" /> Simulate New Branch</NeonButton>
        <NeonButton variant="ghost">Compare Outcomes</NeonButton>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {paths.map((p, idx) => (
          <GlowCard key={p.name} glow={p.glow} className="animate-rise" >
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-xl font-bold">{p.name}</h3>
              <div className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground">Branch {idx + 1}</div>
            </div>

            {/* Timeline */}
            <div className="relative pl-6 space-y-5 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-aurora">
              {p.moments.map((m, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[18px] top-1 h-3 w-3 rounded-full bg-aurora shadow-neon" />
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{m.y}</div>
                  <div className="text-sm mt-0.5">{m.t}</div>
                </div>
              ))}
            </div>

            {/* Scores */}
            <div className="mt-6 grid grid-cols-3 gap-2">
              {Object.entries(p.score).map(([k, v]) => (
                <div key={k} className="glass rounded-xl p-3 text-center">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{k}</div>
                  <div className="text-xl font-display font-bold text-gradient mt-1">{v}</div>
                </div>
              ))}
            </div>
          </GlowCard>
        ))}
      </div>

      {/* Aurora insight */}
      <GlowCard glow="purple" className="mt-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-full bg-aurora flex items-center justify-center shrink-0 animate-pulse-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Aurora Insight</div>
            <p className="text-sm">Branch B yields 7% higher fulfillment but 6% lower wealth at Year 10. Hybrid path "engineer → operator" outperforms both by year 7 — want me to simulate it?</p>
          </div>
        </div>
      </GlowCard>
    </Shell>
  );
}
