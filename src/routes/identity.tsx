import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, StatChip } from "@/components/aurora/ui";
import { Activity, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/identity")({
  head: () => ({ meta: [{ title: "Identity Tracker — Aurora Mind OS" }] }),
  component: Identity,
});

const skills = [
  { name: "Systems Design", value: 84 },
  { name: "Communication", value: 71 },
  { name: "Strategic Vision", value: 78 },
  { name: "Execution Velocity", value: 88 },
];

function Ring({ value, label }: { value: number; label: string }) {
  const c = 2 * Math.PI * 56;
  const dash = (value / 100) * c;
  return (
    <div className="flex flex-col items-center">
      <div className="relative h-36 w-36">
        <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
          <circle cx="70" cy="70" r="56" fill="none" stroke="oklch(1 0 0 / 0.06)" strokeWidth="10" />
          <circle cx="70" cy="70" r="56" fill="none" stroke="url(#ring)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${dash} ${c}`} style={{ filter: "drop-shadow(0 0 8px oklch(0.78 0.18 230 / 0.7))" }} />
          <defs>
            <linearGradient id="ring" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.78 0.18 230)" />
              <stop offset="100%" stopColor="oklch(0.7 0.22 320)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-display text-3xl font-bold text-gradient">{value}</div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">pts</div>
        </div>
      </div>
      <div className="text-sm mt-3 text-center">{label}</div>
    </div>
  );
}

function Identity() {
  return (
    <Shell>
      <PageHeader eyebrow="Module 07" icon={Activity} title="Identity Tracker" subtitle="Watch yourself become. Skill, behavior, and growth — measured weekly." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatChip label="Streak" value="42d" />
        <StatChip label="Growth" value="+18%" accent="purple" />
        <StatChip label="Habits" value="11/14" accent="pink" />
        <StatChip label="Level" value="07" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <GlowCard glow="blue">
          <h3 className="font-display text-lg font-semibold mb-6">Core Skills</h3>
          <div className="grid grid-cols-2 gap-6">
            {skills.map((s) => <Ring key={s.name} value={s.value} label={s.name} />)}
          </div>
        </GlowCard>

        <GlowCard glow="pink">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display text-lg font-semibold">Weekly Growth</h3>
            <span className="text-xs flex items-center gap-1 text-primary"><TrendingUp className="h-3 w-3" /> +12.4%</span>
          </div>
          <div className="h-56">
            <svg viewBox="0 0 400 200" className="w-full h-full">
              <defs>
                <linearGradient id="bar" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.7 0.22 320)" />
                  <stop offset="100%" stopColor="oklch(0.78 0.18 230)" />
                </linearGradient>
              </defs>
              {[60, 75, 55, 90, 70, 110, 130].map((h, i) => (
                <g key={i}>
                  <rect x={20 + i * 52} y={180 - h} width="34" height={h} rx="8" fill="url(#bar)" opacity="0.9">
                    <animate attributeName="height" from="0" to={h} dur="0.8s" />
                    <animate attributeName="y" from="180" to={180 - h} dur="0.8s" />
                  </rect>
                  <text x={37 + i * 52} y={196} textAnchor="middle" fontSize="10" fill="oklch(0.7 0.04 260)">{["M","T","W","T","F","S","S"][i]}</text>
                </g>
              ))}
            </svg>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[{l:"Focus",v:"4.2h"},{l:"Deep work",v:"86%"},{l:"Energy",v:"High"}].map((m)=>(
              <div key={m.l} className="glass rounded-xl p-3 text-center">
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{m.l}</div>
                <div className="font-display font-semibold mt-0.5">{m.v}</div>
              </div>
            ))}
          </div>
        </GlowCard>
      </div>
    </Shell>
  );
}
