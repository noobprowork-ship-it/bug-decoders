import { useMemo, useRef, useState, useEffect } from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

export type MindMapNode = {
  label: string;
  color?: string;
  children?: MindMapNode[];
};

export type MindMapData = {
  center: string;
  branches: MindMapNode[];
};

const COLORS: Record<string, string> = {
  blue: "oklch(0.78 0.18 230)",
  pink: "oklch(0.7 0.22 320)",
  purple: "oklch(0.7 0.22 295)",
  green: "oklch(0.75 0.18 150)",
  amber: "oklch(0.78 0.16 65)",
  red: "oklch(0.7 0.22 25)",
  cyan: "oklch(0.78 0.16 200)",
};

function colorFor(name?: string, idx = 0) {
  const fallback = ["blue", "pink", "purple", "green", "amber", "cyan"][idx % 6];
  return COLORS[(name || fallback).toLowerCase()] || COLORS[fallback];
}

const VIEW_W = 1000;
const VIEW_H = 700;

/**
 * SVG radial mind map. Lays out branches around a circle, then fans
 * each branch's children outward. Fully responsive via viewBox plus
 * pinch/scroll zoom + drag to pan, with fit-to-screen and zoom buttons.
 */
export function MindMap({ data }: { data: MindMapData | null | undefined }) {
  const nodes = useMemo(() => layout(data), [data]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  // Reset view whenever the data changes
  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [data]);

  function adjustZoom(delta: number) {
    setZoom((z) => Math.max(0.5, Math.min(4, +(z + delta).toFixed(2))));
  }

  function fit() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  // Ctrl+wheel to zoom (browser default unzooms otherwise)
  function onWheel(e: React.WheelEvent<HTMLDivElement>) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    adjustZoom(e.deltaY > 0 ? -0.15 : 0.15);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (zoom <= 1.01) return; // pan only when zoomed in
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    setDragging(true);
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy });
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.currentTarget as Element).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    }
    setDragging(false);
  }

  if (!data || !data.branches?.length) return null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-end gap-1.5 mb-2">
        <button
          onClick={() => adjustZoom(-0.2)}
          className="h-8 w-8 rounded-xl glass flex items-center justify-center hover:bg-white/10 transition"
          aria-label="Zoom out"
          title="Zoom out"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <div className="text-[10px] text-muted-foreground tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</div>
        <button
          onClick={() => adjustZoom(0.2)}
          className="h-8 w-8 rounded-xl glass flex items-center justify-center hover:bg-white/10 transition"
          aria-label="Zoom in"
          title="Zoom in"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={fit}
          className="h-8 w-8 rounded-xl glass flex items-center justify-center hover:bg-white/10 transition"
          aria-label="Fit to screen"
          title="Fit to screen"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div
        ref={containerRef}
        className="w-full overflow-hidden rounded-2xl border border-white/5 select-none"
        style={{
          touchAction: zoom > 1.01 ? "none" : "auto",
          cursor: zoom > 1.01 ? (dragging ? "grabbing" : "grab") : "default",
        }}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transformOrigin: "50% 50%",
            transition: dragging ? "none" : "transform 0.15s ease",
            width: "100%",
          }}
        >
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className="w-full h-auto block"
            preserveAspectRatio="xMidYMid meet"
            style={{ minHeight: 280, maxHeight: "70vh" }}
            role="img"
            aria-label={`Mind map for ${data.center}`}
          >
            <defs>
              <radialGradient id="mm-center" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="oklch(0.78 0.18 230)" stopOpacity="0.6" />
                <stop offset="100%" stopColor="oklch(0.78 0.18 230)" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Lines: center → branch */}
            {nodes.branchLines.map((l, i) => (
              <path key={`bl-${i}`} d={l.d} stroke={l.color} strokeOpacity="0.55" strokeWidth="1.5" fill="none" />
            ))}
            {/* Lines: branch → child */}
            {nodes.childLines.map((l, i) => (
              <path key={`cl-${i}`} d={l.d} stroke={l.color} strokeOpacity="0.35" strokeWidth="1" fill="none" />
            ))}

            <circle cx="500" cy="350" r="120" fill="url(#mm-center)" />
            <g>
              <circle cx="500" cy="350" r="58" fill="oklch(0.18 0.04 260)" stroke="oklch(0.78 0.18 230)" strokeWidth="2" />
              <foreignObject x="442" y="318" width="116" height="64">
                <div
                  style={{
                    color: "white",
                    fontFamily: "Space Grotesk, sans-serif",
                    fontSize: 13,
                    fontWeight: 700,
                    textAlign: "center",
                    lineHeight: 1.15,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    padding: "0 6px",
                  }}
                >
                  {data.center}
                </div>
              </foreignObject>
            </g>

            {nodes.branches.map((b, i) => (
              <g key={`b-${i}`}>
                <rect x={b.x - 70} y={b.y - 18} width={140} height={36} rx={18} fill="oklch(0.16 0.03 260)" stroke={b.color} strokeWidth="1.5" />
                <foreignObject x={b.x - 66} y={b.y - 14} width={132} height={28}>
                  <div
                    style={{
                      color: "white",
                      fontFamily: "Inter, sans-serif",
                      fontSize: 11,
                      fontWeight: 600,
                      textAlign: "center",
                      lineHeight: 1.2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      padding: "0 6px",
                    }}
                    title={b.label}
                  >
                    {b.label}
                  </div>
                </foreignObject>
              </g>
            ))}

            {nodes.children.map((c, i) => (
              <g key={`c-${i}`}>
                <rect x={c.x - 60} y={c.y - 14} width={120} height={28} rx={14} fill="oklch(0.13 0.02 260 / 0.9)" stroke={c.color} strokeOpacity="0.7" strokeWidth="1" />
                <foreignObject x={c.x - 56} y={c.y - 11} width={112} height={22}>
                  <div
                    style={{
                      color: "oklch(0.85 0.02 260)",
                      fontFamily: "Inter, sans-serif",
                      fontSize: 10,
                      fontWeight: 500,
                      textAlign: "center",
                      lineHeight: 1.2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      padding: "0 4px",
                    }}
                    title={c.label}
                  >
                    {c.label}
                  </div>
                </foreignObject>
              </g>
            ))}
          </svg>
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground mt-1.5 text-right">
        Tip: ⌘/Ctrl + scroll to zoom · drag to pan when zoomed in
      </div>
    </div>
  );
}

type Pt = { x: number; y: number; label: string; color: string };
type Line = { d: string; color: string };

function layout(data: MindMapData | null | undefined) {
  if (!data || !data.branches?.length) {
    return { branches: [], children: [], branchLines: [], childLines: [] };
  }
  const cx = 500;
  const cy = 350;
  const branchRadius = 230;
  const childRadius = 130;

  const branches: Pt[] = [];
  const children: Pt[] = [];
  const branchLines: Line[] = [];
  const childLines: Line[] = [];

  const N = Math.min(data.branches.length, 8);
  data.branches.slice(0, N).forEach((b, i) => {
    const angle = (-Math.PI / 2) + (i * (2 * Math.PI)) / N;
    const bx = cx + Math.cos(angle) * branchRadius;
    const by = cy + Math.sin(angle) * branchRadius;
    const color = colorFor(b.color, i);
    branches.push({ x: bx, y: by, label: b.label || "—", color });

    const mx = (cx + bx) / 2 + Math.cos(angle + Math.PI / 2) * 20;
    const my = (cy + by) / 2 + Math.sin(angle + Math.PI / 2) * 20;
    branchLines.push({ d: `M ${cx} ${cy} Q ${mx} ${my} ${bx} ${by}`, color });

    const childList = (b.children || []).slice(0, 4);
    const M = childList.length;
    if (M === 0) return;
    const spread = Math.PI / 3.5;
    childList.forEach((c, j) => {
      const childAngle = M === 1 ? angle : angle - spread / 2 + (j * spread) / (M - 1);
      const cxn = bx + Math.cos(childAngle) * childRadius;
      const cyn = by + Math.sin(childAngle) * childRadius;
      children.push({ x: cxn, y: cyn, label: c.label || "—", color });

      const cmx = (bx + cxn) / 2;
      const cmy = (by + cyn) / 2;
      childLines.push({ d: `M ${bx} ${by} Q ${cmx} ${cmy} ${cxn} ${cyn}`, color });
    });
  });

  return { branches, children, branchLines, childLines };
}
