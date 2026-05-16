import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, NeonButton } from "@/components/aurora/ui";
import {
  Users, Sparkles, Loader2, Globe2, ExternalLink,
  Hash, MessageSquare, Linkedin, Github, Twitter, X, Plus,
  AlertTriangle, Search, Zap,
} from "lucide-react";
import { getToken } from "@/lib/api";

export const Route = createFileRoute("/people")({
  head: () => ({ meta: [{ title: "People Match — LifeOS" }] }),
  component: PeopleMatch,
});

type Community = {
  name: string;
  platform: string;
  platformIcon: string;
  description: string;
  matchScore: number;
  memberCount: string;
  link: string;
  tags: string[];
  why: string;
  activity: string;
};

const PLATFORM_COLORS: Record<string, string> = {
  reddit:   "text-[#FF4500]",
  discord:  "text-[#5865F2]",
  linkedin: "text-[#0077B5]",
  github:   "text-foreground",
  slack:    "text-[#E01E5A]",
  twitter:  "text-[#1DA1F2]",
  globe:    "text-primary",
};

const ACTIVITY_COLORS: Record<string, string> = {
  "Very Active": "text-green-400 bg-green-400/10",
  "Active":      "text-blue-400 bg-blue-400/10",
  "Moderate":    "text-yellow-400 bg-yellow-400/10",
};

function PlatformIcon({ icon, className }: { icon: string; className?: string }) {
  const cls = `h-5 w-5 ${PLATFORM_COLORS[icon] || "text-primary"} ${className || ""}`;
  if (icon === "reddit")   return <Hash className={cls} />;
  if (icon === "discord")  return <MessageSquare className={cls} />;
  if (icon === "linkedin") return <Linkedin className={cls} />;
  if (icon === "github")   return <Github className={cls} />;
  if (icon === "twitter")  return <Twitter className={cls} />;
  return <Globe2 className={cls} />;
}

function TagInput({
  label, placeholder, tags, onChange,
}: {
  label: string;
  placeholder: string;
  tags: string[];
  onChange: (t: string[]) => void;
}) {
  const [val, setVal] = useState("");
  function add() {
    const t = val.trim();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setVal("");
  }
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((t) => (
          <span key={t} className="flex items-center gap-1 bg-aurora/20 border border-primary/30 text-primary text-xs px-2.5 py-1 rounded-full">
            {t}
            <button onClick={() => onChange(tags.filter((x) => x !== t))} className="text-primary/70 hover:text-primary">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text" value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 glass rounded-2xl px-3 py-2 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary"
        />
        <button onClick={add} className="glass rounded-2xl px-3 py-2 hover:bg-white/10 transition">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CommunityCard({ c, rank }: { c: Community; rank: number }) {
  return (
    <GlowCard glow={rank <= 3 ? "purple" : "blue"} className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl glass flex items-center justify-center flex-shrink-0">
            <PlatformIcon icon={c.platformIcon || c.platform.toLowerCase()} />
          </div>
          <div>
            <div className="font-display font-semibold text-base leading-tight">{c.name}</div>
            <div className="text-xs text-muted-foreground">{c.platform} · {c.memberCount}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <div className="text-xl font-bold text-primary">{c.matchScore}%</div>
          <div className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ACTIVITY_COLORS[c.activity] || "text-muted-foreground bg-white/5"}`}>
            {c.activity}
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed">{c.description}</p>

      <div className="glass rounded-xl px-3 py-2 flex items-start gap-2">
        <Zap className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-primary/90">{c.why}</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(c.tags || []).map((tag) => (
          <span key={tag} className="text-[10px] bg-aurora/10 border border-primary/20 text-primary px-2 py-0.5 rounded-full">
            {tag}
          </span>
        ))}
      </div>

      <a
        href={c.link}
        target="_blank"
        rel="noreferrer noopener"
        className="flex items-center justify-center gap-2 glass rounded-2xl py-2.5 text-sm hover:bg-white/10 transition font-medium group"
      >
        <ExternalLink className="h-3.5 w-3.5 group-hover:text-primary transition" />
        Join community
      </a>
    </GlowCard>
  );
}

function PeopleMatch() {
  const [interests, setInterests]   = useState<string[]>([]);
  const [skills, setSkills]         = useState<string[]>([]);
  const [topics, setTopics]         = useState<string[]>([]);
  const [personality, setPersonality] = useState("");
  const [country, setCountry]       = useState("");
  const [bio, setBio]               = useState("");
  const [loading, setLoading]       = useState(false);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [error, setError]           = useState<string | null>(null);
  const [searched, setSearched]     = useState(false);

  async function findCommunities() {
    if (!interests.length && !skills.length && !topics.length && !bio.trim()) {
      setError("Please add at least one interest, skill, or topic to find your community.");
      return;
    }
    setLoading(true); setError(null);
    try {
      const token = getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const resp = await fetch("/api/people/match", {
        method: "POST", headers,
        credentials: "same-origin",
        body: JSON.stringify({ interests, skills, topics, personality, country, bio }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Something went wrong");
      setCommunities(data.communities || []);
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to find communities");
    } finally {
      setLoading(false);
    }
  }

  const topMatches = communities.slice(0, 3);
  const rest       = communities.slice(3);

  return (
    <Shell>
      <PageHeader
        eyebrow="Community Intelligence"
        icon={Users}
        title="Find Your Tribe"
        subtitle="Tell us who you are. We'll find the communities where your kind of people already gather."
      />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Input panel */}
        <div className="lg:col-span-1 space-y-4">
          <GlowCard glow="purple">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-4 flex items-center gap-2">
              <Search className="h-3 w-3" /> About you
            </div>
            <div className="space-y-4">
              <TagInput label="Interests" placeholder="AI, hiking, music…" tags={interests} onChange={setInterests} />
              <TagInput label="Skills" placeholder="Python, design, writing…" tags={skills} onChange={setSkills} />
              <TagInput label="Topics you love" placeholder="space, startups, gaming…" tags={topics} onChange={setTopics} />

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Personality type</label>
                <input
                  type="text" value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  placeholder="INFJ, introvert, creative…"
                  className="w-full glass rounded-2xl px-3 py-2.5 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Country (optional)</label>
                <input
                  type="text" value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. United States"
                  className="w-full glass rounded-2xl px-3 py-2.5 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Short bio (optional)</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us a bit about yourself and what you're looking for…"
                  rows={3}
                  className="w-full glass rounded-2xl px-3 py-2.5 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>
            </div>

            {error && (
              <div className="mt-3 flex items-start gap-2 text-xs text-[oklch(0.7_0.22_320)] glass rounded-xl p-2.5">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> {error}
              </div>
            )}

            <NeonButton onClick={findCommunities} disabled={loading} className="w-full mt-4">
              {loading
                ? <><Loader2 className="inline h-4 w-4 mr-2 animate-spin" /> Finding your tribe…</>
                : <><Sparkles className="inline h-4 w-4 mr-2" /> Find my communities</>}
            </NeonButton>
          </GlowCard>

          <GlowCard glow="blue" className="text-xs text-muted-foreground space-y-1.5">
            <div className="font-medium text-foreground text-sm mb-2">How it works</div>
            <p>LifeOS AI analyses your interests and personality to find the best real communities where like-minded people already gather.</p>
            <p className="pt-1">Only publicly known communities are suggested. We never scan private data or violate platform terms.</p>
          </GlowCard>
        </div>

        {/* Results panel */}
        <div className="lg:col-span-2">
          {!searched && !loading && (
            <GlowCard glow="blue" className="flex flex-col items-center justify-center text-center py-20">
              <div className="h-16 w-16 rounded-3xl bg-aurora/20 border border-primary/30 flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-display font-bold text-xl mb-2">Your tribe is out there</h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                Fill in your interests and skills on the left. We'll match you to the communities where your people already hang out.
              </p>
            </GlowCard>
          )}

          {loading && (
            <GlowCard glow="purple" className="flex flex-col items-center justify-center text-center py-20">
              <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground text-sm">Scanning communities across the internet…</p>
            </GlowCard>
          )}

          {searched && !loading && communities.length === 0 && (
            <GlowCard glow="blue" className="text-center py-16">
              <p className="text-muted-foreground">No communities found. Try adding more interests or topics.</p>
            </GlowCard>
          )}

          {searched && !loading && communities.length > 0 && (
            <div className="space-y-4">
              {topMatches.length > 0 && (
                <>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground flex items-center gap-2">
                    <Sparkles className="h-3 w-3 text-primary" /> Top matches
                  </div>
                  <div className="grid sm:grid-cols-1 gap-4">
                    {topMatches.map((c, i) => (
                      <CommunityCard key={i} c={c} rank={i + 1} />
                    ))}
                  </div>
                </>
              )}
              {rest.length > 0 && (
                <>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mt-4">
                    More communities
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    {rest.map((c, i) => (
                      <CommunityCard key={i + 3} c={c} rank={i + 4} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
