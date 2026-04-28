import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlowCard({ children, className, glow = "blue" }: { children: ReactNode; className?: string; glow?: "blue" | "pink" | "purple" }) {
  const glowMap = {
    blue: "before:bg-[radial-gradient(circle_at_30%_0%,oklch(0.78_0.18_230/0.35),transparent_60%)]",
    pink: "before:bg-[radial-gradient(circle_at_70%_0%,oklch(0.7_0.22_320/0.35),transparent_60%)]",
    purple: "before:bg-[radial-gradient(circle_at_50%_100%,oklch(0.7_0.22_295/0.4),transparent_60%)]",
  };
  return (
    <div className={cn("glass rounded-3xl p-6 relative overflow-hidden before:absolute before:inset-0 before:pointer-events-none", glowMap[glow], className)}>
      <div className="relative">{children}</div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, icon: Icon }: { eyebrow?: string; title: string; subtitle?: string; icon?: any }) {
  return (
    <div className="mb-8 animate-rise">
      {eyebrow && (
        <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full glass text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
          {Icon && <Icon className="h-3 w-3 text-primary" />}
          {eyebrow}
        </div>
      )}
      <h1 className="text-3xl md:text-5xl font-bold text-gradient mb-2">{title}</h1>
      {subtitle && <p className="text-muted-foreground max-w-2xl">{subtitle}</p>}
    </div>
  );
}

export function NeonButton({ children, variant = "primary", className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" }) {
  const styles = variant === "primary"
    ? "bg-aurora text-primary-foreground shadow-neon hover:scale-[1.02]"
    : "glass text-foreground hover:bg-white/10";
  return (
    <button className={cn("px-5 py-2.5 rounded-2xl font-medium text-sm transition-all active:scale-95", styles, className)} {...props}>
      {children}
    </button>
  );
}

export function StatChip({ label, value, accent }: { label: string; value: string; accent?: "pink" | "purple" | "blue" }) {
  const color = accent === "pink" ? "text-[oklch(0.7_0.22_320)]" : accent === "purple" ? "text-[oklch(0.7_0.22_295)]" : "text-primary";
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-bold font-display mt-1", color)}>{value}</div>
    </div>
  );
}
