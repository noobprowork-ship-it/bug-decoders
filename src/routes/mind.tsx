import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader } from "@/components/aurora/ui";
import { Brain } from "lucide-react";

export const Route = createFileRoute("/mind")({
  head: () => ({ meta: [{ title: "Mind Universe — Aurora Mind OS" }] }),
  component: Mind,
});

const clusters = [
  { name: "Curiosity", value: 92, color: "oklch(0.78 0.18 230)" },
  { name: "Empathy", value: 81, color: "oklch(0.7 0.22 320)" },
  { name: "Discipline", value: 74, color: "oklch(0.7 0.22 295)" },
  { name: "Risk-tolerance", value: 68, color: "oklch(0.85 0.15 190)" },
  { name: "Strategy", value: 87, color: "oklch(0.75 0.2 160)" },
];

function Mind() {
  return (
    <Shell>
      <PageHeader eyebrow="Module 06" icon={Brain} title="Mind Universe Explorer" subtitle="Your inner cosmos — personality, skills, and emotional gravity, mapped." />

      <div className="grid lg:grid-cols-3 gap-4">
        <GlowCard className="lg:col-span-2" glow="purple">
          <div className="relative aspect-square max-h-[520px] mx-auto">
            <svg viewBox="0 0 500 500" className="w-full h-full">
              <defs>
                <radialGradient id="core">
                  <stop offset="0%" stopColor="oklch(0.85 0.18 280)" />
                  <stop offset="100%" stopColor="oklch(0.78 0.18 230 / 0)" />
                </radialGradient>
              </defs>
              {/* Orbits */}
              {[80, 140, 200].map((r) => (
                <circle key={r} cx="250" cy="250" r={r} fill="none" stroke="oklch(1 0 0 / 0.06)" />
              ))}
              {/* Core */}
              <circle cx="250" cy="250" r="60" fill="url(#core)" />
              <circle cx="250" cy="250" r="22" fill="oklch(0.78 0.18 230)">
                <animate attributeName="r" values="22;28;22" dur="3s" repeatCount="indefinite" />
              </circle>

              {/* Nodes */}
              {clusters.map((c, i) => {
                const angle = (i / clusters.length) * Math.PI * 2;
                const r = 170;
                const x = 250 + Math.cos(angle) * r;
                const y = 250 + Math.sin(angle) * r;
                const size = 12 + c.value / 6;
                return (
                  <g key={c.name}>
                    <line x1="250" y1="250" x2={x} y2={y} stroke={c.color} strokeOpacity="0.4" strokeWidth="1" />
                    <circle cx={x} cy={y} r={size} fill={c.color} opacity="0.85">
                      <animate attributeName="r" values={`${size};${size+4};${size}`} dur={`${3 + i * 0.4}s`} repeatCount="indefinite" />
                    </circle>
                    <text x={x} y={y + size + 16} textAnchor="middle" fill="oklch(0.97 0.01 250)" fontSize="11" fontFamily="Inter">{c.name}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </GlowCard>

        <GlowCard glow="blue">
          <h3 className="font-display text-lg font-semibold mb-4">Personality Clusters</h3>
          <div className="space-y-4">
            {clusters.map((c) => (
              <div key={c.name}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span>{c.name}</span>
                  <span style={{ color: c.color }}>{c.value}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${c.value}%`, background: c.color, boxShadow: `0 0 12px ${c.color}` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-2xl glass border border-primary/20">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Dominant archetype</div>
            <div className="font-display text-xl font-bold text-gradient mt-1">The Explorer-Architect</div>
            <p className="text-xs text-muted-foreground mt-2">Builds systems by following curiosity. Thrives at the edge of known maps.</p>
          </div>
        </GlowCard>
      </div>
    </Shell>
  );
}
