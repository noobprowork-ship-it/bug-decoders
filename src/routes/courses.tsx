import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback, memo } from "react";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, NeonButton } from "@/components/aurora/ui";
import {
  GraduationCap, Loader2, AlertTriangle, ExternalLink, Star,
  Clock, Award, BookOpen, Bookmark, BookmarkCheck, Trash2,
  Wifi, WifiOff, MapPin, DollarSign, Briefcase, Plus, X, Search,
} from "lucide-react";
import { courses as coursesApi, type FreeCourse, type Internship } from "@/lib/api";
import { trackAction } from "@/lib/activityTracker";

export const Route = createFileRoute("/courses")({
  head: () => ({ meta: [{ title: "Courses & Internships — LifeOS" }] }),
  component: CoursesPage,
});

// ── Saved state ───────────────────────────────────────────────────────────────
const LS_KEY = "lifeos.courses.saved";

type SavedItem = {
  id: string;
  item: FreeCourse | Internship;
  itemType: "course" | "internship";
  savedAt: string;
};

function loadSaved(): SavedItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}

function persistSaved(items: SavedItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

function useSaved() {
  const [saved, setSaved] = useState<SavedItem[]>(() => loadSaved());

  const save = useCallback((item: FreeCourse | Internship, itemType: "course" | "internship") => {
    const existing = loadSaved();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    if (existing.some((e) => e.item.title === item.title)) return;
    const entry: SavedItem = { id, item, itemType, savedAt: new Date().toISOString() };
    const next = [entry, ...existing];
    persistSaved(next);
    setSaved(next);
    coursesApi.save({ id, item, itemType }).catch(() => {});
    trackAction("courses_save");
  }, []);

  const remove = useCallback((id: string) => {
    setSaved((prev) => {
      const next = prev.filter((e) => e.id !== id);
      persistSaved(next);
      coursesApi.removeSaved(id).catch(() => {});
      return next;
    });
    trackAction("courses_unsave");
  }, []);

  const isSaved = (item: FreeCourse | Internship) => saved.some((e) => e.item.title === item.title);

  return { saved, save, remove, isSaved };
}

// ── Level badge ───────────────────────────────────────────────────────────────
function levelColor(level: string) {
  if (level === "beginner") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
  if (level === "intermediate") return "text-amber-400 bg-amber-500/10 border-amber-500/30";
  return "text-rose-400 bg-rose-500/10 border-rose-500/30";
}

// ── Course Card ───────────────────────────────────────────────────────────────
const CourseCard = memo(function CourseCard({
  course, index, onSave, saved,
}: { course: FreeCourse; index: number; onSave: () => void; saved: boolean }) {
  return (
    <GlowCard glow={index % 3 === 0 ? "blue" : index % 3 === 1 ? "purple" : "pink"} className="mb-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-2xl bg-aurora/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
          <GraduationCap className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-semibold text-base">{course.title}</h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{course.provider}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${levelColor(course.level)}`}>
                  {course.level}
                </span>
                {course.certificate && (
                  <span className="text-[10px] flex items-center gap-0.5 text-emerald-400">
                    <Award className="h-3 w-3" /> Certificate
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {course.durationLabel && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" /> {course.durationLabel}
                  </span>
                )}
                {course.rating > 0 && (
                  <span className="flex items-center gap-0.5 text-[10px] text-amber-400">
                    <Star className="h-3 w-3" /> {course.rating.toFixed(1)}
                    {course.ratingCount > 0 && <span className="text-muted-foreground ml-0.5">({course.ratingCount.toLocaleString()})</span>}
                  </span>
                )}
                <span className="flex items-center gap-0.5 text-[10px] text-emerald-400 font-medium">
                  Free
                </span>
              </div>
            </div>
            <button
              onClick={onSave}
              title={saved ? "Saved" : "Save course"}
              className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all border flex-shrink-0 ${
                saved
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "glass border-white/10 text-muted-foreground hover:text-primary hover:border-primary/40"
              }`}
            >
              {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            </button>
          </div>

          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{course.description}</p>

          {course.skills?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {course.skills.slice(0, 4).map((s) => (
                <span key={s} className="text-[10px] px-2 py-0.5 rounded-full glass text-primary/80">{s}</span>
              ))}
            </div>
          )}

          {course.prerequisites && course.prerequisites !== "None" && (
            <p className="text-[11px] text-muted-foreground mt-2">
              <span className="text-muted-foreground/60">Prerequisites:</span> {course.prerequisites}
            </p>
          )}

          {course.paidOption && course.paidOption !== "Fully free" && (
            <p className="text-[10px] text-muted-foreground/60 mt-1">Paid option: {course.paidOption}</p>
          )}

          <div className="mt-3 flex gap-2 flex-wrap">
            {course.courseUrl && (
              <a
                href={course.courseUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackAction("courses_click")}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-aurora/20 border border-primary/30 text-primary text-[11px] font-medium hover:bg-aurora/30 transition-all"
              >
                <BookOpen className="h-3 w-3" />
                Start learning
                <ExternalLink className="h-2.5 w-2.5 opacity-60" />
              </a>
            )}
            {course.providerUrl && course.providerUrl !== course.courseUrl && (
              <a
                href={course.providerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass border border-white/10 text-muted-foreground text-[11px] hover:text-foreground transition-all"
              >
                {course.provider}
                <ExternalLink className="h-2.5 w-2.5 opacity-60" />
              </a>
            )}
          </div>
        </div>
      </div>
    </GlowCard>
  );
});

// ── Internship Card ───────────────────────────────────────────────────────────
const InternCard = memo(function InternCard({
  intern, index, onSave, saved,
}: { intern: Internship; index: number; onSave: () => void; saved: boolean }) {
  function scamColor(score: number) {
    if (score >= 80) return "text-emerald-400";
    if (score >= 65) return "text-amber-400";
    return "text-rose-400";
  }

  return (
    <GlowCard glow={index % 3 === 0 ? "blue" : index % 3 === 1 ? "purple" : "pink"} className="mb-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-2xl bg-aurora/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
          <Briefcase className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-semibold text-base">{intern.role}</h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{intern.company}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full glass font-medium capitalize`}>{intern.type}</span>
                <span className={`text-[10px] font-medium ${scamColor(intern.scamSafeScore)}`}>
                  {intern.scamSafeScore}% safe
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {intern.location && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="h-3 w-3" /> {intern.location}
                  </span>
                )}
                {intern.stipend && (
                  <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                    <DollarSign className="h-3 w-3" /> {intern.stipend}
                  </span>
                )}
                {intern.duration && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" /> {intern.duration}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onSave}
              title={saved ? "Saved" : "Save internship"}
              className={`h-8 w-8 rounded-xl flex items-center justify-center transition-all border flex-shrink-0 ${
                saved
                  ? "bg-primary/20 border-primary/40 text-primary"
                  : "glass border-white/10 text-muted-foreground hover:text-primary hover:border-primary/40"
              }`}
            >
              {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            </button>
          </div>

          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{intern.description}</p>

          {intern.requirements && (
            <p className="text-[11px] text-muted-foreground mt-2">
              <span className="text-muted-foreground/60">Requirements:</span> {intern.requirements}
            </p>
          )}

          {intern.skills?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {intern.skills.slice(0, 4).map((s) => (
                <span key={s} className="text-[10px] px-2 py-0.5 rounded-full glass text-primary/80">{s}</span>
              ))}
            </div>
          )}

          {intern.perks?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {intern.perks.map((p) => (
                <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">{p}</span>
              ))}
            </div>
          )}

          <div className="mt-3 flex gap-2 flex-wrap items-center">
            {intern.deadline && intern.deadline !== "Unknown" && (
              <span className="text-[10px] text-muted-foreground">Deadline: {intern.deadline}</span>
            )}
            {intern.applyUrl && (
              <a
                href={intern.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackAction("internship_apply_click")}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-aurora/20 border border-primary/30 text-primary text-[11px] font-medium hover:bg-aurora/30 transition-all"
              >
                Apply on {intern.applyPlatform || "platform"}
                <ExternalLink className="h-2.5 w-2.5 opacity-60" />
              </a>
            )}
            {intern.companyWebsite && (
              <a
                href={intern.companyWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass border border-white/10 text-muted-foreground text-[11px] hover:text-foreground transition-all"
              >
                {intern.company}
                <ExternalLink className="h-2.5 w-2.5 opacity-60" />
              </a>
            )}
          </div>
        </div>
      </div>
    </GlowCard>
  );
});

// ── Tag toggle ────────────────────────────────────────────────────────────────
const SKILL_TAGS = [
  "Programming", "Python", "JavaScript", "Data Science", "AI/ML", "Web Development",
  "Design", "Marketing", "Finance", "Writing", "Video Editing", "Photography",
  "Mobile Development", "Cybersecurity", "Cloud Computing", "Excel / Sheets",
];

const FIELD_TAGS = [
  "Technology", "Business", "Finance", "Healthcare", "Education", "Marketing",
  "Engineering", "Arts & Media", "Research", "Nonprofit / NGO",
];

// ── Main component ────────────────────────────────────────────────────────────
function CoursesPage() {
  const [tab, setTab] = useState<"courses" | "internships" | "saved">("courses");

  // Course search
  const [courseTopic, setCourseTopic] = useState("");
  const [courseLevel, setCourseLevel] = useState("any");
  const [wantsCert, setWantsCert]     = useState(false);
  const [courseResults, setCourseResults] = useState<FreeCourse[] | null>(null);
  const [courseSearchSummary, setCourseSearchSummary] = useState("");
  const [courseScanMode, setCourseScanMode] = useState<"web_search" | "fallback">("fallback");
  const [courseLoading, setCourseLoading]   = useState(false);
  const [courseError, setCourseError]       = useState<string | null>(null);

  // Internship search
  const [internSkills, setInternSkills]   = useState<string[]>([]);
  const [customSkill, setCustomSkill]     = useState("");
  const [internField, setInternField]     = useState("any");
  const [internLocation, setInternLocation] = useState("");
  const [internType, setInternType]       = useState("any");
  const [internResults, setInternResults] = useState<Internship[] | null>(null);
  const [internSummary, setInternSummary] = useState("");
  const [internScanMode, setInternScanMode] = useState<"web_search" | "fallback">("fallback");
  const [internLoading, setInternLoading] = useState(false);
  const [internError, setInternError]     = useState<string | null>(null);

  const { saved, save, remove, isSaved } = useSaved();

  // ── Course search ───────────────────────────────────────────────────────────
  const searchCourses = useCallback(async () => {
    if (!courseTopic.trim()) {
      setCourseError("Enter a topic or skill to search for courses.");
      return;
    }
    setCourseLoading(true); setCourseError(null); setCourseResults(null);
    trackAction("courses_search");
    try {
      const data = await coursesApi.findFree({
        topic: courseTopic,
        level: courseLevel,
        wantsCertificate: wantsCert,
        count: 6,
      });
      setCourseResults(data.courses);
      setCourseSearchSummary(data.searchSummary || "");
      setCourseScanMode(data.scanMode);
    } catch (e: unknown) {
      setCourseError((e as { message?: string })?.message || "Search failed. Please try again.");
    } finally {
      setCourseLoading(false);
    }
  }, [courseTopic, courseLevel, wantsCert]);

  // ── Internship search ───────────────────────────────────────────────────────
  const searchInternships = useCallback(async () => {
    if (!internSkills.length && internField === "any") {
      setInternError("Select at least one skill or field to search internships.");
      return;
    }
    setInternLoading(true); setInternError(null); setInternResults(null);
    trackAction("internships_search");
    try {
      const data = await coursesApi.findInternships({
        skills: internSkills,
        location: internLocation || "global",
        type: internType,
        field: internField,
        count: 6,
      });
      setInternResults(data.internships);
      setInternSummary(data.searchSummary || "");
      setInternScanMode(data.scanMode);
    } catch (e: unknown) {
      setInternError((e as { message?: string })?.message || "Search failed. Please try again.");
    } finally {
      setInternLoading(false);
    }
  }, [internSkills, internField, internLocation, internType]);

  function toggleSkill(skill: string) {
    setInternSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  }

  function addCustomSkill() {
    const v = customSkill.trim();
    if (v && !internSkills.includes(v)) setInternSkills((prev) => [...prev, v]);
    setCustomSkill("");
  }

  return (
    <Shell>
      <PageHeader
        badge={{ icon: GraduationCap, label: "MODULE 12" }}
        title="Courses & Internships"
        subtitle="Find free certified courses and real internship opportunities matched to your skills and goals."
      />

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {([
          { id: "courses",      label: "Free Courses" },
          { id: "internships",  label: "Internships" },
          { id: "saved",        label: "Saved" },
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
            {t.id === "courses" && <span className="flex items-center gap-1.5"><BookOpen className="h-3.5 w-3.5" /> {t.label}</span>}
            {t.id === "internships" && <span className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" /> {t.label}</span>}
            {t.id === "saved" && (
              <span className="flex items-center gap-1.5">
                <BookmarkCheck className="h-3.5 w-3.5" /> {t.label}
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
      {/* FREE COURSES TAB                                                      */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === "courses" && (
        <>
          <GlowCard glow="blue" className="mb-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-9 w-9 rounded-2xl bg-aurora/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-sm">Free Course Finder</h3>
                <p className="text-[11px] text-muted-foreground">AI scans Coursera, edX, Khan Academy, FreeCodeCamp, Google, and more for free certified courses.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 block">Topic or skill</label>
                <div className="flex gap-2">
                  <input
                    value={courseTopic}
                    onChange={(e) => setCourseTopic(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") searchCourses(); }}
                    placeholder="e.g. Python, Digital Marketing, Data Analysis, UX Design…"
                    className="flex-1 glass rounded-xl px-3 py-2.5 text-sm bg-transparent outline-none border border-white/10 focus:border-primary/50"
                  />
                  <NeonButton onClick={searchCourses} disabled={courseLoading}>
                    {courseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </NeonButton>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1.5 block">Level</label>
                  <select
                    value={courseLevel}
                    onChange={(e) => setCourseLevel(e.target.value)}
                    className="w-full glass rounded-xl px-3 py-2 text-sm bg-transparent outline-none border border-white/10 focus:border-primary/50"
                  >
                    <option value="any">Any level</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer py-2">
                    <input
                      type="checkbox"
                      checked={wantsCert}
                      onChange={(e) => setWantsCert(e.target.checked)}
                      className="rounded accent-primary"
                    />
                    <span className="text-sm text-muted-foreground">Prefer certificate</span>
                  </label>
                </div>
              </div>
            </div>

            {courseError && (
              <div className="mt-4 flex items-start gap-2 glass rounded-xl p-3 text-xs text-[oklch(0.7_0.22_320)]">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{courseError}
              </div>
            )}
          </GlowCard>

          {courseLoading && (
            <GlowCard glow="blue" className="mb-6">
              <div className="flex flex-col items-center py-10 gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Scanning free courses for "{courseTopic}"…</p>
                <p className="text-xs opacity-60">This may take 10–20 seconds with live search.</p>
              </div>
            </GlowCard>
          )}

          {courseResults && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className={`flex items-center gap-1 text-[10px] ${courseScanMode === "web_search" ? "text-emerald-400" : "text-amber-400"}`}>
                  {courseScanMode === "web_search" ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {courseScanMode === "web_search" ? "Live web search" : "Training data"}
                </div>
                {courseSearchSummary && (
                  <p className="text-xs text-muted-foreground truncate">{courseSearchSummary}</p>
                )}
              </div>
              {courseResults.map((course, i) => (
                <CourseCard
                  key={i}
                  course={course}
                  index={i}
                  saved={isSaved(course)}
                  onSave={() => save(course, "course")}
                />
              ))}
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* INTERNSHIPS TAB                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === "internships" && (
        <>
          <GlowCard glow="purple" className="mb-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="h-9 w-9 rounded-2xl bg-aurora/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <Briefcase className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-sm">Internship Finder</h3>
                <p className="text-[11px] text-muted-foreground">AI scans LinkedIn, Internshala, Indeed, AngelList, and more for real open internships.</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Skills */}
              <div>
                <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 block">Your skills</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {SKILL_TAGS.map((s) => (
                    <button key={s} onClick={() => toggleSkill(s)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                        internSkills.includes(s)
                          ? "bg-aurora text-primary-foreground border-transparent shadow-neon"
                          : "glass text-muted-foreground border-white/10 hover:text-foreground"
                      }`}
                    >{s}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={customSkill}
                    onChange={(e) => setCustomSkill(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addCustomSkill(); }}
                    placeholder="Add custom skill…"
                    className="flex-1 glass rounded-xl px-3 py-2 text-sm bg-transparent outline-none border border-white/10 focus:border-primary/50"
                  />
                  <button onClick={addCustomSkill} className="glass rounded-xl px-3 py-2 hover:bg-white/10 transition border border-white/10">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {internSkills.filter((s) => !SKILL_TAGS.includes(s)).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {internSkills.filter((s) => !SKILL_TAGS.includes(s)).map((s) => (
                      <span key={s} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary">
                        {s}
                        <button onClick={() => toggleSkill(s)} className="opacity-60 hover:opacity-100"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Field + Location + Type */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1.5 block">Field / Industry</label>
                  <select
                    value={internField}
                    onChange={(e) => setInternField(e.target.value)}
                    className="w-full glass rounded-xl px-3 py-2 text-sm bg-transparent outline-none border border-white/10 focus:border-primary/50"
                  >
                    <option value="any">Any field</option>
                    {FIELD_TAGS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1.5 block">Location</label>
                  <input
                    value={internLocation}
                    onChange={(e) => setInternLocation(e.target.value)}
                    placeholder="City, country or Remote…"
                    className="w-full glass rounded-xl px-3 py-2 text-sm bg-transparent outline-none border border-white/10 focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1.5 block">Type</label>
                  <select
                    value={internType}
                    onChange={(e) => setInternType(e.target.value)}
                    className="w-full glass rounded-xl px-3 py-2 text-sm bg-transparent outline-none border border-white/10 focus:border-primary/50"
                  >
                    <option value="any">Any</option>
                    <option value="remote">Remote</option>
                    <option value="onsite">On-site</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
              </div>
            </div>

            {internError && (
              <div className="mt-4 flex items-start gap-2 glass rounded-xl p-3 text-xs text-[oklch(0.7_0.22_320)]">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{internError}
              </div>
            )}

            <NeonButton onClick={searchInternships} disabled={internLoading} className="mt-5">
              {internLoading
                ? <><Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> Scanning…</>
                : <><Search className="inline h-4 w-4 mr-2" /> Find internships</>
              }
            </NeonButton>
          </GlowCard>

          {internLoading && (
            <GlowCard glow="purple" className="mb-6">
              <div className="flex flex-col items-center py-10 gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm">Scanning for internships matched to your profile…</p>
                <p className="text-xs opacity-60">This may take 10–20 seconds with live search.</p>
              </div>
            </GlowCard>
          )}

          {internResults && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className={`flex items-center gap-1 text-[10px] ${internScanMode === "web_search" ? "text-emerald-400" : "text-amber-400"}`}>
                  {internScanMode === "web_search" ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {internScanMode === "web_search" ? "Live web search" : "Training data"}
                </div>
                {internSummary && <p className="text-xs text-muted-foreground truncate">{internSummary}</p>}
              </div>
              {internResults.map((intern, i) => (
                <InternCard
                  key={i}
                  intern={intern}
                  index={i}
                  saved={isSaved(intern)}
                  onSave={() => save(intern, "internship")}
                />
              ))}
            </>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SAVED TAB                                                             */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {tab === "saved" && (
        <>
          {saved.length === 0 ? (
            <GlowCard glow="blue">
              <div className="flex flex-col items-center py-10 gap-3 text-muted-foreground">
                <Bookmark className="h-10 w-10 opacity-30" />
                <p className="text-sm">No saved items yet.</p>
                <p className="text-xs opacity-60">Save courses or internships using the bookmark icon.</p>
              </div>
            </GlowCard>
          ) : (
            <div className="space-y-3">
              {saved.map((entry) => (
                <GlowCard key={entry.id} glow="blue">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-xl bg-aurora/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                      {entry.itemType === "course"
                        ? <GraduationCap className="h-4 w-4 text-primary" />
                        : <Briefcase className="h-4 w-4 text-primary" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-display font-semibold text-sm">{entry.item.title}</h4>
                          <div className="text-[10px] text-muted-foreground mt-0.5 capitalize">{entry.itemType}</div>
                        </div>
                        <button onClick={() => remove(entry.id)} className="text-muted-foreground hover:text-rose-400 transition-colors flex-shrink-0 p-1">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {"courseUrl" in entry.item && entry.item.courseUrl && (
                        <a href={(entry.item as FreeCourse).courseUrl} target="_blank" rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                          Open course <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                      {"applyUrl" in entry.item && (entry.item as Internship).applyUrl && (
                        <a href={(entry.item as Internship).applyUrl} target="_blank" rel="noopener noreferrer"
                          className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                          Apply <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </GlowCard>
              ))}
            </div>
          )}
        </>
      )}
    </Shell>
  );
}
