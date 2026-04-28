import { useEffect, useState } from "react";
import { Settings2, X, Play, Volume2 } from "lucide-react";
import {
  getVoiceTone,
  setVoiceTone,
  listVoices,
  speakPreview,
  isVoiceEnabled,
  setVoiceEnabled,
} from "@/lib/voice";

/**
 * Voice settings — pick a tone (voice + rate + pitch) for Aurora.
 * Defaults lean female + slightly raised pitch for warmth.
 */
export function VoiceSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [voices, setVoicesState] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1.05);
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!open) return;
    const tone = getVoiceTone();
    setVoiceName(tone.voiceName);
    setRate(tone.rate);
    setPitch(tone.pitch);
    setEnabled(isVoiceEnabled());

    function refresh() {
      setVoicesState(listVoices());
    }
    refresh();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.addEventListener("voiceschanged", refresh);
      // Some browsers need a kick
      setTimeout(refresh, 300);
      return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
    }
  }, [open]);

  if (!open) return null;

  function commit(partial: Parameters<typeof setVoiceTone>[0]) {
    setVoiceTone(partial);
  }

  // Sort: female-named first, then English, then the rest
  const sorted = [...voices].sort((a, b) => {
    const af = /female|woman|samantha|aria|jenny|zira|victoria|karen|allison|tessa|moira|ava|serena|susan/i.test(a.name) ? 0 : 1;
    const bf = /female|woman|samantha|aria|jenny|zira|victoria|karen|allison|tessa|moira|ava|serena|susan/i.test(b.name) ? 0 : 1;
    if (af !== bf) return af - bf;
    const ae = a.lang?.toLowerCase().startsWith("en") ? 0 : 1;
    const be = b.lang?.toLowerCase().startsWith("en") ? 0 : 1;
    if (ae !== be) return ae - be;
    return a.name.localeCompare(b.name);
  });

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-3xl w-full max-w-md p-6 shadow-soft animate-rise"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-aurora flex items-center justify-center">
              <Settings2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-display text-lg font-semibold">Voice tone</div>
              <div className="text-[11px] text-muted-foreground">Tune Aurora's voice — saved to this device.</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full glass flex items-center justify-center hover:bg-white/10"
            aria-label="Close voice settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="flex items-center justify-between glass rounded-2xl px-4 py-3 mb-4">
          <span className="text-sm font-medium flex items-center gap-2">
            <Volume2 className="h-4 w-4" /> Speak replies aloud
          </span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setVoiceEnabled(e.target.checked);
            }}
            className="h-4 w-4 accent-primary"
          />
        </label>

        <div className="space-y-4">
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1.5">Voice</div>
            <select
              value={voiceName || ""}
              onChange={(e) => {
                const v = e.target.value || null;
                setVoiceName(v);
                commit({ voiceName: v });
              }}
              className="w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary appearance-none"
            >
              <option value="">Auto (warm female)</option>
              {sorted.map((v) => (
                <option key={`${v.name}-${v.lang}`} value={v.name}>
                  {v.name} — {v.lang}
                </option>
              ))}
            </select>
            {sorted.length === 0 && (
              <div className="text-[11px] text-muted-foreground mt-1.5">
                Voices load after the first speak — tap Preview once and the list will populate.
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">Speed</span>
              <span className="text-xs tabular-nums">{rate.toFixed(2)}×</span>
            </div>
            <input
              type="range"
              min={0.6}
              max={1.6}
              step={0.05}
              value={rate}
              onChange={(e) => {
                const v = Number(e.target.value);
                setRate(v);
                commit({ rate: v });
              }}
              className="w-full accent-primary"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">Pitch</span>
              <span className="text-xs tabular-nums">{pitch.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.6}
              max={1.6}
              step={0.05}
              value={pitch}
              onChange={(e) => {
                const v = Number(e.target.value);
                setPitch(v);
                commit({ pitch: v });
              }}
              className="w-full accent-primary"
            />
          </div>

          <button
            onClick={() => speakPreview("Hi, I'm Aurora. This is how I'll sound when we talk.")}
            className="w-full bg-aurora text-primary-foreground rounded-2xl py-3 text-sm font-medium flex items-center justify-center gap-2 shadow-neon hover:scale-[1.01] transition"
          >
            <Play className="h-4 w-4" />
            Preview voice
          </button>
        </div>
      </div>
    </div>
  );
}
