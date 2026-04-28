import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, NeonButton } from "@/components/aurora/ui";
import { Activity, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { identity } from "@/lib/api";

export const Route = createFileRoute("/identity")({
  head: () => ({ meta: [{ title: "Identity — Aurora Mind OS" }] }),
  component: Identity,
});

type Insight = {
  archetype?: string;
  strengths?: string[];
  blindspots?: string[];
  next_chapter?: string;
  mantra?: string;
};

function Identity() {
  const [traits, setTraits] = useState("curious, disciplined, deep-thinking, restless");
  const [goals, setGoals] = useState("ship a product loved by 10k people, regain physical strength");
  const [reflections, setReflections] = useState("");
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onGenerate() {
    setLoading(true); setError(null);
    try {
      const data = await identity.insights({
        traits: traits.split(",").map((s) => s.trim()).filter(Boolean),
        goals: goals.split(",").map((s) => s.trim()).filter(Boolean),
        recentReflections: reflections.split("\n").map((s) => s.trim()).filter(Boolean),
      }) as { insights: Insight };
      setInsight(data.insights);
    } catch (e) { setError(e instanceof Error ? e.message : "Generation failed"); }
    finally { setLoading(false); }
  }

  return (
    <Shell>
      <PageHeader eyebrow="Module 08" icon={Activity} title="Identity Evolution Tracker" subtitle="Distil who you are right now into a clear archetype, your strengths, your blindspots, your next chapter." />

      <GlowCard glow="blue" className="mb-6">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Traits (comma-separated)</label>
            <input value={traits} onChange={(e) => setTraits(e.target.value)} className="mt-2 w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Goals (comma-separated)</label>
            <input value={goals} onChange={(e) => setGoals(e.target.value)} className="mt-2 w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Recent reflections (one per line, optional)</label>
            <textarea value={reflections} onChange={(e) => setReflections(e.target.value)} rows={3} placeholder="Honest journal-style thoughts from the last week…" className="mt-2 w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>
          <NeonButton onClick={onGenerate} disabled={loading}>
            {loading ? <><Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> Reflecting</> : <><Sparkles className="inline h-4 w-4 mr-2" /> Generate identity insights</>}
          </NeonButton>
        </div>
      </GlowCard>

      {error && (
        <GlowCard glow="pink" className="mb-6">
          <div className="flex items-start gap-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-[oklch(0.7_0.22_320)] mt-0.5 shrink-0" />
            <div>{error}</div>
          </div>
        </GlowCard>
      )}

      {insight && (
        <>
          <GlowCard glow="purple" className="mb-6">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Archetype</div>
            <h2 className="font-display text-3xl font-bold text-gradient mb-3">{insight.archetype || "—"}</h2>
            {insight.mantra && <p className="text-sm italic">"{insight.mantra}"</p>}
          </GlowCard>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <GlowCard glow="blue">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Strengths</div>
              <ul className="space-y-2 text-sm">
                {(insight.strengths || []).map((s, i) => <li key={i}>· {s}</li>)}
              </ul>
            </GlowCard>
            <GlowCard glow="pink">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Blindspots</div>
              <ul className="space-y-2 text-sm">
                {(insight.blindspots || []).map((b, i) => <li key={i}>· {b}</li>)}
              </ul>
            </GlowCard>
          </div>

          {insight.next_chapter && (
            <GlowCard glow="purple">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Next chapter</div>
              <p className="font-display text-lg">{insight.next_chapter}</p>
            </GlowCard>
          )}
        </>
      )}
    </Shell>
  );
}
