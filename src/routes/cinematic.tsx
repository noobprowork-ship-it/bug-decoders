import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, NeonButton } from "@/components/aurora/ui";
import { Clapperboard, Play, Film } from "lucide-react";

export const Route = createFileRoute("/cinematic")({
  head: () => ({ meta: [{ title: "Cinematic Director — Aurora Mind OS" }] }),
  component: Cinematic,
});

const scenes = [
  { act: "Act I", title: "The Origin", desc: "Late nights, first lines of code, the spark.", hue: "from-[oklch(0.78_0.18_230)] to-[oklch(0.7_0.22_295)]" },
  { act: "Act II", title: "The Trial", desc: "Founding the company. Three near-deaths and a breakthrough.", hue: "from-[oklch(0.7_0.22_295)] to-[oklch(0.7_0.22_320)]" },
  { act: "Act III", title: "The Ascent", desc: "Global launch. Stadium keynote. The world watches.", hue: "from-[oklch(0.7_0.22_320)] to-[oklch(0.78_0.18_230)]" },
  { act: "Epilogue", title: "The Legacy", desc: "Mentoring the next million. A name written into the future.", hue: "from-[oklch(0.78_0.18_230)] to-[oklch(0.7_0.22_320)]" },
];

function Cinematic() {
  return (
    <Shell>
      <PageHeader eyebrow="Module 05" icon={Clapperboard} title="Life Cinematic Director" subtitle="Your future, rendered as a film. Each act is a real possibility." />

      {/* Hero scene */}
      <GlowCard glow="pink" className="mb-6">
        <div className="aspect-[21/9] rounded-2xl relative overflow-hidden bg-gradient-to-br from-[oklch(0.15_0.05_270)] to-[oklch(0.1_0.04_300)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,oklch(0.78_0.18_230/0.3),transparent_60%),radial-gradient(circle_at_70%_50%,oklch(0.7_0.22_320/0.3),transparent_60%)]" />
          {/* Silhouette */}
          <svg viewBox="0 0 800 340" className="absolute inset-0 w-full h-full opacity-90">
            <path d="M0,340 L0,260 Q200,220 400,240 T800,200 L800,340 Z" fill="oklch(0.05 0.02 270)" />
            <circle cx="640" cy="100" r="60" fill="oklch(0.7 0.22 320 / 0.6)" />
            <circle cx="640" cy="100" r="40" fill="oklch(0.85 0.18 280 / 0.8)" />
          </svg>
          <div className="absolute inset-0 flex items-end p-8">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-2">Now showing</div>
              <h2 className="font-display text-3xl md:text-5xl font-bold">"The Years You Choose"</h2>
              <p className="text-sm text-muted-foreground mt-2 max-w-md">A 4-act preview of your highest-resonance future.</p>
              <NeonButton className="mt-4"><Play className="inline h-4 w-4 mr-2" />Play Trailer</NeonButton>
            </div>
          </div>
        </div>
      </GlowCard>

      {/* Storyboard */}
      <h3 className="font-display text-xl font-semibold mb-4 flex items-center gap-2"><Film className="h-5 w-5 text-primary" /> Storyboard</h3>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {scenes.map((s, i) => (
          <div key={s.title} className="group animate-rise" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className={`aspect-video rounded-2xl mb-3 relative overflow-hidden bg-gradient-to-br ${s.hue} group-hover:scale-[1.02] transition-transform`}>
              <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.6),transparent_50%)]" />
              <div className="absolute top-3 left-3 text-[10px] uppercase tracking-[0.25em] text-white/80 px-2 py-1 rounded-full bg-black/40 backdrop-blur">{s.act}</div>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                  <Play className="h-5 w-5 text-white" />
                </div>
              </div>
            </div>
            <h4 className="font-display font-semibold">{s.title}</h4>
            <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}
