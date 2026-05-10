import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, NeonButton } from "@/components/aurora/ui";
import {
  User, Save, Loader2, Sparkles, Briefcase, TrendingUp,
  BookOpen, Linkedin, Github, Link2, Plus, X, AlertTriangle,
  CheckCircle2, Rocket, Target, Brain,
} from "lucide-react";
import { getToken } from "@/lib/api";
import { getStoredUser, setStoredUser } from "@/lib/user";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — LifeOS" }] }),
  component: Profile,
});

type ProfileData = {
  id?: string; email?: string; name?: string; photoUrl?: string;
  about?: string; age?: number | null; gender?: string; personalityType?: string;
  skills?: string[]; linkedin?: string; github?: string; portfolio?: string;
  customLinks?: { label: string; url: string }[];
};

type CareerInsights = {
  summary?: string;
  jobOpportunities?: { title: string; company_type: string; match_pct: number; why: string; action: string }[];
  careerPaths?: { path: string; timeline: string; potential: string; steps: string[] }[];
  learningPaths?: { skill: string; resource: string; time: string; why: string }[];
  trendingRoles?: { role: string; demand: string; avgSalary: string; fit: string }[];
};

/* ── Field component ──────────────────────────────────────────────────────── */
function Field({
  label, value, onChange, type = "text", placeholder = "", rows, icon: Icon,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; rows?: number; icon?: React.ElementType;
}) {
  const cls = "w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary";
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      <div className="relative">
        {Icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
        {rows ? (
          <textarea
            value={value} onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder} rows={rows}
            className={`${cls} resize-none ${Icon ? "pl-9" : ""}`}
          />
        ) : (
          <input
            type={type} value={value} onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`${cls} ${Icon ? "pl-9" : ""}`}
          />
        )}
      </div>
    </div>
  );
}

/* ── Skills input ─────────────────────────────────────────────────────────── */
function SkillsInput({ skills, onChange }: { skills: string[]; onChange: (s: string[]) => void }) {
  const [val, setVal] = useState("");
  function add() {
    const t = val.trim();
    if (t && !skills.includes(t)) onChange([...skills, t]);
    setVal("");
  }
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Skills</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {skills.map((s) => (
          <span key={s} className="flex items-center gap-1 bg-aurora/20 border border-primary/30 text-primary text-xs px-2.5 py-1 rounded-full">
            {s}
            <button onClick={() => onChange(skills.filter((x) => x !== s))} className="text-primary/70 hover:text-primary">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        {skills.length === 0 && <span className="text-xs text-muted-foreground">No skills added yet.</span>}
      </div>
      <div className="flex gap-2">
        <input
          type="text" value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Add a skill…"
          className="flex-1 glass rounded-2xl px-3 py-2 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary"
        />
        <button onClick={add} className="glass rounded-2xl px-3 py-2 hover:bg-white/10 transition">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ── Custom links ─────────────────────────────────────────────────────────── */
function CustomLinksInput({
  links, onChange,
}: {
  links: { label: string; url: string }[];
  onChange: (l: { label: string; url: string }[]) => void;
}) {
  function add() { onChange([...links, { label: "", url: "" }]); }
  function update(i: number, field: "label" | "url", v: string) {
    const next = links.map((l, j) => j === i ? { ...l, [field]: v } : l);
    onChange(next);
  }
  function remove(i: number) { onChange(links.filter((_, j) => j !== i)); }
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Custom links</label>
      <div className="space-y-2">
        {links.map((l, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={l.label} onChange={(e) => update(i, "label", e.target.value)}
              placeholder="Label" className="w-28 glass rounded-2xl px-3 py-2 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              value={l.url} onChange={(e) => update(i, "url", e.target.value)}
              placeholder="URL" type="url"
              className="flex-1 glass rounded-2xl px-3 py-2 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary"
            />
            <button onClick={() => remove(i)} className="glass rounded-2xl px-3 py-2 hover:bg-white/10 text-muted-foreground transition">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <button onClick={add} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground glass rounded-xl px-3 py-2 transition">
          <Plus className="h-3.5 w-3.5" /> Add link
        </button>
      </div>
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────────────────── */
function Profile() {
  const [tab, setTab] = useState<"profile" | "career">("profile");
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [careerLoading, setCareerLoading] = useState(false);
  const [careerErr, setCareerErr]         = useState<string | null>(null);
  const [career, setCareer]               = useState<CareerInsights | null>(null);

  // Profile fields
  const stored = getStoredUser();
  const [name, setName]                   = useState(stored?.name || "");
  const [email]                           = useState(stored?.email || "");
  const [photoUrl, setPhotoUrl]           = useState(stored?.photoUrl || "");
  const [about, setAbout]                 = useState("");
  const [age, setAge]                     = useState("");
  const [gender, setGender]               = useState("");
  const [personalityType, setPersonalityType] = useState("");
  const [skills, setSkills]               = useState<string[]>([]);
  const [linkedin, setLinkedin]           = useState("");
  const [github, setGithub]               = useState("");
  const [portfolio, setPortfolio]         = useState("");
  const [customLinks, setCustomLinks]     = useState<{ label: string; url: string }[]>([]);

  // Load existing profile from backend
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch("/api/profile", {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then((data) => {
        const p: ProfileData = data.profile;
        if (!p) return;
        if (p.name)            setName(p.name);
        if (p.photoUrl)        setPhotoUrl(p.photoUrl);
        if (p.about)           setAbout(p.about);
        if (p.age)             setAge(String(p.age));
        if (p.gender)          setGender(p.gender);
        if (p.personalityType) setPersonalityType(p.personalityType);
        if (p.skills?.length)  setSkills(p.skills);
        if (p.linkedin)        setLinkedin(p.linkedin);
        if (p.github)          setGithub(p.github);
        if (p.portfolio)       setPortfolio(p.portfolio);
        if (p.customLinks)     setCustomLinks(p.customLinks);
      })
      .catch(() => {});
  }, []);

  const profilePayload = useCallback(() => ({
    name, photoUrl, about, age: age ? Number(age) : null,
    gender, personalityType, skills, linkedin, github, portfolio, customLinks,
  }), [name, photoUrl, about, age, gender, personalityType, skills, linkedin, github, portfolio, customLinks]);

  async function save() {
    setSaving(true); setSaveErr(null); setSaved(false);
    try {
      const token = getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const resp = await fetch("/api/profile", {
        method: "PUT", headers, credentials: "same-origin",
        body: JSON.stringify(profilePayload()),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Failed to save");
      setStoredUser({ ...stored, name: data.profile?.name || name, photoUrl: data.profile?.photoUrl || photoUrl });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function analyseCareer() {
    setCareerLoading(true); setCareerErr(null);
    try {
      const token = getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const resp = await fetch("/api/profile/career-insights", {
        method: "POST", headers, credentials: "same-origin",
        body: JSON.stringify({ profile: profilePayload() }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Analysis failed");
      setCareer(data);
    } catch (e) {
      setCareerErr(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setCareerLoading(false);
    }
  }

  const GENDER_OPTIONS = ["", "Male", "Female", "Non-binary", "Prefer not to say"];
  const PERSONALITY_OPTIONS = [
    "", "INTJ", "INTP", "ENTJ", "ENTP", "INFJ", "INFP", "ENFJ", "ENFP",
    "ISTJ", "ISFJ", "ESTJ", "ESFJ", "ISTP", "ISFP", "ESTP", "ESFP",
    "Introvert", "Extrovert", "Ambivert",
  ];

  return (
    <Shell>
      <PageHeader
        eyebrow="Account"
        icon={User}
        title="My Profile"
        subtitle="Your identity, skills, and goals — used by LifeOS AI to personalise every module."
      />

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6 glass rounded-2xl p-1 w-fit">
        {([
          { key: "profile", label: "Edit Profile", icon: User },
          { key: "career",  label: "Career AI",    icon: Rocket },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
              tab === t.key
                ? "bg-aurora text-primary-foreground shadow-neon"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Profile tab ─────────────────────────────────────────────────── */}
      {tab === "profile" && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: avatar + quick info */}
          <GlowCard glow="blue" className="flex flex-col items-center text-center gap-4">
            <div className="relative">
              {photoUrl ? (
                <img src={photoUrl} alt={name} className="h-24 w-24 rounded-full object-cover ring-2 ring-primary/40" />
              ) : (
                <div className="h-24 w-24 rounded-full bg-aurora flex items-center justify-center text-3xl font-bold text-primary-foreground">
                  {(name || email || "U").slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <div className="font-display font-bold text-lg">{name || "Your Name"}</div>
              <div className="text-xs text-muted-foreground">{email || "No email"}</div>
              {personalityType && (
                <div className="mt-1 text-xs glass rounded-full px-3 py-1 inline-block text-primary">{personalityType}</div>
              )}
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-center">
                {skills.slice(0, 6).map((s) => (
                  <span key={s} className="text-[10px] bg-aurora/10 border border-primary/20 text-primary px-2 py-0.5 rounded-full">{s}</span>
                ))}
                {skills.length > 6 && (
                  <span className="text-[10px] text-muted-foreground">+{skills.length - 6} more</span>
                )}
              </div>
            )}
            <div className="w-full space-y-1.5 text-sm">
              {linkedin && (
                <a href={linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-2 glass rounded-xl px-3 py-2 hover:bg-white/10 transition">
                  <Linkedin className="h-3.5 w-3.5 text-[#0077b5]" />
                  <span className="truncate text-xs">LinkedIn</span>
                </a>
              )}
              {github && (
                <a href={github} target="_blank" rel="noreferrer" className="flex items-center gap-2 glass rounded-xl px-3 py-2 hover:bg-white/10 transition">
                  <Github className="h-3.5 w-3.5" />
                  <span className="truncate text-xs">GitHub</span>
                </a>
              )}
              {portfolio && (
                <a href={portfolio} target="_blank" rel="noreferrer" className="flex items-center gap-2 glass rounded-xl px-3 py-2 hover:bg-white/10 transition">
                  <Link2 className="h-3.5 w-3.5 text-accent" />
                  <span className="truncate text-xs">Portfolio</span>
                </a>
              )}
              {customLinks.filter((l) => l.url).map((l, i) => (
                <a key={i} href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 glass rounded-xl px-3 py-2 hover:bg-white/10 transition">
                  <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate text-xs">{l.label || l.url}</span>
                </a>
              ))}
            </div>
          </GlowCard>

          {/* Right: edit form */}
          <div className="lg:col-span-2 space-y-4">
            <GlowCard glow="purple">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-4">Basic info</div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Full name"    value={name}    onChange={setName}    placeholder="Your full name" />
                <Field label="Age"          value={age}     onChange={setAge}     type="number" placeholder="25" />
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Gender</label>
                  <select
                    value={gender} onChange={(e) => setGender(e.target.value)}
                    className="w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary appearance-none"
                  >
                    {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g || "Select…"}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Personality type</label>
                  <select
                    value={personalityType} onChange={(e) => setPersonalityType(e.target.value)}
                    className="w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary appearance-none"
                  >
                    {PERSONALITY_OPTIONS.map((p) => <option key={p} value={p}>{p || "Select…"}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <Field label="Profile photo URL" value={photoUrl} onChange={setPhotoUrl} type="url" placeholder="https://example.com/photo.jpg" />
              </div>
              <div className="mt-4">
                <Field label="Bio / About me" value={about} onChange={setAbout} rows={3} placeholder="A short bio — your background, passions, what you're building…" />
              </div>
            </GlowCard>

            <GlowCard glow="blue">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-4">Skills & expertise</div>
              <SkillsInput skills={skills} onChange={setSkills} />
            </GlowCard>

            <GlowCard glow="pink">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-4">Links & profiles</div>
              <div className="space-y-3">
                <Field label="LinkedIn"  value={linkedin}  onChange={setLinkedin}  type="url" placeholder="https://linkedin.com/in/…" icon={Linkedin} />
                <Field label="GitHub"    value={github}    onChange={setGithub}    type="url" placeholder="https://github.com/…"     icon={Github} />
                <Field label="Portfolio" value={portfolio} onChange={setPortfolio} type="url" placeholder="https://yoursite.com"      icon={Link2} />
                <CustomLinksInput links={customLinks} onChange={setCustomLinks} />
              </div>
            </GlowCard>

            {saveErr && (
              <div className="flex items-start gap-2 text-xs text-[oklch(0.7_0.22_320)] glass rounded-2xl p-3">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {saveErr}
              </div>
            )}
            {saved && (
              <div className="flex items-center gap-2 text-xs text-[oklch(0.65_0.18_150)] glass rounded-2xl p-3">
                <CheckCircle2 className="h-4 w-4 shrink-0" /> Profile saved successfully!
              </div>
            )}

            <div className="flex gap-3">
              <NeonButton onClick={save} disabled={saving} className="flex-1">
                {saving ? <Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> : <Save className="inline h-4 w-4 mr-2" />}
                {saving ? "Saving…" : "Save profile"}
              </NeonButton>
              <button
                onClick={() => { setTab("career"); analyseCareer(); }}
                className="flex items-center gap-2 glass rounded-2xl px-4 py-2.5 text-sm hover:bg-white/10 transition"
              >
                <Sparkles className="h-4 w-4 text-primary" /> Career AI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Career AI tab ──────────────────────────────────────────────── */}
      {tab === "career" && (
        <div className="space-y-6">
          <GlowCard glow="blue">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">AI Career Intelligence</div>
                <h3 className="font-display font-semibold text-lg mt-1">Personalised career analysis</h3>
                <p className="text-sm text-muted-foreground mt-1">Based on your profile, skills, and personality — powered by AI.</p>
              </div>
              <NeonButton onClick={analyseCareer} disabled={careerLoading}>
                {careerLoading
                  ? <Loader2 className="inline h-4 w-4 mr-2 animate-spin" />
                  : <Sparkles className="inline h-4 w-4 mr-2" />}
                {career ? "Re-analyse" : "Analyse my profile"}
              </NeonButton>
            </div>
          </GlowCard>

          {careerErr && (
            <div className="flex items-start gap-2 text-xs text-[oklch(0.7_0.22_320)] glass rounded-2xl p-3">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {careerErr}
            </div>
          )}

          {!career && !careerLoading && (
            <GlowCard glow="purple" className="text-center py-12">
              <Brain className="h-10 w-10 text-primary mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                Fill in your profile (skills, age, bio) then tap "Analyse my profile" for personalised job and career recommendations.
              </p>
            </GlowCard>
          )}

          {careerLoading && (
            <GlowCard glow="blue" className="flex items-center gap-3 py-8 justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Analysing your profile with AI…</span>
            </GlowCard>
          )}

          {career && !careerLoading && (
            <>
              {career.summary && (
                <GlowCard glow="blue">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">Career snapshot</div>
                  <p className="text-sm">{career.summary}</p>
                </GlowCard>
              )}

              <div className="grid lg:grid-cols-2 gap-4">
                {/* Job Opportunities */}
                {(career.jobOpportunities?.length ?? 0) > 0 && (
                  <GlowCard glow="purple">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-9 w-9 rounded-2xl bg-aurora/20 border border-primary/30 flex items-center justify-center">
                        <Briefcase className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="font-display font-semibold">Top job opportunities</h3>
                    </div>
                    <ul className="space-y-3">
                      {career.jobOpportunities!.map((j, i) => (
                        <li key={i} className="glass rounded-2xl p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-medium text-sm">{j.title}</div>
                            <span className="text-[10px] uppercase tracking-[0.2em] text-primary flex-shrink-0 font-semibold">{j.match_pct}%</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">{j.company_type}</div>
                          <div className="text-xs mt-2">{j.why}</div>
                          <div className="mt-2 text-[11px] text-primary font-medium">→ {j.action}</div>
                        </li>
                      ))}
                    </ul>
                  </GlowCard>
                )}

                {/* Trending roles */}
                {(career.trendingRoles?.length ?? 0) > 0 && (
                  <GlowCard glow="pink">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-9 w-9 rounded-2xl bg-aurora/20 border border-primary/30 flex items-center justify-center">
                        <TrendingUp className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="font-display font-semibold">Trending roles in 2025–26</h3>
                    </div>
                    <ul className="space-y-3">
                      {career.trendingRoles!.map((r, i) => (
                        <li key={i} className="glass rounded-2xl p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm">{r.role}</span>
                            <span className={`text-[10px] uppercase tracking-[0.15em] font-semibold px-2 py-0.5 rounded-full ${
                              r.demand === "Explosive"
                                ? "bg-[oklch(0.7_0.22_25)/0.2] text-[oklch(0.7_0.22_25)]"
                                : "bg-aurora/20 text-primary"
                            }`}>{r.demand}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">{r.fit}</div>
                          <div className="text-xs text-primary mt-1 font-medium">{r.avgSalary}</div>
                        </li>
                      ))}
                    </ul>
                  </GlowCard>
                )}

                {/* Career paths */}
                {(career.careerPaths?.length ?? 0) > 0 && (
                  <GlowCard glow="blue">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-9 w-9 rounded-2xl bg-aurora/20 border border-primary/30 flex items-center justify-center">
                        <Target className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="font-display font-semibold">Career paths</h3>
                    </div>
                    <ul className="space-y-3">
                      {career.careerPaths!.map((p, i) => (
                        <li key={i} className="glass rounded-2xl p-3">
                          <div className="font-medium text-sm">{p.path}</div>
                          <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
                            <span>⏱ {p.timeline}</span>
                            <span>💰 {p.potential}</span>
                          </div>
                          <ul className="mt-2 space-y-1">
                            {p.steps.map((s, j) => (
                              <li key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                                <span className="text-primary flex-shrink-0">{j + 1}.</span> {s}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </GlowCard>
                )}

                {/* Learning paths */}
                {(career.learningPaths?.length ?? 0) > 0 && (
                  <GlowCard glow="purple">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-9 w-9 rounded-2xl bg-aurora/20 border border-primary/30 flex items-center justify-center">
                        <BookOpen className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="font-display font-semibold">Learning paths</h3>
                    </div>
                    <ul className="space-y-3">
                      {career.learningPaths!.map((l, i) => (
                        <li key={i} className="glass rounded-2xl p-3">
                          <div className="font-medium text-sm">{l.skill}</div>
                          <div className="text-xs text-muted-foreground mt-1">{l.resource}</div>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-[11px] text-muted-foreground">⏱ {l.time}</span>
                            <span className="text-[11px] text-primary">{l.why}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </GlowCard>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </Shell>
  );
}
