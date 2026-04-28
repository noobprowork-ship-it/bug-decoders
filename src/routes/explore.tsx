import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, NeonButton, StatChip } from "@/components/aurora/ui";
import { Compass, Loader2, Sparkles, Brain, Briefcase, Activity, Trash2, RefreshCcw, AlertTriangle } from "lucide-react";
import { summarize, clearEvents } from "@/lib/activityTracker";
import { ApiError, getToken } from "@/lib/api";

export const Route = createFileRoute("/explore")({
  head: () => ({ meta: [{ title: "Explore — LifeOS" }] }),
  component: Explore,
});

type Report = {
  summary: string;
  engagementScore: number;
  hiddenSkills: { skill: string; evidence: string; confidence: number }[];
  interests: { label: string; why: string }[];
  behaviorPatterns: { pattern: string; implication: string }[];
  careerPaths: { title: string; fit: number; nextStep: string }[];
  recommendations: { title: string; action: string; impact: string }[];
  weeklyReport: { theme: string; wins: string[]; watchouts: string[] };
};

type AiStatus = { ok: boolean; code?: string; message?: string; hint?: string };

function Explore() {
  const [stats, setStats] = useState(() => summarize());
  const [report, setReport] = useState<Report | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStats(summarize());
  }, []);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const summary = summarize();
      setStats(summary);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const resp = await fetch("/api/explore/insights", {
        method: "POST",
        headers,
        body: JSON.stringify({ summary }),
        credentials: "same-origin",
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new ApiError(data?.error || "Could not generate insights", { status: resp.status, code: data?.code });
      }
      setReport(data.report as Report);
      setAiStatus(data.aiStatus as AiStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    clearEvents();
    setStats(summarize());
    setReport(null);
  }

  return (
    <Shell>
      <PageHeader
        eyebrow="Module 10"
        icon={Compass}
        title="Explore"
        subtitle="Your in-app behavior, decoded. Hidden skills, interests, behavioral patterns and career paths — all surfaced from how you actually use LifeOS."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatChip label="Sessions (7d)" value={String(stats.viewsLast7d)} />
        <StatChip label="Actions (7d)" value={String(stats.actionsLast7d)} accent="purple" />
        <StatChip label="In-app minutes" value={String(stats.totalMinutes)} accent="pink" />
        <StatChip label="Total events" value={String(stats.totalEvents)} />
      </div>

      <GlowCard glow="blue" className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Activity intelligence</div>
            <h3 className="text-lg font-display font-semibold mt-1">Generate your behavior report</h3>
          </div>
          <div className="flex gap-2">
            <button onClick={reset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground glass rounded-xl px-3 py-2">
              <Trash2 className="h-3.5 w-3.5" /> Clear data
            </button>
            <NeonButton onClick={generate} disabled={loading}>
              {loading ? <Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> : <RefreshCcw className="inline h-4 w-4 mr-2" />}
              {report ? "Regenerate" : "Generate insights"}
            </NeonButton>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 glass rounded-2xl p-3 text-xs text-[oklch(0.7_0.22_320)] mb-4">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {aiStatus && !aiStatus.ok && (
          <div className="flex items-start gap-2 glass rounded-2xl p-3 text-xs text-[oklch(0.78_0.16_65)] mb-4">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">AI provider unavailable — showing baseline report.</div>
              {aiStatus.message && <div className="opacity-80 mt-0.5">{aiStatus.message}</div>}
              {aiStatus.hint && <div className="opacity-60 mt-0.5">{aiStatus.hint}</div>}
            </div>
          </div>
        )}

        {!report && !loading && (
          <div className="text-sm text-muted-foreground">
            {stats.totalEvents === 0
              ? "Use a few modules first — every page visit and action gets tracked locally and feeds the analysis."
              : `${stats.totalEvents} events captured. Tap “Generate insights” to synthesize them.`}
          </div>
        )}

        {report && (
          <div>
            <p className="text-sm">{report.summary}</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-aurora"
                  style={{ width: `${Math.max(2, Math.min(100, report.engagementScore))}%` }}
                />
              </div>
              <div className="text-sm font-display font-bold">{report.engagementScore}/100</div>
            </div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-1">Engagement score</div>
          </div>
        )}
      </GlowCard>

      {report && (
        <div className="grid lg:grid-cols-2 gap-4">
          <GlowCard glow="purple">
            <SectionHeader icon={Brain} title="Hidden skills" />
            {report.hiddenSkills.length === 0 && <Empty text="Use more modules to surface skills." />}
            <ul className="space-y-3">
              {report.hiddenSkills.map((s, i) => (
                <li key={i} className="glass rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{s.skill}</span>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-primary">{Math.round((s.confidence || 0) * 100)}%</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{s.evidence}</div>
                </li>
              ))}
            </ul>
          </GlowCard>

          <GlowCard glow="pink">
            <SectionHeader icon={Sparkles} title="Interests" />
            {report.interests.length === 0 && <Empty text="No interest signals yet." />}
            <ul className="space-y-3">
              {report.interests.map((s, i) => (
                <li key={i} className="glass rounded-xl p-3">
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.why}</div>
                </li>
              ))}
            </ul>
          </GlowCard>

          <GlowCard glow="blue">
            <SectionHeader icon={Activity} title="Behavior patterns" />
            {report.behaviorPatterns.length === 0 && <Empty text="No patterns detected yet." />}
            <ul className="space-y-3">
              {report.behaviorPatterns.map((s, i) => (
                <li key={i} className="glass rounded-xl p-3">
                  <div className="text-sm font-medium">{s.pattern}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.implication}</div>
                </li>
              ))}
            </ul>
          </GlowCard>

          <GlowCard glow="purple">
            <SectionHeader icon={Briefcase} title="Career paths" />
            {report.careerPaths.length === 0 && <Empty text="Build more signal to unlock career paths." />}
            <ul className="space-y-3">
              {report.careerPaths.map((s, i) => (
                <li key={i} className="glass rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{s.title}</span>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-primary">{s.fit}% fit</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Next: {s.nextStep}</div>
                </li>
              ))}
            </ul>
          </GlowCard>

          <GlowCard glow="pink" className="lg:col-span-2">
            <SectionHeader icon={Sparkles} title="Recommendations" />
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {report.recommendations.map((r, i) => (
                <li key={i} className="glass rounded-xl p-3">
                  <div className="text-sm font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground mt-1">{r.action}</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-primary mt-2">Impact: {r.impact}</div>
                </li>
              ))}
            </ul>
          </GlowCard>

          <GlowCard glow="blue" className="lg:col-span-2">
            <SectionHeader icon={Activity} title={`Weekly report — ${report.weeklyReport.theme}`} />
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Wins</div>
                <ul className="space-y-1.5 text-sm">
                  {report.weeklyReport.wins.length === 0 && <li className="text-muted-foreground">—</li>}
                  {report.weeklyReport.wins.map((w, i) => <li key={i}>· {w}</li>)}
                </ul>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Watch-outs</div>
                <ul className="space-y-1.5 text-sm">
                  {report.weeklyReport.watchouts.length === 0 && <li className="text-muted-foreground">—</li>}
                  {report.weeklyReport.watchouts.map((w, i) => <li key={i}>· {w}</li>)}
                </ul>
              </div>
            </div>
          </GlowCard>
        </div>
      )}

      {!report && stats.topPages.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <GlowCard glow="blue">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Top pages</div>
            <ul className="space-y-2 text-sm">
              {stats.topPages.map((p, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">{p.target}</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground shrink-0">{p.count}× · {p.minutes}m</span>
                </li>
              ))}
            </ul>
          </GlowCard>
          <GlowCard glow="purple">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Top actions</div>
            <ul className="space-y-2 text-sm">
              {stats.topActions.length === 0 && <li className="text-muted-foreground">No action data yet.</li>}
              {stats.topActions.map((a, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">{a.name}</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground shrink-0">{a.count}×</span>
                </li>
              ))}
            </ul>
          </GlowCard>
        </div>
      )}
    </Shell>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="h-9 w-9 rounded-2xl bg-aurora/20 border border-primary/30 flex items-center justify-center">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <h3 className="font-display font-semibold">{title}</h3>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-xs text-muted-foreground glass rounded-xl p-3">{text}</div>;
}
