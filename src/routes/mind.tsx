import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, NeonButton } from "@/components/aurora/ui";
import { Brain, Sparkles, Loader2, AlertTriangle, Network } from "lucide-react";
import { mind } from "@/lib/api";
import { MindMap, type MindMapData } from "@/components/aurora/MindMap";

export const Route = createFileRoute("/mind")({
  head: () => ({ meta: [{ title: "Mind — LifeOS" }] }),
  component: Mind,
});

type Decoding = {
  themes?: string[];
  cognitive_patterns?: string[];
  emotional_tone?: string;
  recommendations?: string[];
  mindmap?: MindMapData;
};

type Universe = {
  personality?: { type?: string; traits?: { name: string; score: number }[] };
  thinkingPatterns?: string[];
  cognitiveBiases?: string[];
  preferredEnvironments?: string[];
  growthLevers?: string[];
  mindmap?: MindMapData;
};

const UNIVERSE_QS: { id: string; q: string }[] = [
  { id: "energy", q: "When do you feel most alive?" },
  { id: "decision_style", q: "How do you usually make big decisions?" },
  { id: "stress", q: "What does stress look like in your body and mind?" },
  { id: "ambition", q: "What would a perfect 12 months look like?" },
  { id: "fear", q: "What's a fear that quietly shapes your choices?" },
];

function Mind() {
  const [tab, setTab] = useState<"decode" | "universe">("decode");

  // Decode state
  const [thoughts, setThoughts] = useState("");
  const [mood, setMood] = useState("");
  const [decoding, setDecoding] = useState<Decoding | null>(null);

  // Universe state
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [universe, setUniverse] = useState<Universe | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDecode() {
    if (!thoughts.trim()) return;
    setLoading(true); setError(null);
    try {
      const data = await mind.decode({ thoughts, mood: mood || undefined }) as { decoding: Decoding };
      setDecoding(data.decoding);
    } catch (e) { setError(e instanceof Error ? e.message : "Decoding failed"); }
    finally { setLoading(false); }
  }

  async function onExplore() {
    setLoading(true); setError(null);
    try {
      const data = await mind.explore({ responses: answers }) as Universe;
      setUniverse(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Exploration failed"); }
    finally { setLoading(false); }
  }

  return (
    <Shell>
      <PageHeader eyebrow="Module 06" icon={Brain} title="Mind Universe" subtitle="Decode your current thoughts, or build a deep map of your mind." />

      <div className="flex gap-2 mb-6">
        {[
          { id: "decode", label: "Mind Decoder" },
          { id: "universe", label: "Universe Explorer" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as "decode" | "universe")}
            className={`px-4 py-2 rounded-2xl text-sm transition ${tab === t.id ? "bg-aurora text-primary-foreground shadow-neon" : "glass hover:bg-white/10"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <GlowCard glow="pink" className="mb-6">
          <div className="flex items-start gap-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-[oklch(0.7_0.22_320)] mt-0.5 shrink-0" />
            <div>{error}</div>
          </div>
        </GlowCard>
      )}

      {tab === "decode" && (
        <>
          <GlowCard glow="blue" className="mb-6">
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">What's on your mind?</label>
                <textarea value={thoughts} onChange={(e) => setThoughts(e.target.value)} rows={4} placeholder="Pour out your thoughts — LifeOS will find the patterns and map them…" className="mt-2 w-full glass rounded-2xl p-4 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Mood (optional)</label>
                <input value={mood} onChange={(e) => setMood(e.target.value)} placeholder="anxious / hopeful / restless…" className="mt-2 w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <NeonButton onClick={onDecode} disabled={loading || !thoughts.trim()}>
                {loading ? <><Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> Decoding</> : <><Sparkles className="inline h-4 w-4 mr-2" /> Decode my mind</>}
              </NeonButton>
            </div>
          </GlowCard>

          {decoding && (
            <>
              {decoding.mindmap && (
                <GlowCard glow="purple" className="mb-4 animate-rise">
                  <div className="flex items-center gap-2 mb-3">
                    <Network className="h-4 w-4 text-primary" />
                    <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Your mind, mapped</div>
                  </div>
                  <MindMap data={decoding.mindmap} />
                </GlowCard>
              )}
              <div className="grid md:grid-cols-2 gap-4">
                <GlowCard glow="purple">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Emotional tone</div>
                  <div className="font-display text-2xl font-bold text-gradient mb-4">{decoding.emotional_tone || "—"}</div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Themes</div>
                  <div className="flex flex-wrap gap-2">
                    {(decoding.themes || []).map((t, i) => <span key={i} className="glass rounded-full px-3 py-1 text-xs">{t}</span>)}
                  </div>
                </GlowCard>
                <GlowCard glow="blue">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Cognitive patterns</div>
                  <ul className="space-y-1 text-sm mb-4">
                    {(decoding.cognitive_patterns || []).map((p, i) => <li key={i}>· {p}</li>)}
                  </ul>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">LifeOS suggests</div>
                  <ul className="space-y-1 text-sm">
                    {(decoding.recommendations || []).map((r, i) => <li key={i}>→ {r}</li>)}
                  </ul>
                </GlowCard>
              </div>
            </>
          )}
        </>
      )}

      {tab === "universe" && (
        <>
          <GlowCard glow="blue" className="mb-6">
            <div className="space-y-4">
              {UNIVERSE_QS.map((q) => (
                <div key={q.id}>
                  <label className="text-sm">{q.q}</label>
                  <input
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    className="mt-2 w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              ))}
              <NeonButton onClick={onExplore} disabled={loading || Object.keys(answers).length < 3}>
                {loading ? <><Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> Mapping</> : <><Sparkles className="inline h-4 w-4 mr-2" /> Map my mind universe</>}
              </NeonButton>
            </div>
          </GlowCard>

          {universe && (
            <>
              {universe.mindmap && (
                <GlowCard glow="purple" className="mb-4 animate-rise">
                  <div className="flex items-center gap-2 mb-3">
                    <Network className="h-4 w-4 text-primary" />
                    <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Your mind universe</div>
                  </div>
                  <MindMap data={universe.mindmap} />
                </GlowCard>
              )}
              <div className="grid md:grid-cols-2 gap-4">
              <GlowCard glow="purple">
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Personality</div>
                <div className="font-display text-xl font-bold text-gradient mb-4">{universe.personality?.type || "—"}</div>
                <div className="space-y-2">
                  {(universe.personality?.traits || []).map((t, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1"><span>{t.name}</span><span className="text-muted-foreground">{t.score}</span></div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div className="h-full bg-aurora" style={{ width: `${Math.min(100, Math.max(0, t.score || 0))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </GlowCard>
              <GlowCard glow="blue">
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Thinking patterns</div>
                <ul className="space-y-1 text-sm mb-4">
                  {(universe.thinkingPatterns || []).map((p, i) => <li key={i}>· {p}</li>)}
                </ul>
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Cognitive biases</div>
                <ul className="space-y-1 text-sm mb-4">
                  {(universe.cognitiveBiases || []).map((p, i) => <li key={i}>· {p}</li>)}
                </ul>
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Growth levers</div>
                <ul className="space-y-1 text-sm">
                  {(universe.growthLevers || []).map((p, i) => <li key={i}>→ {p}</li>)}
                </ul>
              </GlowCard>
              </div>
            </>
          )}
        </>
      )}
    </Shell>
  );
}
