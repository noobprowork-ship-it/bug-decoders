import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, NeonButton } from "@/components/aurora/ui";
import {
  Newspaper, Loader2, ExternalLink, RefreshCw, Search,
  Globe2, Cpu, TrendingUp, Heart, Beaker, Clapperboard,
  Zap, AlertTriangle, Clock, ChevronRight,
} from "lucide-react";
import { news, type NewsArticle } from "@/lib/api";

export const Route = createFileRoute("/news")({
  head: () => ({ meta: [{ title: "News — LifeOS" }] }),
  component: NewsPage,
});

const TOPICS = [
  { id: "headlines",    label: "Top Headlines",  icon: Newspaper,    query: "top world news headlines today" },
  { id: "technology",   label: "Technology",     icon: Cpu,          query: "latest technology and AI news today" },
  { id: "business",     label: "Business",       icon: TrendingUp,   query: "business markets economy news today" },
  { id: "science",      label: "Science",        icon: Beaker,       query: "science discovery space news today" },
  { id: "health",       label: "Health",         icon: Heart,        query: "health medicine wellness news today" },
  { id: "entertainment",label: "Entertainment",  icon: Clapperboard, query: "entertainment celebrity movies music news today" },
  { id: "world",        label: "World",          icon: Globe2,       query: "international world politics geopolitics news today" },
] as const;

type TopicId = (typeof TOPICS)[number]["id"];

const CATEGORY_COLORS: Record<string, string> = {
  Technology:    "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Business:      "bg-green-500/15 text-green-400 border-green-500/30",
  Science:       "bg-purple-500/15 text-purple-400 border-purple-500/30",
  Health:        "bg-pink-500/15 text-pink-400 border-pink-500/30",
  Entertainment: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  World:         "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  Politics:      "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Sports:        "bg-red-500/15 text-red-400 border-red-500/30",
};

function CategoryBadge({ category }: { category: string }) {
  const cls = CATEGORY_COLORS[category] || "bg-primary/15 text-primary border-primary/30";
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full border ${cls}`}>
      {category}
    </span>
  );
}

function ArticleCard({ article, featured = false }: { article: NewsArticle; featured?: boolean }) {
  const [imgErr, setImgErr] = useState(false);

  return (
    <div className={`group glass rounded-3xl overflow-hidden hover:shadow-neon transition-all duration-300 flex flex-col ${featured ? "lg:flex-row" : ""}`}>
      {/* Image */}
      <div className={`relative overflow-hidden bg-aurora/10 flex-shrink-0 ${featured ? "lg:w-80 h-48 lg:h-auto" : "h-44"}`}>
        {!imgErr ? (
          <img
            src={article.imageUrl}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Newspaper className="h-10 w-10 text-primary/30" />
          </div>
        )}
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        {/* Category badge on image */}
        <div className="absolute top-3 left-3">
          <CategoryBadge category={article.category} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3 flex-shrink-0" />
          <span>{article.publishedAt}</span>
          <span className="text-border">·</span>
          <span className="font-medium text-foreground/70 truncate">{article.source}</span>
        </div>

        <h3 className={`font-display font-bold leading-tight group-hover:text-primary transition-colors ${featured ? "text-lg" : "text-sm"}`}>
          {article.title}
        </h3>

        <p className={`text-muted-foreground leading-relaxed flex-1 ${featured ? "text-sm" : "text-xs"} line-clamp-3`}>
          {article.description}
        </p>

        {/* Keywords */}
        {article.keywords?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {article.keywords.slice(0, 3).map((kw) => (
              <span key={kw} className="text-[10px] bg-aurora/10 border border-primary/15 text-primary/70 px-2 py-0.5 rounded-full">
                #{kw}
              </span>
            ))}
          </div>
        )}

        {/* Read more */}
        {article.sourceUrl && (
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium mt-auto pt-1 transition-colors group/link"
          >
            Read full article
            <ChevronRight className="h-3 w-3 group-hover/link:translate-x-0.5 transition-transform" />
          </a>
        )}
      </div>
    </div>
  );
}

function SkeletonCard({ featured = false }: { featured?: boolean }) {
  return (
    <div className={`glass rounded-3xl overflow-hidden animate-pulse flex flex-col ${featured ? "lg:flex-row" : ""}`}>
      <div className={`bg-aurora/10 flex-shrink-0 ${featured ? "lg:w-80 h-48 lg:h-auto" : "h-44"}`} />
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="h-3 bg-white/10 rounded-full w-1/3" />
        <div className="h-4 bg-white/10 rounded-full w-full" />
        <div className="h-4 bg-white/10 rounded-full w-4/5" />
        <div className="h-3 bg-white/10 rounded-full w-full" />
        <div className="h-3 bg-white/10 rounded-full w-3/4" />
      </div>
    </div>
  );
}

function NewsPage() {
  const [activeTopic, setActiveTopic]   = useState<TopicId>("headlines");
  const [searchQuery, setSearchQuery]   = useState("");
  const [searchInput, setSearchInput]   = useState("");
  const [loading, setLoading]           = useState(true);
  const [articles, setArticles]         = useState<NewsArticle[]>([]);
  const [headline, setHeadline]         = useState("");
  const [summary, setSummary]           = useState("");
  const [error, setError]               = useState<string | null>(null);
  const [mode, setMode]                 = useState<string>("");
  const [notice, setNotice]             = useState<string>("");

  async function fetchNews(query: string, topic: string) {
    setLoading(true); setError(null); setArticles([]); setHeadline(""); setSummary(""); setNotice("");
    try {
      const resp = await news.ask({ query, topic });
      setArticles(resp.articles || []);
      setHeadline(resp.headline || "");
      setSummary(resp.summary || "");
      setMode(resp.mode || "");
      setNotice(resp.notice || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load news. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const topic = TOPICS.find((t) => t.id === activeTopic);
    if (topic) fetchNews(topic.query, activeTopic);
  }, [activeTopic]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setSearchQuery(q);
    fetchNews(q, "general");
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchInput("");
    const topic = TOPICS.find((t) => t.id === activeTopic);
    if (topic) fetchNews(topic.query, activeTopic);
  }

  const featured  = articles[0] || null;
  const rest      = articles.slice(1);

  return (
    <Shell>
      <PageHeader
        eyebrow="Live Intelligence"
        icon={Newspaper}
        title="World News"
        subtitle="Real-time news powered by AI — stories, summaries, and insights from around the globe."
      />

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search any topic — markets, space, politics, sports…"
            className="w-full glass rounded-2xl pl-9 pr-4 py-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <NeonButton type="submit" disabled={loading || !searchInput.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          <span className="hidden sm:inline ml-1">Search</span>
        </NeonButton>
        {searchQuery && (
          <button
            type="button"
            onClick={clearSearch}
            className="glass rounded-2xl px-4 py-2.5 text-sm hover:bg-white/10 transition"
          >
            Clear
          </button>
        )}
      </form>

      {/* Topic filters */}
      {!searchQuery && (
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          {TOPICS.map((t) => {
            const Icon = t.icon;
            const active = activeTopic === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTopic(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-medium transition whitespace-nowrap flex-shrink-0 ${
                  active
                    ? "bg-aurora text-primary-foreground shadow-neon"
                    : "glass text-muted-foreground hover:text-foreground hover:bg-white/10"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Active search label */}
      {searchQuery && (
        <div className="flex items-center gap-2 mb-4 text-sm">
          <Zap className="h-4 w-4 text-primary" />
          <span>Results for: <strong>"{searchQuery}"</strong></span>
        </div>
      )}

      {/* Mode badge */}
      {mode === "fallback" && notice && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground glass rounded-2xl p-3 mb-4">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-yellow-400" />
          {notice}
        </div>
      )}

      {/* Headline + Summary */}
      {(headline || summary) && !loading && (
        <GlowCard glow="blue" className="mb-6">
          {headline && <h2 className="font-display font-bold text-xl mb-2">{headline}</h2>}
          {summary  && <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>}
          <div className="flex items-center gap-2 mt-3">
            <div className={`h-1.5 w-1.5 rounded-full ${mode === "web_search" ? "bg-green-400" : "bg-yellow-400"} animate-pulse`} />
            <span className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
              {mode === "web_search" ? "Live search" : "AI knowledge"}
            </span>
            <button
              onClick={() => {
                const topic = TOPICS.find((t) => t.id === activeTopic);
                if (searchQuery) fetchNews(searchQuery, "general");
                else if (topic) fetchNews(topic.query, activeTopic);
              }}
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground glass rounded-xl px-2.5 py-1 transition"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>
        </GlowCard>
      )}

      {/* Error */}
      {error && (
        <GlowCard glow="pink" className="flex items-start gap-3 mb-6">
          <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium text-sm mb-1">Couldn't load news</div>
            <div className="text-xs text-muted-foreground">{error}</div>
            <button
              onClick={() => {
                const topic = TOPICS.find((t) => t.id === activeTopic);
                if (searchQuery) fetchNews(searchQuery, "general");
                else if (topic) fetchNews(topic.query, activeTopic);
              }}
              className="mt-2 flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <RefreshCw className="h-3 w-3" /> Try again
            </button>
          </div>
        </GlowCard>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-4">
          <SkeletonCard featured />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      )}

      {/* Articles grid */}
      {!loading && articles.length > 0 && (
        <div className="space-y-4">
          {/* Featured article */}
          {featured && <ArticleCard article={featured} featured />}

          {/* Grid */}
          {rest.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rest.map((a, i) => (
                <ArticleCard key={i} article={a} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && articles.length === 0 && (
        <GlowCard glow="blue" className="text-center py-20">
          <Newspaper className="h-12 w-12 text-primary/30 mx-auto mb-4" />
          <h3 className="font-display font-bold text-lg mb-2">No stories yet</h3>
          <p className="text-muted-foreground text-sm mb-4">
            Select a topic above or search for any subject to load the latest news.
          </p>
          <NeonButton onClick={() => {
            const topic = TOPICS.find((t) => t.id === "headlines");
            if (topic) fetchNews(topic.query, "headlines");
          }}>
            <Newspaper className="h-4 w-4 mr-2" /> Load top headlines
          </NeonButton>
        </GlowCard>
      )}
    </Shell>
  );
}
