import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, NeonButton } from "@/components/aurora/ui";
import { Globe2, Sparkles, Loader2, AlertTriangle, TrendingUp, ExternalLink } from "lucide-react";
import { goie } from "@/lib/api";

export const Route = createFileRoute("/goie")({
  head: () => ({ meta: [{ title: "GOIE — LifeOS" }] }),
  component: Goie,
});

type Reference = { title?: string; url?: string; why?: string };
type Opp = {
  title: string;
  description?: string;
  category?: string;
  region?: string;
  score?: number;
  tags?: string[];
  sourceUrl?: string;
  sourceName?: string;
  references?: Reference[];
};

type Trend = { label: string; delta: string; horizon: string; confidence: number };
type Trends = { headline?: string; trends?: Trend[]; insights?: string[]; actionPrompts?: string[] };

function prettyHost(url?: string): string | null {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

function Goie() {
  const [interests, setInterests] = useState("AI, design, indie products");
  const [skills, setSkills] = useState("React, prompt engineering");
  const [region, setRegion] = useState("global");
  const [count, setCount] = useState(5);
  const [opps, setOpps] = useState<Opp[]>([]);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [loading, setLoading] = useState<"none" | "opps" | "trends">("none");
  const [error, setError] = useState<string | null>(null);

  async function onGenerate() {
    setLoading("opps");
    setError(null);
    try {
      const data = await goie.generate({
        interests: interests.split(",").map((s) => s.trim()).filter(Boolean),
        skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
        region,
        count,
      }) as { opportunities: Opp[] };
      setOpps(data.opportunities || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate opportunities");
    } finally {
      setLoading("none");
    }
  }

  async function onTrends() {
    setLoading("trends");
    setError(null);
    try {
      const data = await goie.trends({ focus: interests || "AI", region }) as Trends;
      setTrends(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load trends");
    } finally {
      setLoading("none");
    }
  }

  return (
    <Shell>
      <PageHeader
        eyebrow="Module 02"
        icon={Globe2}
        title="Global Opportunity Intelligence Engine"
        subtitle="Personalized opportunities and trends, generated for who you are right now."
      />

      <GlowCard glow="blue" className="mb-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Interests (comma-separated)</label>
            <input value={interests} onChange={(e) => setInterests(e.target.value)} className="mt-2 w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Skills (comma-separated)</label>
            <input value={skills} onChange={(e) => setSkills(e.target.value)} className="mt-2 w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Region</label>
            <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="global, EMEA, India…" className="mt-2 w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">How many ({count})</label>
            <input type="range" min={3} max={10} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-full mt-3 accent-primary" />
          </div>
        </div>
        <div className="flex flex-wrap gap-3 mt-5">
          <NeonButton onClick={onGenerate} disabled={loading !== "none"}>
            {loading === "opps" ? <><Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> Generating</> : <><Sparkles className="inline h-4 w-4 mr-2" /> Generate opportunities</>}
          </NeonButton>
          <NeonButton variant="ghost" onClick={onTrends} disabled={loading !== "none"}>
            {loading === "trends" ? <><Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> Scanning</> : <><TrendingUp className="inline h-4 w-4 mr-2" /> Show trends</>}
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

      {trends && (
        <GlowCard glow="purple" className="mb-6">
          {trends.headline && <h3 className="font-display text-xl font-bold mb-3">{trends.headline}</h3>}
          {trends.trends && trends.trends.length > 0 && (
            <div className="grid sm:grid-cols-2 gap-3 mb-4">
              {trends.trends.map((t, i) => (
                <div key={i} className="glass rounded-2xl p-4">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{t.horizon}</div>
                  <div className="font-medium text-sm mt-1">{t.label}</div>
                  <div className="flex items-center justify-between mt-2 text-xs">
                    <span className="text-primary font-bold">{t.delta}</span>
                    <span className="text-muted-foreground">conf {Math.round((t.confidence || 0) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {trends.insights && trends.insights.length > 0 && (
            <div className="text-sm space-y-1">
              {trends.insights.map((i, idx) => <div key={idx}>· {i}</div>)}
            </div>
          )}
          {trends.actionPrompts && trends.actionPrompts.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Try this</div>
              {trends.actionPrompts.map((a, i) => <div key={i} className="text-sm">→ {a}</div>)}
            </div>
          )}
        </GlowCard>
      )}

      {opps.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {opps.map((o, i) => (
            <GlowCard key={i} glow={i % 2 === 0 ? "blue" : "pink"} className="animate-rise">
              <div className="flex items-start justify-between mb-3 gap-3">
                <h3 className="font-display text-base font-bold">{o.title}</h3>
                <div className="text-2xl font-display font-bold text-gradient shrink-0">{o.score ?? "—"}</div>
              </div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">{o.category} · {o.region || region}</div>
              {o.description && <p className="text-sm text-muted-foreground mb-3">{o.description}</p>}
              {o.tags && o.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {o.tags.map((t, idx) => <span key={idx} className="glass rounded-full px-2 py-0.5 text-[10px]">{t}</span>)}
                </div>
              )}
              {o.sourceUrl && (
                <a
                  href={o.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mb-3"
                >
                  {o.sourceName || prettyHost(o.sourceUrl) || "Source"} <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {o.references && o.references.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">References</div>
                  <ul className="space-y-1.5">
                    {o.references.map((r, idx) => (
                      <li key={idx} className="text-xs">
                        {r.url ? (
                          <a href={r.url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                            {r.title || prettyHost(r.url) || r.url} <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span>{r.title}</span>
                        )}
                        {r.why && <div className="text-muted-foreground mt-0.5">{r.why}</div>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </GlowCard>
          ))}
        </div>
      )}
    </Shell>
  );
}
