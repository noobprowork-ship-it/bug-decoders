import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, NeonButton, StatChip } from "@/components/aurora/ui";
import {
  Compass, Loader2, Sparkles, Brain, Briefcase, Activity, Trash2,
  RefreshCcw, AlertTriangle, Clock, Flame, Monitor, Bell, BellOff,
  BarChart3, TrendingUp,
} from "lucide-react";
import { summarize, clearEvents, getLiveFocusMinutes } from "@/lib/activityTracker";
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

type PermState = "unknown" | "granted" | "denied" | "unsupported";

function Explore() {
  const [stats, setStats]         = useState(() => summarize());
  const [report, setReport]       = useState<Report | null>(null);
  const [aiStatus, setAiStatus]   = useState<AiStatus | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [focusMin, setFocusMin]   = useState(() => getLiveFocusMinutes());

  // Permission states
  const [notifPerm, setNotifPerm]   = useState<PermState>("unknown");
  const [micPerm, setMicPerm]       = useState<PermState>("unknown");

  // Refresh live focus counter every 30s
  useEffect(() => {
    const id = setInterval(() => {
      setFocusMin(getLiveFocusMinutes());
      setStats(summarize());
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setStats(summarize());

    // Check existing permissions without prompting
    if (typeof window !== "undefined" && "permissions" in navigator) {
      navigator.permissions.query({ name: "notifications" as PermissionName })
        .then((p) => setNotifPerm(p.state === "granted" ? "granted" : p.state === "denied" ? "denied" : "unknown"))
        .catch(() => setNotifPerm("unsupported"));
      navigator.permissions.query({ name: "microphone" as PermissionName })
        .then((p) => setMicPerm(p.state === "granted" ? "granted" : p.state === "denied" ? "denied" : "unknown"))
        .catch(() => setMicPerm("unsupported"));
    }
  }, []);

  const generate = useCallback(async () => {
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
      if (!resp.ok) throw new ApiError(data?.error || "Could not generate insights", { status: resp.status, code: data?.code });
      setReport(data.report as Report);
      setAiStatus(data.aiStatus as AiStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  function reset() {
    clearEvents();
    setStats(summarize());
    setFocusMin(0);
    setReport(null);
  }

  async function requestNotifPerm() {
    if (!("Notification" in window)) { setNotifPerm("unsupported"); return; }
    const result = await Notification.requestPermission();
    setNotifPerm(result === "granted" ? "granted" : "denied");
  }

  async function requestMicPerm() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicPerm("granted");
    } catch {
      setMicPerm("denied");
    }
  }

  const permBtnClass = (state: PermState) =>
    state === "granted"
      ? "bg-[oklch(0.65_0.18_150)/0.2] border border-[oklch(0.65_0.18_150)/0.5] text-[oklch(0.65_0.18_150)]"
      : state === "denied"
      ? "glass text-muted-foreground opacity-60 cursor-not-allowed"
      : "glass hover:bg-white/10 text-foreground";

  return (
    <Shell>
      <PageHeader
        eyebrow="Module 10"
        icon={Compass}
        title="Explore"
        subtitle="Your behavior decoded — hidden skills, patterns, and career paths surfaced from how you use LifeOS."
      />

      {/* ── Stat chips ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatChip label="Sessions (7d)"    value={String(stats.viewsLast7d)} />
        <StatChip label="Actions (7d)"     value={String(stats.actionsLast7d)}  accent="purple" />
        <StatChip label="In-app min"       value={String(stats.totalMinutes)}   accent="pink" />
        <StatChip label="Focus min"        value={String(focusMin)}             accent="blue" />
        <StatChip label="Day streak"       value={`${stats.streakDays}🔥`} />
        <StatChip label="Total sessions"  value={String(stats.sessionCount || 1)} accent="purple" />
      </div>

      {/* ── Device Analytics & Permissions ────────────────────────────────── */}
      <GlowCard glow="purple" className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-2xl bg-aurora/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
            <Monitor className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-sm">Device analytics</h3>
            <p className="text-[11px] text-muted-foreground">Enable permissions for richer signal capture.</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {/* Active focus time */}
          <div className="glass rounded-2xl p-4 flex items-start gap-3">
            <Clock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium">Active focus time</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Tracked automatically — no permission needed.
              </div>
              <div className="mt-2 text-2xl font-bold font-display text-primary">
                {focusMin}<span className="text-sm font-normal text-muted-foreground ml-1">min</span>
              </div>
            </div>
          </div>

          {/* Streak */}
          <div className="glass rounded-2xl p-4 flex items-start gap-3">
            <Flame className="h-5 w-5 text-[oklch(0.7_0.22_50)] mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-sm font-medium">Usage streak</div>
              <div className="text-xs text-muted-foreground mt-0.5">Consecutive days you've opened LifeOS.</div>
              <div className="mt-2 text-2xl font-bold font-display text-[oklch(0.7_0.22_50)]">
                {stats.streakDays}<span className="text-sm font-normal text-muted-foreground ml-1">days</span>
              </div>
            </div>
          </div>

          {/* Notification permission */}
          <div className="glass rounded-2xl p-4 flex items-start gap-3">
            {notifPerm === "granted" ? (
              <Bell className="h-5 w-5 text-[oklch(0.65_0.18_150)] mt-0.5 flex-shrink-0" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Notifications</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {notifPerm === "granted"
                  ? "Enabled — LifeOS can send you nudges."
                  : notifPerm === "denied"
                  ? "Blocked in browser settings."
                  : notifPerm === "unsupported"
                  ? "Not supported in this browser."
                  : "Allows weekly insight reminders."}
              </div>
              {notifPerm !== "granted" && notifPerm !== "unsupported" && notifPerm !== "denied" && (
                <button
                  onClick={requestNotifPerm}
                  className={`mt-2 text-xs px-3 py-1.5 rounded-xl transition ${permBtnClass(notifPerm)}`}
                >
                  Enable notifications
                </button>
              )}
              {notifPerm === "granted" && (
                <span className="mt-2 inline-block text-xs text-[oklch(0.65_0.18_150)]">✓ Active</span>
              )}
            </div>
          </div>

          {/* Microphone permission */}
          <div className="glass rounded-2xl p-4 flex items-start gap-3">
            <svg className={`h-5 w-5 mt-0.5 flex-shrink-0 ${micPerm === "granted" ? "text-[oklch(0.65_0.18_150)]" : "text-muted-foreground"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">Microphone</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {micPerm === "granted"
                  ? "Enabled — voice login and AI voice active."
                  : micPerm === "denied"
                  ? "Blocked — allow mic in browser settings."
                  : "Powers voice login and the AI voice companion."}
              </div>
              {micPerm !== "granted" && micPerm !== "unsupported" && micPerm !== "denied" && (
                <button
                  onClick={requestMicPerm}
                  className={`mt-2 text-xs px-3 py-1.5 rounded-xl transition ${permBtnClass(micPerm)}`}
                >
                  Enable microphone
                </button>
              )}
              {micPerm === "granted" && (
                <span className="mt-2 inline-block text-xs text-[oklch(0.65_0.18_150)]">✓ Active</span>
              )}
            </div>
          </div>
        </div>

        {/* Mini daily activity bar chart */}
        {stats.dailyActivity.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Daily activity (last 14 days)</span>
            </div>
            <div className="flex items-end gap-1 h-10">
              {stats.dailyActivity.map(([date, count]) => {
                const max = Math.max(...stats.dailyActivity.map(([, c]) => c));
                const pct = max ? Math.round((count / max) * 100) : 0;
                const today = new Date().toISOString().slice(0, 10);
                return (
                  <div
                    key={date}
                    className="flex-1 rounded-sm transition-all"
                    style={{
                      height: `${Math.max(8, pct)}%`,
                      background: date === today
                        ? "var(--gradient-aurora)"
                        : "oklch(0.78 0.18 230 / 0.35)",
                    }}
                    title={`${date}: ${count} events`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </GlowCard>

      {/* ── Insights generator ────────────────────────────────────────────── */}
      <GlowCard glow="blue" className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Activity intelligence</div>
            <h3 className="text-lg font-display font-semibold mt-1">Generate your behavior report</h3>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground glass rounded-xl px-3 py-2"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear data
            </button>
            <NeonButton onClick={generate} disabled={loading}>
              {loading
                ? <Loader2 className="inline h-4 w-4 mr-2 animate-spin" />
                : <RefreshCcw className="inline h-4 w-4 mr-2" />}
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
              {aiStatus.hint    && <div className="opacity-60 mt-0.5">{aiStatus.hint}</div>}
            </div>
          </div>
        )}

        {!report && !loading && (
          <div className="text-sm text-muted-foreground">
            {stats.totalEvents === 0
              ? "Use a few modules first — every page visit and action gets tracked locally and feeds the analysis."
              : `${stats.totalEvents} events captured. Tap "Generate insights" to synthesize them.`}
          </div>
        )}

        {report && (
          <div>
            <p className="text-sm">{report.summary}</p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-aurora transition-all duration-700"
                  style={{ width: `${Math.max(2, Math.min(100, report.engagementScore))}%` }}
                />
              </div>
              <div className="text-sm font-display font-bold flex-shrink-0">
                {report.engagementScore}/100
              </div>
            </div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-1">Engagement score</div>
          </div>
        )}
      </GlowCard>

      {/* ── Report sections ───────────────────────────────────────────────── */}
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
                    <span className="text-[10px] uppercase tracking-[0.2em] text-primary flex-shrink-0">
                      {Math.round((s.confidence || 0) * 100)}%
                    </span>
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
                    <span className="text-[10px] uppercase tracking-[0.2em] text-primary flex-shrink-0">
                      {s.fit}% fit
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Next: {s.nextStep}</div>
                </li>
              ))}
            </ul>
          </GlowCard>

          <GlowCard glow="pink" className="lg:col-span-2">
            <SectionHeader icon={TrendingUp} title="Recommendations" />
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

      {/* ── Raw activity preview (before first report) ────────────────────── */}
      {!report && stats.topPages.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4 mt-6">
          <GlowCard glow="blue">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Top pages</div>
            <ul className="space-y-2 text-sm">
              {stats.topPages.map((p, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">{p.target}</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground shrink-0">
                    {p.count}× · {p.minutes}m
                  </span>
                </li>
              ))}
            </ul>
          </GlowCard>
          <GlowCard glow="purple">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-3">Top actions</div>
            <ul className="space-y-2 text-sm">
              {stats.topActions.length === 0 && (
                <li className="text-muted-foreground">No action data yet.</li>
              )}
              {stats.topActions.map((a, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">{a.name}</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground shrink-0">
                    {a.count}×
                  </span>
                </li>
              ))}
            </ul>
          </GlowCard>
        </div>
      )}
    </Shell>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="h-9 w-9 rounded-2xl bg-aurora/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <h3 className="font-display font-semibold">{title}</h3>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="text-xs text-muted-foreground glass rounded-xl p-3 mb-3">{text}</div>;
}
