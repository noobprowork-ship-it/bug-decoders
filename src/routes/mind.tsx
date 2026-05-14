import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, NeonButton } from "@/components/aurora/ui";
import { Brain, Sparkles, Loader2, AlertTriangle, Network, Lightbulb, ImageIcon } from "lucide-react";
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

type ThoughtsResult = {
  name?: string;
  era?: string;
  field?: string;
  thinkingStyle?: string;
  innovations?: string[];
  cognitivePatterns?: string[];
  mentalModels?: string[];
  image?: { url: string } | { dataUrl: string } | null;
};

const UNIVERSE_QS: { id: string; q: string }[] = [
  { id: "energy", q: "When do you feel most alive?" },
  { id: "decision_style", q: "How do you usually make big decisions?" },
  { id: "stress", q: "What does stress look like in your body and mind?" },
  { id: "ambition", q: "What would a perfect 12 months look like?" },
  { id: "fear", q: "What's a fear that quietly shapes your choices?" },
];

const PRESET_THINKERS = [
  "Leonardo da Vinci",
  "Nikola Tesla",
  "Albert Einstein",
  "Ada Lovelace",
  "Steve Jobs",
  "Marie Curie",
  "Elon Musk",
  "Alan Turing",
];

function Mind() {
  const [tab, setTab] = useState<"decode" | "universe" | "thoughts">("decode");

  const [thoughts, setThoughts] = useState("");
  const [mood, setMood] = useState("");
  const [decoding, setDecoding] = useState<Decoding | null>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [universe, setUniverse] = useState<Universe | null>(null);

  const [subject, setSubject] = useState("");
  const [thoughtsResult, setThoughtsResult] = useState<ThoughtsResult | null>(null);

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

  async function onThoughts() {
    if (!subject.trim()) return;
    setLoading(true); setError(null); setThoughtsResult(null);
    try {
      const data = await mind.thoughts({ subject }) as ThoughtsResult;
      setThoughtsResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Generation failed"); }
    finally { setLoading(false); }
  }

  const imageUrl = thoughtsResult?.image
    ? ("url" in thoughtsResult.image ? thoughtsResult.image.url : thoughtsResult.image.dataUrl)
    : null;

  return (
    <Shell>
      <PageHeader eyebrow="Module 06" icon={Brain} title="Mind" subtitle="Decode your thoughts, explore your inner universe, or visualize how great minds think." />

      <div className="flex gap-2 mb-6 flex-wrap">
        {[
          { id: "decode",   label: "Mind Decoder" },
          { id: "universe", label: "Universe Explorer" },
          { id: "thoughts", label: "Thought Visuals" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id as typeof tab); setError(null); }}
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

      {tab === "thoughts" && (
        <>
          <GlowCard glow="purple" className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-9 w-9 rounded-2xl bg-aurora/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-sm">Thought Visuals</h3>
                <p className="text-[11px] text-muted-foreground">Enter any thinker's name — AI will map their mind and generate a visual.</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Quick select</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {PRESET_THINKERS.map((name) => (
                  <button
                    key={name}
                    onClick={() => setSubject(name)}
                    className={`text-xs px-3 py-1.5 rounded-full transition ${subject === name ? "bg-aurora text-primary-foreground shadow-neon" : "glass hover:bg-white/10"}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Or type any name — Einstein, Cleopatra, Feynman…"
                className="flex-1 glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary"
                onKeyDown={(e) => { if (e.key === "Enter") onThoughts(); }}
              />
              <NeonButton onClick={onThoughts} disabled={loading || !subject.trim()}>
                {loading
                  ? <><Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> Generating</>
                  : <><ImageIcon className="inline h-4 w-4 mr-2" /> Visualize</>
                }
              </NeonButton>
            </div>
          </GlowCard>

          {loading && !thoughtsResult && (
            <GlowCard glow="blue" className="mb-6">
              <div className="flex flex-col items-center py-8 gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Mapping {subject}'s mind and generating visual…</p>
                <p className="text-xs opacity-60">This may take 15–30 seconds for the AI image.</p>
              </div>
            </GlowCard>
          )}

          {thoughtsResult && (
            <div className="grid lg:grid-cols-2 gap-4 animate-rise">
              {imageUrl && (
                <GlowCard glow="purple" className="lg:row-span-2">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Mind visualization</div>
                  <img
                    src={imageUrl}
                    alt={`${thoughtsResult.name} mind map`}
                    className="w-full rounded-2xl object-cover"
                    style={{ aspectRatio: "1/1" }}
                  />
                  <div className="mt-3 text-center">
                    <div className="font-display text-xl font-bold text-gradient">{thoughtsResult.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {thoughtsResult.era} · {thoughtsResult.field}
                    </div>
                  </div>
                </GlowCard>
              )}

              {!imageUrl && thoughtsResult.name && (
                <GlowCard glow="purple">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Thinker</div>
                  <div className="font-display text-2xl font-bold text-gradient">{thoughtsResult.name}</div>
                  <div className="text-sm text-muted-foreground mt-1">{thoughtsResult.era} · {thoughtsResult.field}</div>
                </GlowCard>
              )}

              <GlowCard glow="blue">
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Thinking style</div>
                <p className="text-sm leading-relaxed">{thoughtsResult.thinkingStyle}</p>
              </GlowCard>

              <GlowCard glow="pink">
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Key innovations</div>
                <div className="flex flex-wrap gap-2">
                  {(thoughtsResult.innovations || []).map((item, i) => (
                    <span key={i} className="glass rounded-full px-3 py-1 text-xs">{item}</span>
                  ))}
                </div>
              </GlowCard>

              <GlowCard glow="blue">
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Cognitive patterns</div>
                <ul className="space-y-1.5 text-sm">
                  {(thoughtsResult.cognitivePatterns || []).map((p, i) => <li key={i}>· {p}</li>)}
                </ul>
              </GlowCard>

              <GlowCard glow="purple" className={imageUrl ? "" : ""}>
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Mental models</div>
                <ul className="space-y-1.5 text-sm">
                  {(thoughtsResult.mentalModels || []).map((m, i) => <li key={i}>→ {m}</li>)}
                </ul>
              </GlowCard>
            </div>
          )}
        </>
      )}
    </Shell>
  );
}
