import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, NeonButton } from "@/components/aurora/ui";
import { Clapperboard, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { cinematic } from "@/lib/api";

export const Route = createFileRoute("/cinematic")({
  head: () => ({ meta: [{ title: "Cinematic — LifeOS" }] }),
  component: Cinematic,
});

type Scene = {
  index: number;
  setting: string;
  action: string;
  dialogue?: string;
  visual_prompt: string;
  image?: { url?: string; dataUrl?: string } | null;
};
type Result = { title?: string; logline?: string; scenes?: Scene[] };

const TONES = ["epic", "intimate", "noir", "hopeful", "surreal"];

function Cinematic() {
  const [theme, setTheme] = useState("");
  const [tone, setTone] = useState("epic");
  const [protagonist, setProtagonist] = useState("");
  const [scenes, setScenes] = useState(5);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onGenerate() {
    if (!theme.trim()) return;
    setLoading(true); setError(null);
    try {
      const data = await cinematic.generate({
        theme,
        tone,
        protagonist: protagonist || undefined,
        scenes,
      }) as { cinematic: Result };
      setResult(data.cinematic);
    } catch (e) { setError(e instanceof Error ? e.message : "Generation failed"); }
    finally { setLoading(false); }
  }

  return (
    <Shell>
      <PageHeader eyebrow="Module 05" icon={Clapperboard} title="Life Cinematic Director" subtitle="Turn the story of your life into cinema — with AI-generated images for every scene." />

      <GlowCard glow="blue" className="mb-6">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Theme</label>
            <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. Quitting my corporate life to build something real" className="mt-2 w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Protagonist (optional)</label>
            <input value={protagonist} onChange={(e) => setProtagonist(e.target.value)} placeholder="A maker in their late 30s…" className="mt-2 w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Tone</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {TONES.map((t) => (
                  <button key={t} onClick={() => setTone(t)} className={`px-3 py-1.5 rounded-xl text-xs transition ${tone === t ? "bg-aurora text-primary-foreground shadow-neon" : "glass hover:bg-white/10"}`}>{t}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Scenes ({scenes})</label>
              <input type="range" min={3} max={8} value={scenes} onChange={(e) => setScenes(Number(e.target.value))} className="w-full mt-3 accent-primary" />
            </div>
          </div>
          <NeonButton onClick={onGenerate} disabled={loading || !theme.trim()}>
            {loading ? <><Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> Directing & rendering scenes…</> : <><Sparkles className="inline h-4 w-4 mr-2" /> Generate cinematic</>}
          </NeonButton>
          {loading && (
            <p className="text-[11px] text-muted-foreground mt-2">
              Image generation can take 30–60 seconds. Hang tight.
            </p>
          )}
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

      {result && (
        <>
          <GlowCard glow="purple" className="mb-6">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Title</div>
            <h2 className="font-display text-3xl font-bold text-gradient mb-3">{result.title || theme}</h2>
            {result.logline && <p className="text-muted-foreground italic">"{result.logline}"</p>}
          </GlowCard>

          <div className="space-y-4">
            {(result.scenes || []).map((s, i) => {
              const imgSrc = s.image?.url || s.image?.dataUrl || null;
              return (
                <GlowCard key={i} glow={i % 2 === 0 ? "blue" : "pink"} className="animate-rise">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Scene {s.index ?? i + 1}</div>
                    <div className="text-[10px] uppercase tracking-[0.25em] text-primary">{s.setting}</div>
                  </div>
                  {imgSrc ? (
                    <div className="rounded-2xl overflow-hidden mb-3 bg-black/30">
                      <img
                        src={imgSrc}
                        alt={s.visual_prompt || `Scene ${s.index ?? i + 1}`}
                        className="w-full h-auto block"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="rounded-2xl mb-3 p-6 glass text-center text-xs text-muted-foreground">
                      Image generation skipped or unavailable for this scene.
                    </div>
                  )}
                  <p className="text-sm mb-3">{s.action}</p>
                  {s.dialogue && <p className="text-sm italic glass rounded-2xl p-3 mb-3">{s.dialogue}</p>}
                  {s.visual_prompt && (
                    <div className="border-t border-white/5 pt-3">
                      <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Visual prompt</div>
                      <p className="text-xs font-mono text-muted-foreground">{s.visual_prompt}</p>
                    </div>
                  )}
                </GlowCard>
              );
            })}
          </div>
        </>
      )}
    </Shell>
  );
}
