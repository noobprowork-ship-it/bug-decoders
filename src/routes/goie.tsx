import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, StatChip } from "@/components/aurora/ui";
import { Globe2, TrendingUp, Briefcase, Zap } from "lucide-react";

export const Route = createFileRoute("/goie")({
  head: () => ({ meta: [{ title: "GOIE — Global Opportunity Intelligence" }] }),
  component: GOIE,
});

const opportunities = [
  { title: "AI Safety Engineer", growth: "+312%", region: "Global", match: 94 },
  { title: "Climate Systems Architect", growth: "+186%", region: "EU · IN", match: 88 },
  { title: "Bio-Compute Researcher", growth: "+241%", region: "US · SG", match: 82 },
  { title: "Synthetic Media Director", growth: "+155%", region: "Global", match: 76 },
];

function GOIE() {
  return (
    <Shell>
      <PageHeader eyebrow="Module 03" icon={Globe2} title="Global Opportunity Intelligence" subtitle="Live signal from world economies, industries, and emerging job graphs — personalized to your trajectory." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatChip label="Signals" value="2,419" />
        <StatChip label="Industries" value="38" accent="purple" />
        <StatChip label="Matches" value="14" accent="pink" />
        <StatChip label="Velocity" value="↑ 27%" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* World viz */}
        <GlowCard className="lg:col-span-2" glow="blue">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold">World Opportunity Map</h3>
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-1 rounded-full bg-primary/20 text-primary">Live</span>
            </div>
          </div>
          <div className="relative aspect-[2/1] rounded-2xl overflow-hidden bg-background/50 border border-border">
            <svg viewBox="0 0 800 400" className="w-full h-full">
              <defs>
                <radialGradient id="dot">
                  <stop offset="0%" stopColor="oklch(0.78 0.18 230)" />
                  <stop offset="100%" stopColor="oklch(0.78 0.18 230 / 0)" />
                </radialGradient>
              </defs>
              {/* Grid */}
              {Array.from({ length: 16 }).map((_, i) => (
                <line key={`h${i}`} x1="0" y1={i * 25} x2="800" y2={i * 25} stroke="oklch(1 0 0 / 0.04)" />
              ))}
              {Array.from({ length: 32 }).map((_, i) => (
                <line key={`v${i}`} x1={i * 25} y1="0" x2={i * 25} y2="400" stroke="oklch(1 0 0 / 0.04)" />
              ))}
              {/* Stylized continents (simple blobs) */}
              {[
                [120, 130, 80], [250, 110, 50], [380, 140, 70], [520, 120, 60], [630, 180, 75], [180, 270, 55], [430, 260, 65], [600, 280, 50],
              ].map(([x,y,r],i)=>(
                <ellipse key={i} cx={x} cy={y} rx={r as number} ry={(r as number)*0.55} fill="oklch(0.2 0.04 270 / 0.6)" stroke="oklch(0.78 0.18 230 / 0.3)" />
              ))}
              {/* Data points */}
              {[[180,140,30],[260,120,18],[400,150,24],[540,130,20],[640,200,28],[460,260,22],[200,270,16]].map(([x,y,s],i)=>(
                <g key={i}>
                  <circle cx={x} cy={y} r={s} fill="url(#dot)" opacity="0.8">
                    <animate attributeName="r" values={`${s};${(s as number)+8};${s}`} dur="3s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={x} cy={y} r="3" fill="oklch(0.7 0.22 320)" />
                </g>
              ))}
              {/* Connections */}
              <path d="M180,140 Q300,60 540,130" stroke="oklch(0.7 0.22 295 / 0.6)" strokeWidth="1.5" fill="none" strokeDasharray="4 4" />
              <path d="M540,130 Q580,200 640,200" stroke="oklch(0.7 0.22 320 / 0.6)" strokeWidth="1.5" fill="none" strokeDasharray="4 4" />
            </svg>
          </div>
        </GlowCard>

        {/* Top sectors */}
        <GlowCard glow="purple">
          <h3 className="font-display text-lg font-semibold mb-4">Surging Sectors</h3>
          <div className="space-y-3">
            {[{ n: "AI Infrastructure", p: 94 }, { n: "Climate Tech", p: 78 }, { n: "Biotech", p: 71 }, { n: "Space Logistics", p: 62 }, { n: "Synthetic Media", p: 55 }].map((s) => (
              <div key={s.n}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{s.n}</span>
                  <span className="text-primary">{s.p}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full bg-aurora" style={{ width: `${s.p}%` }} />
                </div>
              </div>
            ))}
          </div>
        </GlowCard>
      </div>

      {/* Opportunities */}
      <div className="mt-6">
        <h3 className="font-display text-xl font-semibold mb-4 flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> Personalized Career Matches</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {opportunities.map((o, i) => (
            <GlowCard key={o.title} glow={i % 2 ? "pink" : "blue"} className="animate-rise" >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{o.region}</div>
                  <h4 className="font-display text-lg font-semibold mt-1">{o.title}</h4>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-xs text-primary"><TrendingUp className="h-3 w-3" /> {o.growth}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-white/5">
                  <div className="h-full bg-aurora rounded-full" style={{ width: `${o.match}%` }} />
                </div>
                <span className="text-xs text-muted-foreground">{o.match}% match</span>
              </div>
            </GlowCard>
          ))}
        </div>
      </div>
    </Shell>
  );
}
