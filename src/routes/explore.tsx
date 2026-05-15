import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, NeonButton, StatChip } from "@/components/aurora/ui";
import {
  Compass, Loader2, Sparkles, Brain, Briefcase, Activity, Trash2,
  RefreshCcw, AlertTriangle, Clock, Flame, Monitor, Bell, BellOff,
  BarChart3, TrendingUp, Send, CheckCircle2, GraduationCap, Zap,
  Plus, X, Star, ExternalLink,
} from "lucide-react";
import { summarize, clearEvents, getLiveFocusMinutes } from "@/lib/activityTracker";
import { ApiError, getToken } from "@/lib/api";
import {
  isPushSupported,
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPush,
  type PushStatus,
} from "@/lib/pushNotifications";

export const Route = createFileRoute("/explore")({
  head: () => ({ meta: [{ title: "Explore — LifeOS" }] }),
  component: Explore,
});

// ── Types ─────────────────────────────────────────────────────────────────────

type BehaviorReport = {
  summary: string;
  engagementScore: number;
  hiddenSkills: { skill: string; evidence: string; confidence: number }[];
  interests: { label: string; why: string }[];
  behaviorPatterns: { pattern: string; implication: string }[];
  careerPaths: { title: string; fit: number; nextStep: string }[];
  recommendations: { title: string; action: string; impact: string }[];
  weeklyReport: { theme: string; wins: string[]; watchouts: string[] };
};

type SmartMatch = {
  summary: string;
  jobMatches: {
    title: string; platform: string; matchScore: number;
    whyMatch: string; applyUrl: string; salary: string;
  }[];
  courseRecs: {
    title: string; provider: string; url: string;
    level: string; duration: string; whyMatch: string;
  }[];
  careerPaths: { title: string; fit: number; roadmap: string; timeline: string }[];
  topSkillsToLearn: { skill: string; reason: string; resourceUrl: string }[];
  insights: string[];
};

type AiStatus = { ok: boolean; code?: string; message?: string; hint?: string };
type PermState = "unknown" | "granted" | "denied" | "unsupported";

// ── Interest presets ──────────────────────────────────────────────────────────
const INTEREST_PRESETS = [
  "Programming", "AI & Machine Learning", "Design", "Marketing", "Finance",
  "Writing & Content", "Video Editing", "Photography", "Music", "Gaming",
  "Health & Fitness", "Data Science", "Business", "Education", "Sales",
];
const SKILL_PRESETS = [
  "Python", "JavaScript", "React", "Excel", "Photoshop", "Video Editing",
  "SEO", "Copywriting", "SQL", "Public Speaking", "Leadership", "Communication",
];

// ── Helper sub-components ─────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="h-4 w-4 text-primary" />
      <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{title}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground py-2">{text}</p>;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

function Explore() {
  const [tab, setTab] = useState<"activity" | "smartmatch">("activity");

  // Activity tab state
  const [stats, setStats]           = useState(() => summarize());
  const [report, setReport]         = useState<BehaviorReport | null>(null);
  const [aiStatus, setAiStatus]     = useState<AiStatus | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError]     = useState<string | null>(null);
  const [focusMin, setFocusMin]     = useState(() => getLiveFocusMinutes());
  const [micPerm, setMicPerm]       = useState<PermState>("unknown");
  const [pushStatus, setPushStatus] = useState<PushStatus>("unsupported");
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError]   = useState<string | null>(null);
  const [testSent, setTestSent]     = useState(false);

  // Smart Match tab state
  const [interests, setInterests]   = useState<string[]>([]);
  const [skills, setSkills]         = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState("");
  const [customSkill, setCustomSkill]       = useState("");
  const [platforms, setPlatforms]   = useState("");
  const [goals, setGoals]           = useState("");
  const [matchResult, setMatchResult]       = useState<SmartMatch | null>(null);
  const [matchLoading, setMatchLoading]     = useState(false);
  const [matchError, setMatchError]         = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      setFocusMin(getLiveFocusMinutes());
      setStats(summarize());
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setStats(summarize());
    if (typeof window !== "undefined") setPushStatus(getPushStatus());
    if (typeof window !== "undefined" && "permissions" in navigator) {
      navigator.permissions.query({ name: "microphone" as PermissionName })
        .then((p) => setMicPerm(p.state === "granted" ? "granted" : p.state === "denied" ? "denied" : "unknown"))
        .catch(() => setMicPerm("unsupported"));
    }
  }, []);

  // ── Activity tab actions ────────────────────────────────────────────────────
  const generateReport = useCallback(async () => {
    setReportLoading(true); setReportError(null);
    try {
      const summary = summarize();
      setStats(summary);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const resp = await fetch("/api/explore/insights", {
        method: "POST", headers, credentials: "same-origin",
        body: JSON.stringify({ summary }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new ApiError(data?.error || "Could not generate insights", { status: resp.status, code: data?.code });
      setReport(data.report as BehaviorReport);
      setAiStatus(data.aiStatus as AiStatus);
    } catch (e) {
      setReportError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setReportLoading(false);
    }
  }, []);

  function resetActivity() {
    clearEvents(); setStats(summarize()); setFocusMin(0); setReport(null);
  }

  async function handleSubscribe() {
    setPushLoading(true); setPushError(null); setTestSent(false);
    try { await subscribeToPush(getToken()); setPushStatus(getPushStatus()); }
    catch (e) { setPushError(e instanceof Error ? e.message : "Failed."); }
    finally { setPushLoading(false); }
  }
  async function handleUnsubscribe() {
    setPushLoading(true); setPushError(null);
    try { await unsubscribeFromPush(getToken()); setPushStatus(getPushStatus()); }
    catch (e) { setPushError(e instanceof Error ? e.message : "Failed."); }
    finally { setPushLoading(false); }
  }
  async function handleTestPush() {
    setPushLoading(true); setPushError(null); setTestSent(false);
    try { await sendTestPush(getToken()); setTestSent(true); setTimeout(() => setTestSent(false), 4000); }
    catch (e) { setPushError(e instanceof Error ? e.message : "Test failed."); }
    finally { setPushLoading(false); }
  }
  async function requestMicPerm() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicPerm("granted");
    } catch { setMicPerm("denied"); }
  }

  // ── Smart Match actions ─────────────────────────────────────────────────────
  function toggleTag(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  }

  function addCustomInterest() {
    const v = customInterest.trim();
    if (v && !interests.includes(v)) setInterests([...interests, v]);
    setCustomInterest("");
  }
  function addCustomSkill() {
    const v = customSkill.trim();
    if (v && !skills.includes(v)) setSkills([...skills, v]);
    setCustomSkill("");
  }

  const runSmartMatch = useCallback(async () => {
    if (!interests.length && !skills.length && !goals.trim()) {
      setMatchError("Add at least one interest or skill to get personalized matches.");
      return;
    }
    setMatchLoading(true); setMatchError(null); setMatchResult(null);
    try {
      const actSummary = summarize();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      const resp = await fetch("/api/explore/smart-match", {
        method: "POST", headers, credentials: "same-origin",
        body: JSON.stringify({
          interests,
          skills,
          platforms: platforms.trim(),
          goals: goals.trim(),
          activitySummary: {
            topPages: actSummary.topPages,
            topActions: actSummary.topActions,
            streakDays: actSummary.streakDays,
            totalMinutes: actSummary.totalMinutes,
          },
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new ApiError(data?.error || "Smart match failed", { status: resp.status, code: data?.code });
      setMatchResult(data.match as SmartMatch);
    } catch (e) {
      setMatchError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setMatchLoading(false);
    }
  }, [interests, skills, platforms, goals]);

  return (
    <Shell>
      <PageHeader
        eyebrow="Module 10"
        icon={Compass}
        title="Explore"
        subtitle="Decode your behavior patterns, discover personalized jobs, courses, and career paths matched to your interests."
      />

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {([
          { id: "activity",   label: "Activity Dashboard" },
          { id: "smartmatch", label: "Smart Match" },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
              tab === t.id
                ? "bg-aurora text-primary-foreground border-transparent shadow-neon"
                : "glass text-muted-foreground border-white/10 hover:text-foreground"
            }`}
          >
            {t.id === "activity" ? <span className="flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> {t.label}</span>
              : <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> {t.label}</span>}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ACTIVITY TAB                                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === "activity" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <StatChip label="Sessions (7d)"    value={String(stats.viewsLast7d)} />
            <StatChip label="Actions (7d)"     value={String(stats.actionsLast7d)}  accent="purple" />
            <StatChip label="In-app min"       value={String(stats.totalMinutes)}   accent="pink" />
            <StatChip label="Focus min"        value={String(focusMin)}             accent="blue" />
            <StatChip label="Day streak"       value={`${stats.streakDays}🔥`} />
            <StatChip label="Total sessions"   value={String(stats.sessionCount || 1)} accent="purple" />
          </div>

          {/* Device analytics */}
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
              <div className="glass rounded-2xl p-4 flex items-start gap-3">
                <Clock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium">Active focus time</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Tracked automatically.</div>
                  <div className="mt-2 text-2xl font-bold font-display text-primary">
                    {focusMin}<span className="text-sm font-normal text-muted-foreground ml-1">min</span>
                  </div>
                </div>
              </div>

              <div className="glass rounded-2xl p-4 flex items-start gap-3">
                <Flame className="h-5 w-5 text-[oklch(0.7_0.22_50)] mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-medium">Usage streak</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Consecutive days on LifeOS.</div>
                  <div className="mt-2 text-2xl font-bold font-display text-[oklch(0.7_0.22_50)]">
                    {stats.streakDays}<span className="text-sm font-normal text-muted-foreground ml-1">days</span>
                  </div>
                </div>
              </div>

              {/* Push notifications */}
              <div className="glass rounded-2xl p-4 flex items-start gap-3">
                {pushStatus === "subscribed"
                  ? <Bell className="h-5 w-5 text-[oklch(0.65_0.18_150)] mt-0.5 flex-shrink-0" />
                  : <BellOff className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                }
                <div className="flex-1">
                  <div className="text-sm font-medium">Weekly push insights</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {pushStatus === "subscribed" ? "Active — weekly behavior report every Sunday."
                      : pushStatus === "denied" ? "Blocked in browser settings."
                      : pushStatus === "unsupported" ? "Not supported in this browser."
                      : "Get a weekly AI-generated insight report via push."}
                  </div>
                  {pushError && <div className="mt-2 text-[11px] text-[oklch(0.7_0.22_320)]"><AlertTriangle className="h-3 w-3 inline mr-1" />{pushError}</div>}
                  {testSent  && <div className="mt-2 text-[11px] text-[oklch(0.65_0.18_150)]"><CheckCircle2 className="h-3 w-3 inline mr-1" />Test sent.</div>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pushStatus === "subscribed" ? (
                      <>
                        <button onClick={handleTestPush} disabled={pushLoading} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl glass hover:bg-white/10 transition disabled:opacity-50">
                          {pushLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} Send test
                        </button>
                        <button onClick={handleUnsubscribe} disabled={pushLoading} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl glass hover:bg-white/10 text-muted-foreground transition disabled:opacity-50">Unsubscribe</button>
                      </>
                    ) : pushStatus !== "unsupported" && pushStatus !== "denied" ? (
                      <button onClick={handleSubscribe} disabled={pushLoading} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl glass hover:bg-white/10 transition disabled:opacity-50">
                        {pushLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />} Enable weekly push
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Microphone */}
              <div className="glass rounded-2xl p-4 flex items-start gap-3">
                <svg className={`h-5 w-5 mt-0.5 flex-shrink-0 ${micPerm === "granted" ? "text-[oklch(0.65_0.18_150)]" : "text-muted-foreground"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                </svg>
                <div className="flex-1">
                  <div className="text-sm font-medium">Microphone</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {micPerm === "granted" ? "Enabled — voice login and AI voice active."
                      : micPerm === "denied" ? "Blocked — allow mic in browser settings."
                      : "Powers voice login and the AI voice companion."}
                  </div>
                  {micPerm !== "granted" && micPerm !== "unsupported" && micPerm !== "denied" && (
                    <button onClick={requestMicPerm} className="mt-2 text-xs px-3 py-1.5 rounded-xl glass hover:bg-white/10 transition">Enable microphone</button>
                  )}
                  {micPerm === "granted" && <span className="mt-2 inline-block text-xs text-[oklch(0.65_0.18_150)]">✓ Active</span>}
                </div>
              </div>
            </div>

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
                      <div key={date} className="flex-1 rounded-sm transition-all"
                        style={{ height: `${Math.max(8, pct)}%`, background: date === today ? "var(--gradient-aurora)" : "oklch(0.78 0.18 230 / 0.35)" }}
                        title={`${date}: ${count} events`}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </GlowCard>

          {/* Behavior insights generator */}
          <GlowCard glow="blue" className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Activity intelligence</div>
                <h3 className="text-lg font-display font-semibold mt-1">Generate your behavior report</h3>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={resetActivity} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground glass rounded-xl px-3 py-2">
                  <Trash2 className="h-3.5 w-3.5" /> Clear data
                </button>
                <NeonButton onClick={generateReport} disabled={reportLoading}>
                  {reportLoading ? <Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> : <RefreshCcw className="inline h-4 w-4 mr-2" />}
                  {report ? "Regenerate" : "Generate insights"}
                </NeonButton>
              </div>
            </div>

            {reportError && (
              <div className="flex items-start gap-2 glass rounded-2xl p-3 text-xs text-[oklch(0.7_0.22_320)] mb-4">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /><div>{reportError}</div>
              </div>
            )}
            {aiStatus && !aiStatus.ok && (
              <div className="flex items-start gap-2 glass rounded-2xl p-3 text-xs text-[oklch(0.78_0.16_65)] mb-4">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium">AI provider unavailable — showing baseline report.</div>
                  {aiStatus.message && <div className="opacity-80 mt-0.5">{aiStatus.message}</div>}
                </div>
              </div>
            )}
            {!report && !reportLoading && (
              <div className="text-sm text-muted-foreground">
                {stats.totalEvents === 0
                  ? "Use a few modules first — every page visit and action feeds the analysis."
                  : `${stats.totalEvents} events captured. Click "Generate insights" to analyze them.`}
              </div>
            )}
            {report && (
              <div>
                <p className="text-sm">{report.summary}</p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full bg-aurora transition-all duration-700" style={{ width: `${Math.max(2, Math.min(100, report.engagementScore))}%` }} />
                  </div>
                  <div className="text-sm font-display font-bold flex-shrink-0">{report.engagementScore}/100</div>
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
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SMART MATCH TAB                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === "smartmatch" && (
        <>
          <GlowCard glow="blue" className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-9 w-9 rounded-2xl bg-aurora/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-sm">Smart Match</h3>
                <p className="text-[11px] text-muted-foreground">Tell LifeOS what you're into — it'll surface the best-fit jobs, courses, and career paths for you.</p>
              </div>
            </div>

            {/* Interests */}
            <div className="mb-5">
              <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 block">Your interests / topics</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {INTEREST_PRESETS.map((v) => (
                  <button key={v} onClick={() => toggleTag(interests, setInterests, v)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${interests.includes(v) ? "bg-aurora text-primary-foreground border-transparent shadow-neon" : "glass text-muted-foreground border-white/10 hover:text-foreground"}`}
                  >{v}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={customInterest}
                  onChange={(e) => setCustomInterest(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addCustomInterest(); }}
                  placeholder="Add custom interest (e.g. Blockchain, Photography)…"
                  className="flex-1 glass rounded-xl px-3 py-2 text-sm bg-transparent outline-none border border-white/10 focus:border-primary/50"
                />
                <button onClick={addCustomInterest} className="glass rounded-xl px-3 py-2 text-sm hover:bg-white/10 transition border border-white/10">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {interests.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {interests.filter((v) => !INTEREST_PRESETS.includes(v)).map((v) => (
                    <span key={v} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary">
                      {v}
                      <button onClick={() => toggleTag(interests, setInterests, v)} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Skills */}
            <div className="mb-5">
              <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 block">Your current skills</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {SKILL_PRESETS.map((v) => (
                  <button key={v} onClick={() => toggleTag(skills, setSkills, v)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${skills.includes(v) ? "bg-aurora text-primary-foreground border-transparent shadow-neon" : "glass text-muted-foreground border-white/10 hover:text-foreground"}`}
                  >{v}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={customSkill}
                  onChange={(e) => setCustomSkill(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addCustomSkill(); }}
                  placeholder="Add custom skill (e.g. AutoCAD, Spanish)…"
                  className="flex-1 glass rounded-xl px-3 py-2 text-sm bg-transparent outline-none border border-white/10 focus:border-primary/50"
                />
                <button onClick={addCustomSkill} className="glass rounded-xl px-3 py-2 text-sm hover:bg-white/10 transition border border-white/10">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {skills.filter((v) => !SKILL_PRESETS.includes(v)).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {skills.filter((v) => !SKILL_PRESETS.includes(v)).map((v) => (
                    <span key={v} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary">
                      {v}
                      <button onClick={() => toggleTag(skills, setSkills, v)} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Content platforms (optional) */}
            <div className="mb-5">
              <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 block">Content you consume (optional)</label>
              <input
                value={platforms}
                onChange={(e) => setPlatforms(e.target.value)}
                placeholder="e.g. YouTube tech videos, Reddit programming, Instagram fitness reels…"
                className="w-full glass rounded-xl px-3 py-2 text-sm bg-transparent outline-none border border-white/10 focus:border-primary/50"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Helps LifeOS understand your digital habits for better matching.</p>
            </div>

            {/* Goals */}
            <div className="mb-5">
              <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 block">Goals / aspirations (optional)</label>
              <input
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                placeholder="e.g. earn $2k/mo freelancing, land a job at a startup, learn data science…"
                className="w-full glass rounded-xl px-3 py-2 text-sm bg-transparent outline-none border border-white/10 focus:border-primary/50"
              />
            </div>

            {matchError && (
              <div className="flex items-start gap-2 glass rounded-2xl p-3 text-xs text-[oklch(0.7_0.22_320)] mb-4">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /><div>{matchError}</div>
              </div>
            )}

            <NeonButton onClick={runSmartMatch} disabled={matchLoading}>
              {matchLoading
                ? <><Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> Analyzing…</>
                : <><Sparkles className="inline h-4 w-4 mr-2" /> Generate my smart match</>}
            </NeonButton>
          </GlowCard>

          {matchLoading && !matchResult && (
            <GlowCard glow="blue" className="mb-6">
              <div className="flex flex-col items-center py-10 gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">LifeOS is scanning opportunities matched to your profile…</p>
                <p className="text-xs opacity-60">This takes 10–20 seconds for live data.</p>
              </div>
            </GlowCard>
          )}

          {matchResult && (
            <div className="space-y-4 animate-rise">
              {/* Summary */}
              <GlowCard glow="purple">
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Your match summary</div>
                <p className="text-sm leading-relaxed">{matchResult.summary}</p>
                {matchResult.insights?.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {matchResult.insights.map((ins, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Zap className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />{ins}
                      </li>
                    ))}
                  </ul>
                )}
              </GlowCard>

              {/* Job matches */}
              {matchResult.jobMatches?.length > 0 && (
                <GlowCard glow="blue">
                  <SectionHeader icon={Briefcase} title="Best-fit job matches" />
                  <div className="space-y-3">
                    {matchResult.jobMatches.map((j, i) => (
                      <div key={i} className="glass rounded-xl p-3">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <div className="text-sm font-semibold">{j.title}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{j.platform} · {j.salary}</div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] font-bold text-primary">{j.matchScore}% match</span>
                            {j.applyUrl && (
                              <a href={j.applyUrl} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] px-2.5 py-1 rounded-lg bg-aurora/20 border border-primary/30 text-primary hover:bg-aurora/30 transition flex items-center gap-1">
                                Apply <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">{j.whyMatch}</p>
                      </div>
                    ))}
                  </div>
                </GlowCard>
              )}

              {/* Course recommendations */}
              {matchResult.courseRecs?.length > 0 && (
                <GlowCard glow="pink">
                  <SectionHeader icon={GraduationCap} title="Recommended courses" />
                  <div className="space-y-3">
                    {matchResult.courseRecs.map((c, i) => (
                      <div key={i} className="glass rounded-xl p-3">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <div className="text-sm font-semibold">{c.title}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{c.provider} · {c.level} · {c.duration}</div>
                          </div>
                          {c.url && (
                            <a href={c.url} target="_blank" rel="noopener noreferrer"
                              className="text-[10px] px-2.5 py-1 rounded-lg bg-aurora/20 border border-primary/30 text-primary hover:bg-aurora/30 transition flex items-center gap-1 flex-shrink-0">
                              View <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">{c.whyMatch}</p>
                      </div>
                    ))}
                  </div>
                </GlowCard>
              )}

              {/* Career paths */}
              {matchResult.careerPaths?.length > 0 && (
                <GlowCard glow="purple">
                  <SectionHeader icon={TrendingUp} title="Career paths for you" />
                  <div className="space-y-3">
                    {matchResult.careerPaths.map((cp, i) => (
                      <div key={i} className="glass rounded-xl p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-sm font-semibold">{cp.title}</div>
                          <span className="text-[10px] font-bold text-primary flex-shrink-0">{cp.fit}% fit</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{cp.roadmap}</p>
                        <div className="text-[10px] text-primary/70 mt-1">Timeline: {cp.timeline}</div>
                      </div>
                    ))}
                  </div>
                </GlowCard>
              )}

              {/* Top skills to learn */}
              {matchResult.topSkillsToLearn?.length > 0 && (
                <GlowCard glow="blue">
                  <SectionHeader icon={Star} title="Top skills to learn next" />
                  <div className="grid sm:grid-cols-2 gap-3">
                    {matchResult.topSkillsToLearn.map((sk, i) => (
                      <div key={i} className="glass rounded-xl p-3">
                        <div className="text-sm font-semibold">{sk.skill}</div>
                        <p className="text-xs text-muted-foreground mt-1">{sk.reason}</p>
                        {sk.resourceUrl && (
                          <a href={sk.resourceUrl} target="_blank" rel="noopener noreferrer"
                            className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                            Learn it <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </GlowCard>
              )}
            </div>
          )}
        </>
      )}
    </Shell>
  );
}
