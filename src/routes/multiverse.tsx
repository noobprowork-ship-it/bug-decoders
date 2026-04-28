import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, NeonButton } from "@/components/aurora/ui";
import { GitBranch, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { multiverse } from "@/lib/api";

export const Route = createFileRoute("/multiverse")({
  head: () => ({ meta: [{ title: "Multiverse — LifeOS" }] }),
  component: Multiverse,
});

type Branch = {
  name: string;
  summary: string;
  probability: number;
  milestones: { year: number; event: string }[];
  risks: string[];
  wins: string[];
};

type Result = {
  branches: Branch[];
  recommended?: string;
  rationale?: string;
};

function Multiverse() {
  const [decision, setDecision] = useState("");
  const [context, setContext] = useState("");
  const [branches, setBranches] = useState(3);
  const [horizon, setHorizon] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function onSimulate() {
    if (!decision.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await multiverse.simulate({
        decision,
        context: context || undefined,
        branches,
        horizonYears: horizon,
      }) as Result;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  }

  const glows: ("blue" | "pink" | "purple")[] = ["blue", "pink", "purple"];

  return (
    <Shell>
      <PageHeader
        eyebrow="Module 04"
        icon={GitBranch}
        title="Choice Multiverse Simulator"
        subtitle="Branch your timeline. See how a decision ripples across years in parallel."
      />

      <GlowCard glow="blue" className="mb-6">
        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Decision</label>
            <textarea
              value={decision}
              onChange={(e) => setDecision(e.target.value)}
              placeholder="e.g. Should I leave my job to launch my AI startup?"
              rows={2}
              className="mt-2 w-full glass rounded-2xl p-4 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Context (optional)</label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Anything Aurora should know — your situation, constraints, values…"
              rows={2}
              className="mt-2 w-full glass rounded-2xl p-4 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Branches</label>
              <input type="range" min={2} max={5} value={branches} onChange={(e) => setBranches(Number(e.target.value))} className="w-full mt-2 accent-primary" />
              <div className="text-sm mt-1">{branches} alternate futures</div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Horizon</label>
              <input type="range" min={1} max={20} value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} className="w-full mt-2 accent-primary" />
              <div className="text-sm mt-1">{horizon} years</div>
            </div>
          </div>
          <NeonButton onClick={onSimulate} disabled={loading || !decision.trim()}>
            {loading ? (
              <><Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> Simulating futures…</>
            ) : (
              <><Sparkles className="inline h-4 w-4 mr-2" /> Simulate</>
            )}
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

      {result?.branches && result.branches.length > 0 && (
        <>
          <div className={`grid gap-4 ${result.branches.length >= 3 ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2"}`}>
            {result.branches.map((b, idx) => (
              <GlowCard key={idx} glow={glows[idx % glows.length]} className="animate-rise">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display text-lg font-bold">{b.name || `Branch ${idx + 1}`}</h3>
                  <div className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground">
                    {Math.round((b.probability || 0) * 100)}%
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{b.summary}</p>

                {b.milestones?.length > 0 && (
                  <div className="relative pl-5 space-y-3 before:content-[''] before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-aurora">
                    {b.milestones.map((m, i) => (
                      <div key={i} className="relative">
                        <div className="absolute -left-[14px] top-1 h-2.5 w-2.5 rounded-full bg-aurora shadow-neon" />
                        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Year {m.year}</div>
                        <div className="text-sm mt-0.5">{m.event}</div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 mt-5">
                  <div className="glass rounded-xl p-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Wins</div>
                    <ul className="text-xs space-y-1">
                      {(b.wins || []).map((w, i) => <li key={i}>· {w}</li>)}
                    </ul>
                  </div>
                  <div className="glass rounded-xl p-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-1">Risks</div>
                    <ul className="text-xs space-y-1">
                      {(b.risks || []).map((r, i) => <li key={i}>· {r}</li>)}
                    </ul>
                  </div>
                </div>
              </GlowCard>
            ))}
          </div>

          {result.recommended && (
            <GlowCard glow="purple" className="mt-6">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-full bg-aurora flex items-center justify-center shrink-0 animate-pulse-glow">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Aurora recommends</div>
                  <p className="font-display text-lg font-bold">{result.recommended}</p>
                  {result.rationale && <p className="text-sm text-muted-foreground mt-2">{result.rationale}</p>}
                </div>
              </div>
            </GlowCard>
          )}
        </>
      )}
    </Shell>
  );
}
