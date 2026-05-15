import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback, memo } from "react";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, NeonButton } from "@/components/aurora/ui";
import {
  ScanSearch, Loader2, AlertTriangle, Shield, ShieldCheck, ShieldAlert,
  Zap, MapPin, Clock, TrendingUp, ExternalLink, ChevronDown, ChevronUp,
  Wifi, WifiOff, BadgeCheck, Star, Briefcase, Bookmark, BookmarkCheck,
  Trash2, CheckCircle2, XCircle, MessageSquare, ChevronRight,
  DollarSign, GraduationCap, Link,
} from "lucide-react";
import { rjss, type RjssJob, type RjssScanResult, type RjssProfile } from "@/lib/api";
import { trackAction } from "@/lib/activityTracker";

export const Route = createFileRoute("/rjss")({
  component: RjssPage,
});

// ── Saved-jobs types & localStorage helpers ──────────────────────────────────

export type JobStatus = "interested" | "applied" | "interview" | "offer" | "rejected";

export interface SavedJobEntry {
  id: string;
  job: RjssJob;
  status: JobStatus;
  notes: string;
  savedAt: string;
  updatedAt: string;
}

const LS_KEY = "lifeos.rjss.saved";

function loadSaved(): SavedJobEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}

function persistSaved(entries: SavedJobEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(entries));
}

function useSavedJobs() {
  const [saved, setSaved] = useState<SavedJobEntry[]>([]);

  useEffect(() => { setSaved(loadSaved()); }, []);

  const save = useCallback((job: RjssJob) => {
    const existing = loadSaved();
    if (existing.some((e) => e.job.title === job.title && e.job.platform === job.platform)) return;
    const entry: SavedJobEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      job,
      status: "interested",
      notes: "",
      savedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = [entry, ...existing];
    persistSaved(next);
    setSaved(next);
    trackAction("rjss_save");
    // also try backend (fire-and-forget)
    rjss.save({ id: entry.id, job, status: "interested" }).catch(() => {});
  }, []);

  const updateStatus = useCallback((id: string, status: JobStatus, notes?: string) => {
    setSaved((prev) => {
      const next = prev.map((e) =>
        e.id === id
          ? { ...e, status, notes: notes ?? e.notes, updatedAt: new Date().toISOString() }
          : e
      );
      persistSaved(next);
      rjss.updateStatus(id, status, notes).catch(() => {});
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setSaved((prev) => {
      const next = prev.filter((e) => e.id !== id);
      persistSaved(next);
      rjss.remove(id).catch(() => {});
      return next;
    });
    trackAction("rjss_unsave");
  }, []);

  const isSaved = useCallback((job: RjssJob) =>
    saved.some((e) => e.job.title === job.title && e.job.platform === job.platform),
  [saved]);

  return { saved, save, updateStatus, remove, isSaved };
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SKILL_PRESETS = [
  "Writing", "Design", "Video Editing", "Data Entry", "Coding",
  "Teaching", "Photography", "Social Media", "Research", "Translation",
  "Customer Support", "Excel / Sheets", "Voice Over", "Marketing", "AI Prompting",
];

const INTEREST_PRESETS = [
  "Technology", "Business", "Education", "Arts", "Health",
  "Finance", "Gaming", "Music", "Sports", "Travel",
];

export const STATUS_META: Record<JobStatus, { label: string; color: string; dot: string }> = {
  interested: { label: "Interested",  color: "text-sky-400",     dot: "bg-sky-400" },
  applied:    { label: "Applied",     color: "text-violet-400",  dot: "bg-violet-400" },
  interview:  { label: "Interview",   color: "text-amber-400",   dot: "bg-amber-400" },
  offer:      { label: "Offer!",      color: "text-emerald-400", dot: "bg-emerald-400" },
  rejected:   { label: "Rejected",    color: "text-rose-400",    dot: "bg-rose-400" },
};

const STATUS_ORDER: JobStatus[] = ["interested", "applied", "interview", "offer", "rejected"];

// ── Utility badge helpers ─────────────────────────────────────────────────────

function difficultyColor(d: string) {
  if (d === "beginner")     return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
  if (d === "intermediate") return "text-amber-400 bg-amber-500/10 border-amber-500/30";
  return "text-rose-400 bg-rose-500/10 border-rose-500/30";
}

function scamBadge(score: number) {
  if (score >= 80) return { icon: ShieldCheck, label: `${score}% safe`,      cls: "text-emerald-400" };
  if (score >= 60) return { icon: Shield,      label: `${score}% safe`,      cls: "text-amber-400" };
  return             { icon: ShieldAlert,     label: `${score}% — caution`, cls: "text-rose-400" };
}

function legalityBadge(check: string) {
  if (check === "verified")              return { label: "Verified legal",        cls: "text-emerald-400" };
  if (check === "regional-restrictions") return { label: "Regional restrictions", cls: "text-amber-400" };
  return                                        { label: "Verify locally",         cls: "text-sky-400" };
}

// ── JobCard ───────────────────────────────────────────────────────────────────

const JobCard = memo(function JobCard({
  job, index, onSave, saved,
}: {
  job: RjssJob;
  index: number;
  onSave: (job: RjssJob) => void;
  saved: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const scam     = scamBadge(job.scamSafeScore);
  const ScamIcon = scam.icon;
  const legality = legalityBadge(job.legalityCheck);

  const applyUrl = (job.officialLink && job.officialLink !== "" && !job.officialLink.startsWith("https://direct"))
    ? job.officialLink
    : (job.sourceUrl && job.sourceUrl !== "https://example.com" ? job.sourceUrl : null);

  return (
    <GlowCard glow={index === 0 ? "blue" : index === 1 ? "purple" : "pink"} className="mb-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-2xl bg-aurora/20 border border-primary/30 flex items-center justify-center flex-shrink-0 text-sm font-bold text-primary">
          #{index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-semibold text-base">{job.title}</h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{job.platform}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${difficultyColor(job.difficulty)}`}>
                  {job.difficulty}
                </span>
                <span className={`text-[10px] flex items-center gap-0.5 ${scam.cls}`}>
                  <ScamIcon className="h-3 w-3" /> {scam.label}
                </span>
              </div>

              {/* Location + salary + experience row */}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {job.location && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {job.location}
                  </span>
                )}
                {job.salaryRange && job.salaryRange !== "varies" && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                    <DollarSign className="h-3 w-3" /> {job.salaryRange}
                  </span>
                )}
                {job.experienceRequired && (
                  <span className="flex items-center gap-1 text-[10px] text-sky-400">
                    <GraduationCap className="h-3 w-3" /> {job.experienceRequired}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="text-right">
                <div className="text-sm font-bold text-primary">{job.estimatedEarnings.daily}</div>
                <div className="text-[10px] text-muted-foreground">per day</div>
              </div>
              <button
                onClick={() => onSave(job)}
                title={saved ? "Saved" : "Save job"}
                className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all border ${
                  saved
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "glass border-white/10 text-muted-foreground hover:text-primary hover:border-primary/40"
                }`}
              >
                {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{job.whyItMatches}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
            {[
              { label: "Hourly",  val: job.estimatedEarnings.hourly },
              { label: "Daily",   val: job.estimatedEarnings.daily },
              { label: "Weekly",  val: job.estimatedEarnings.weekly },
              { label: "Monthly", val: job.estimatedEarnings.monthly },
            ].map((e) => (
              <div key={e.label} className="glass rounded-xl p-2 text-center">
                <div className="text-primary font-bold text-sm">{e.val}</div>
                <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{e.label}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className={`text-[10px] flex items-center gap-1 ${legality.cls}`}>
              <BadgeCheck className="h-3 w-3" /> {legality.label}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full glass text-muted-foreground capitalize">
              {job.type}
            </span>
            {job.requiredSkills.slice(0, 3).map((s) => (
              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full glass text-primary/80">{s}</span>
            ))}
          </div>

          {/* Apply button (prominent) */}
          {applyUrl && (
            <a
              href={applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackAction("rjss_apply_click")}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-aurora/20 border border-primary/30 text-primary text-[11px] font-medium hover:bg-aurora/30 transition-all"
            >
              <Link className="h-3 w-3" />
              Apply on {job.sourceName || "platform"}
              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
            </a>
          )}

          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? "Hide steps" : "Show how to apply"}
          </button>

          {expanded && (
            <div className="mt-3 space-y-2">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Steps to apply</div>
              {job.applySteps.map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[9px] font-bold text-primary flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </GlowCard>
  );
});

// ── SavedJobCard ──────────────────────────────────────────────────────────────

const SavedJobCard = memo(function SavedJobCard({
  entry, onUpdateStatus, onRemove,
}: {
  entry: SavedJobEntry;
  onUpdateStatus: (id: string, status: JobStatus, notes?: string) => void;
  onRemove: (id: string) => void;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(entry.notes);
  const meta = STATUS_META[entry.status];

  return (
    <GlowCard glow="blue" className="mb-3">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-aurora/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
          <Briefcase className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="font-display font-semibold text-sm truncate">{entry.job.title}</h4>
              <div className="text-[10px] text-muted-foreground mt-0.5">{entry.job.platform} · {entry.job.estimatedEarnings.daily}/day</div>
            </div>
            <button
              onClick={() => onRemove(entry.id)}
              className="text-muted-foreground hover:text-rose-400 transition-colors flex-shrink-0 p-1"
              title="Remove"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Status pipeline */}
          <div className="flex items-center gap-1 mt-3 flex-wrap">
            {STATUS_ORDER.map((s, i) => {
              const sm   = STATUS_META[s];
              const done = STATUS_ORDER.indexOf(entry.status) >= i && entry.status !== "rejected";
              const curr = entry.status === s;
              const isReject = s === "rejected";
              return (
                <div key={s} className="flex items-center gap-1">
                  <button
                    onClick={() => onUpdateStatus(entry.id, s)}
                    className={`text-[10px] px-2 py-1 rounded-full border transition-all font-medium ${
                      curr
                        ? `${sm.color} border-current bg-current/10`
                        : isReject && entry.status === "rejected"
                        ? "text-rose-400 border-rose-400/40 bg-rose-400/10"
                        : done && !isReject
                        ? "text-primary/60 border-primary/20 bg-primary/5"
                        : "text-muted-foreground border-white/10 glass hover:text-foreground"
                    }`}
                  >
                    {curr && (s === "offer" ? <CheckCircle2 className="h-3 w-3 inline mr-0.5" /> : s === "rejected" ? <XCircle className="h-3 w-3 inline mr-0.5" /> : null)}
                    {sm.label}
                  </button>
                  {i < STATUS_ORDER.length - 1 && i < 3 && (
                    <ChevronRight className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Current status badge */}
          <div className={`flex items-center gap-1.5 mt-2 text-[11px] ${meta.color}`}>
            <div className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
            {entry.updatedAt !== entry.savedAt && (
              <span className="text-muted-foreground">· updated {new Date(entry.updatedAt).toLocaleDateString()}</span>
            )}
          </div>

          {/* Notes */}
          <button
            onClick={() => setNotesOpen((v) => !v)}
            className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageSquare className="h-3 w-3" />
            {entry.notes ? "Edit notes" : "Add notes"}
          </button>
          {notesOpen && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onUpdateStatus(entry.id, entry.status, noteDraft);
                    setNotesOpen(false);
                  }
                }}
                placeholder="e.g. Applied via LinkedIn, waiting for response…"
                className="flex-1 glass rounded-lg px-3 py-1.5 text-xs bg-transparent border border-white/10 focus:border-primary/50 outline-none"
              />
              <button
                onClick={() => {
                  onUpdateStatus(entry.id, entry.status, noteDraft);
                  setNotesOpen(false);
                }}
                className="text-[10px] px-3 py-1.5 rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition"
              >
                Save
              </button>
            </div>
          )}
          {entry.notes && !notesOpen && (
            <p className="mt-1.5 text-[11px] text-muted-foreground italic">"{entry.notes}"</p>
          )}
        </div>
      </div>
    </GlowCard>
  );
});

// ── TagToggle ─────────────────────────────────────────────────────────────────

const TagToggle = memo(function TagToggle({
  items, selected, onToggle,
}: { items: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <button
          key={item}
          onClick={() => onToggle(item)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
            selected.includes(item)
              ? "bg-aurora text-primary-foreground border-transparent shadow-neon"
              : "glass text-muted-foreground border-white/10 hover:text-foreground"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
});

// ── Main page ─────────────────────────────────────────────────────────────────

function RjssPage() {
  const [tab, setTab]         = useState<"scan" | "saved">("scan");
  const [profile, setProfile] = useState<RjssProfile>({
    age: "", gender: "", student: false,
    skills: [], interests: [], location: "", hoursPerDay: 4,
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<RjssScanResult | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);

  const { saved, save, updateStatus, remove, isSaved } = useSavedJobs();

  function toggle<K extends "skills" | "interests">(key: K, value: string) {
    setProfile((p) => {
      const arr = p[key] || [];
      return { ...p, [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] };
    });
  }

  async function runScan() {
    if (!profile.age && !profile.skills?.length && !profile.location) {
      setError("Please fill in at least your age, a skill, or your location to start scanning.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    trackAction("rjss_scan");
    try {
      const data = await rjss.scan(profile);
      setResult(data);
      setScanned(true);
    } catch (e: unknown) {
      setError((e as { message?: string })?.message || "Scan failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // pipeline counts for the saved tab header
  const counts = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = saved.filter((e) => e.status === s).length;
    return acc;
  }, {} as Record<JobStatus, number>);

  return (
    <Shell>
      <PageHeader
        badge={{ icon: ScanSearch, label: "MODULE 11" }}
        title="Jobs"
        subtitle="RJSS — Real-Time Global Job Signal Scanner. AI scans the internet, job portals, and gig platforms to find real earning opportunities matched exactly to your profile."
      />

      {/* ── Tab switcher ──────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-6">
        {(["scan", "saved"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
              tab === t
                ? "bg-aurora text-primary-foreground border-transparent shadow-neon"
                : "glass text-muted-foreground border-white/10 hover:text-foreground"
            }`}
          >
            {t === "scan" ? (
              <span className="flex items-center gap-1.5"><ScanSearch className="h-3.5 w-3.5" /> Scan</span>
            ) : (
              <span className="flex items-center gap-1.5">
                <BookmarkCheck className="h-3.5 w-3.5" /> Saved
                {saved.length > 0 && (
                  <span className="h-4 min-w-4 px-1 rounded-full bg-primary/30 text-primary text-[10px] font-bold inline-flex items-center justify-center">
                    {saved.length}
                  </span>
                )}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SCAN TAB                                                             */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === "scan" && (
        <>
          {/* Profile form */}
          <GlowCard glow="blue" className="mb-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-9 w-9 rounded-2xl bg-aurora/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <Briefcase className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-sm">Your earning profile</h3>
                <p className="text-[11px] text-muted-foreground">The more you fill in, the better the match.</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground block mb-1.5">Age</label>
                <input type="number" min="10" max="80" placeholder="e.g. 19"
                  value={profile.age || ""}
                  onChange={(e) => setProfile((p) => ({ ...p, age: e.target.value }))}
                  className="w-full glass rounded-xl px-3 py-2.5 text-sm bg-transparent border border-white/10 focus:border-primary/50 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground block mb-1.5">Gender</label>
                <select value={profile.gender || ""}
                  onChange={(e) => setProfile((p) => ({ ...p, gender: e.target.value }))}
                  className="w-full glass rounded-xl px-3 py-2.5 text-sm bg-background border border-white/10 focus:border-primary/50 outline-none transition-colors"
                >
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non-binary">Non-binary</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground block mb-1.5">Location / City</label>
                <input type="text" placeholder="e.g. Mumbai, India"
                  value={profile.location || ""}
                  onChange={(e) => setProfile((p) => ({ ...p, location: e.target.value }))}
                  className="w-full glass rounded-xl px-3 py-2.5 text-sm bg-transparent border border-white/10 focus:border-primary/50 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground block mb-1.5">Hours available / day</label>
                <input type="number" min="1" max="16"
                  value={profile.hoursPerDay || 4}
                  onChange={(e) => setProfile((p) => ({ ...p, hoursPerDay: Number(e.target.value) }))}
                  className="w-full glass rounded-xl px-3 py-2.5 text-sm bg-transparent border border-white/10 focus:border-primary/50 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground block mb-1.5">Currency preference</label>
                <input type="text" placeholder="e.g. INR, USD, EUR"
                  value={profile.currency || ""}
                  onChange={(e) => setProfile((p) => ({ ...p, currency: e.target.value }))}
                  className="w-full glass rounded-xl px-3 py-2.5 text-sm bg-transparent border border-white/10 focus:border-primary/50 outline-none transition-colors"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-3 cursor-pointer">
                  <button type="button" role="switch" aria-checked={profile.student}
                    onClick={() => setProfile((p) => ({ ...p, student: !p.student }))}
                    className={`relative h-6 w-11 rounded-full transition-colors flex-shrink-0 ${profile.student ? "bg-aurora" : "bg-white/10"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${profile.student ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                  <span className="text-sm font-medium">I'm a student</span>
                </label>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground block mb-2">
                Your skills <span className="normal-case text-muted-foreground/60">(select all that apply)</span>
              </label>
              <TagToggle items={SKILL_PRESETS} selected={profile.skills || []} onToggle={(v) => toggle("skills", v)} />
            </div>

            <div className="mb-5">
              <label className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground block mb-2">
                Interests <span className="normal-case text-muted-foreground/60">(optional)</span>
              </label>
              <TagToggle items={INTEREST_PRESETS} selected={profile.interests || []} onToggle={(v) => toggle("interests", v)} />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-rose-400 glass rounded-xl p-3 mb-4">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" /><span>{error}</span>
              </div>
            )}

            <NeonButton onClick={runScan} disabled={loading} className="w-full sm:w-auto">
              {loading
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Scanning global job signals…</>
                : <><ScanSearch className="h-4 w-4" /> {scanned ? "Re-scan for new opportunities" : "Scan for jobs"}</>}
            </NeonButton>
          </GlowCard>

          {/* Loading */}
          {loading && (
            <GlowCard glow="purple" className="mb-6 text-center py-8">
              <div className="flex flex-col items-center gap-4">
                <div className="relative h-16 w-16">
                  <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
                  <div className="absolute inset-2 rounded-full bg-aurora/20 border border-primary/40 flex items-center justify-center">
                    <ScanSearch className="h-6 w-6 text-primary animate-pulse" />
                  </div>
                </div>
                <div>
                  <p className="font-display font-semibold text-sm">Scanning global job signals…</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Searching Fiverr · Upwork · LinkedIn · Appen · Internshala · Remote.co and more
                  </p>
                </div>
                <div className="flex gap-3 text-[10px] text-muted-foreground flex-wrap justify-center">
                  <span className="flex items-center gap-1"><Shield className="h-3 w-3 text-emerald-400" /> Filtering scams</span>
                  <span className="flex items-center gap-1"><Zap className="h-3 w-3 text-primary" /> Matching your profile</span>
                  <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-purple-400" /> Calculating earnings</span>
                </div>
              </div>
            </GlowCard>
          )}

          {/* Results */}
          {result && !loading && (
            <>
              <div className="grid sm:grid-cols-3 gap-3 mb-6">
                <GlowCard glow="blue" className="!p-4 flex items-center gap-3">
                  <Zap className="h-8 w-8 text-primary flex-shrink-0" />
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Earning potential</div>
                    <div className="font-display font-bold text-sm">{result.userEarningPotential}</div>
                  </div>
                </GlowCard>
                <GlowCard glow="purple" className="!p-4 flex items-center gap-3">
                  {result.scanMode === "web_search"
                    ? <Wifi className="h-7 w-7 text-emerald-400 flex-shrink-0" />
                    : <WifiOff className="h-7 w-7 text-amber-400 flex-shrink-0" />}
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Scan mode</div>
                    <div className="font-display font-bold text-sm">
                      {result.scanMode === "web_search" ? "Live web scan" : "AI knowledge base"}
                    </div>
                  </div>
                </GlowCard>
                <GlowCard glow="pink" className="!p-4 flex items-center gap-3">
                  <Star className="h-7 w-7 text-amber-400 flex-shrink-0" />
                  <div>
                    <div className="text-xs text-muted-foreground mb-0.5">Your profile</div>
                    <div className="font-display font-bold text-sm leading-tight">{result.profileSummary}</div>
                  </div>
                </GlowCard>
              </div>

              <div className="mb-2">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-9 w-9 rounded-2xl bg-aurora/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                    <ScanSearch className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-sm">Top {result.jobs.length} matched opportunities</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Ranked by match quality · scam-filtered · tap <Bookmark className="h-3 w-3 inline" /> to save a job
                    </p>
                  </div>
                </div>
                {result.jobs.map((job, i) => (
                  <JobCard
                    key={i}
                    job={job}
                    index={i}
                    onSave={save}
                    saved={isSaved(job)}
                  />
                ))}
              </div>

              {result.tips?.length > 0 && (
                <GlowCard glow="purple" className="mt-2">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4 text-primary" />
                    <h4 className="font-display font-semibold text-sm">LifeOS earning tips for you</h4>
                  </div>
                  <ul className="space-y-2">
                    {result.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" /><span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </GlowCard>
              )}
            </>
          )}

          {/* Empty state */}
          {!result && !loading && (
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { icon: ScanSearch, title: "Real-time scanning",  desc: "AI searches Fiverr, Upwork, LinkedIn, Appen, Internshala and 20+ platforms for live opportunities." },
                { icon: Shield,     title: "Scam detection",      desc: "Every job is scored for safety. Jobs with a scam-safety score below 60% are automatically filtered out." },
                { icon: TrendingUp, title: "Earnings calculator", desc: "Hourly · daily · weekly · monthly earning estimates calibrated to your location and availability." },
              ].map(({ icon: Icon, title, desc }) => (
                <GlowCard key={title} glow="blue">
                  <div className="h-9 w-9 rounded-2xl bg-aurora/20 border border-primary/30 flex items-center justify-center mb-3">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <h4 className="font-display font-semibold text-sm mb-1">{title}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </GlowCard>
              ))}
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SAVED TAB                                                            */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === "saved" && (
        <>
          {/* Pipeline summary */}
          {saved.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
              {STATUS_ORDER.map((s) => {
                const meta = STATUS_META[s];
                return (
                  <div key={s} className="glass rounded-2xl p-3 text-center">
                    <div className={`text-xl font-bold font-display ${meta.color}`}>{counts[s]}</div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-0.5">{meta.label}</div>
                  </div>
                );
              })}
            </div>
          )}

          {saved.length === 0 ? (
            <GlowCard glow="blue" className="text-center py-12">
              <div className="h-12 w-12 rounded-2xl bg-aurora/20 border border-primary/30 flex items-center justify-center mx-auto mb-4">
                <Bookmark className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-sm mb-1">No saved jobs yet</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Run a scan and tap the <BookmarkCheck className="h-3 w-3 inline" /> icon on any job to save it here.
              </p>
              <button
                onClick={() => setTab("scan")}
                className="text-xs px-4 py-2 rounded-xl bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition"
              >
                Go to Scan
              </button>
            </GlowCard>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-9 w-9 rounded-2xl bg-aurora/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                  <BookmarkCheck className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-sm">{saved.length} saved {saved.length === 1 ? "job" : "jobs"}</h3>
                  <p className="text-[11px] text-muted-foreground">Click a status badge to update your progress · add notes to each application</p>
                </div>
              </div>
              {saved.map((entry) => (
                <SavedJobCard
                  key={entry.id}
                  entry={entry}
                  onUpdateStatus={updateStatus}
                  onRemove={remove}
                />
              ))}
            </>
          )}
        </>
      )}
    </Shell>
  );
}
