import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, NeonButton } from "@/components/aurora/ui";
import { Scale, Sparkles, Loader2, AlertTriangle, ShieldCheck, X, Plus } from "lucide-react";
import { decision } from "@/lib/api";

export const Route = createFileRoute("/ethics")({
  head: () => ({ meta: [{ title: "Ethics — Aurora Mind OS" }] }),
  component: Ethics,
});

type Score = {
  option: string;
  score: number;
  riskScore: number;
  ethicsScore: number;
  pros: string[];
  cons: string[];
};

type Result = {
  recommended?: string;
  safestChoice?: string;
  scores?: Score[];
  rationale?: string;
};

function Ethics() {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [criteria, setCriteria] = useState("");
  const [stakeholders, setStakeholders] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onEvaluate() {
    const cleaned = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || cleaned.length < 2) return;
    setLoading(true); setError(null);
    try {
      const data = await decision.evaluate({
        question,
        options: cleaned,
        criteria: criteria.split(",").map((s) => s.trim()).filter(Boolean),
        stakeholders: stakeholders.split(",").map((s) => s.trim()).filter(Boolean),
      }) as Result;
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Evaluation failed"); }
    finally { setLoading(false); }
  }

  return (
    <Shell>
      <PageHeader eyebrow="Module 07" icon={Scale} title="Ethical Decision Assistant" subtitle="Compare options across risk and ethics. Get the safest, highest-integrity choice." />

      <GlowCard glow="blue" className="mb-6">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Decision question</label>
            <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="e.g. Should I take the funding round on these terms?" className="mt-2 w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Options (at least 2)</label>
            <div className="space-y-2 mt-2">
              {options.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={o}
                    onChange={(e) => setOptions(options.map((x, idx) => idx === i ? e.target.value : x))}
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    className="flex-1 glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary"
                  />
                  {options.length > 2 && (
                    <button onClick={() => setOptions(options.filter((_, idx) => idx !== i))} className="glass rounded-2xl p-3 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => setOptions([...options, ""])} className="glass rounded-2xl px-3 py-2 text-xs inline-flex items-center gap-1 hover:bg-white/10">
                <Plus className="h-3 w-3" /> Add option
              </button>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Criteria (comma-separated, optional)</label>
              <input value={criteria} onChange={(e) => setCriteria(e.target.value)} placeholder="long-term wellbeing, fairness…" className="mt-2 w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Stakeholders (comma-separated, optional)</label>
              <input value={stakeholders} onChange={(e) => setStakeholders(e.target.value)} placeholder="self, team, family…" className="mt-2 w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <NeonButton onClick={onEvaluate} disabled={loading || !question.trim() || options.filter((o) => o.trim()).length < 2}>
            {loading ? <><Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> Evaluating</> : <><Sparkles className="inline h-4 w-4 mr-2" /> Evaluate</>}
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

      {result && (
        <>
          <GlowCard glow="purple" className="mb-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Recommended</div>
                <div className="font-display text-xl font-bold text-gradient">{result.recommended || "—"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1 flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-primary" /> Safest choice</div>
                <div className="font-display text-xl font-bold">{result.safestChoice || "—"}</div>
              </div>
            </div>
            {result.rationale && <p className="text-sm text-muted-foreground mt-4 pt-4 border-t border-white/5">{result.rationale}</p>}
          </GlowCard>

          <div className="grid md:grid-cols-2 gap-4">
            {(result.scores || []).map((s, i) => (
              <GlowCard key={i} glow={i % 2 === 0 ? "blue" : "pink"} className="animate-rise">
                <div className="flex items-start justify-between mb-3 gap-3">
                  <h3 className="font-display text-base font-bold">{s.option}</h3>
                  <div className="text-2xl font-display font-bold text-gradient shrink-0">{s.score}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="glass rounded-xl p-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Risk</div>
                    <div className="text-lg font-bold">{s.riskScore}</div>
                  </div>
                  <div className="glass rounded-xl p-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Ethics</div>
                    <div className="text-lg font-bold text-primary">{s.ethicsScore}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Pros</div>
                    <ul className="space-y-1">{(s.pros || []).map((p, idx) => <li key={idx}>· {p}</li>)}</ul>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Cons</div>
                    <ul className="space-y-1">{(s.cons || []).map((c, idx) => <li key={idx}>· {c}</li>)}</ul>
                  </div>
                </div>
              </GlowCard>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}
