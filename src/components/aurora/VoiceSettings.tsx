import { useEffect, useState } from "react";
import { Settings2, X, Play, Volume2, Info } from "lucide-react";
import {
  getVoiceTone,
  setVoiceTone,
  listVoices,
  speakPreview,
  isVoiceEnabled,
  setVoiceEnabled,
  pickVoiceName,
  DEFAULT_PITCH,
  type VoiceGender,
} from "@/lib/voice";

const GENDER_OPTIONS: { value: VoiceGender; label: string; emoji: string }[] = [
  { value: "female", label: "Female", emoji: "♀" },
  { value: "male",   label: "Male",   emoji: "♂" },
  { value: "auto",   label: "Auto",   emoji: "⚡" },
];

const MALE_PREVIEW   = "Hello. I'm your LifeOS assistant. How can I help you today?";
const FEMALE_PREVIEW = "Hi, I'm your LifeOS companion. This is how I'll sound when we talk.";

export function VoiceSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [voices, setVoicesState] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const [rate, setRate]           = useState(1);
  const [pitch, setPitch]         = useState(DEFAULT_PITCH.male);
  const [gender, setGender]       = useState<VoiceGender>("male");
  const [enabled, setEnabled]     = useState(true);
  const [autoVoice, setAutoVoice] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const tone = getVoiceTone();
    setVoiceName(tone.voiceName);
    setRate(tone.rate);
    setPitch(tone.pitch);
    setGender(tone.gender);
    setEnabled(isVoiceEnabled());

    function refresh() {
      const v = listVoices();
      setVoicesState(v);
      // Show which voice will be auto-selected
      setAutoVoice(pickVoiceName());
    }
    refresh();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.addEventListener("voiceschanged", refresh);
      setTimeout(refresh, 300);
      return () => window.speechSynthesis.removeEventListener("voiceschanged", refresh);
    }
  }, [open]);

  if (!open) return null;

  function commit(partial: { voiceName?: string | null; rate?: number; pitch?: number; gender?: VoiceGender }) {
    setVoiceTone(partial);
    // Refresh auto-voice display after any change
    setTimeout(() => setAutoVoice(pickVoiceName()), 50);
  }

  function handleGenderChange(g: VoiceGender) {
    const defaultPitch = DEFAULT_PITCH[g];
    setGender(g);
    setPitch(defaultPitch);    // ← FIX: update slider UI to match new gender default
    setVoiceName(null);        // ← clear pinned voice so auto-pick fires
    commit({ gender: g, voiceName: null });
  }

  // Sort voices: preferred gender first, then English, then the rest
  const FEMALE_RE = /female|woman|samantha|aria|jenny|zira|victoria|karen|allison|tessa|moira|ava|serena|susan|emma|claire/i;
  const MALE_RE   = /\b(male|man|daniel|alex|fred|tom|aaron|arthur|david|mark|guy|albert|bruce|junior|ralph|lee|roger|ryan|eric|andrew|brian)\b/i;

  const sorted = [...voices].sort((a, b) => {
    const score = (v: SpeechSynthesisVoice) => {
      const isEn    = v.lang?.toLowerCase().startsWith("en") ? 0 : 100;
      const isLocal = (v.localService === true) ? 0 : 5; // prefer local (reliable)
      if (gender === "male")   return (MALE_RE.test(v.name)   ? 0 : 10) + isEn + isLocal;
      if (gender === "female") return (FEMALE_RE.test(v.name) ? 0 : 10) + isEn + isLocal;
      return isEn + isLocal;
    };
    return score(a) - score(b) || a.name.localeCompare(b.name);
  });

  const previewText = gender === "male" ? MALE_PREVIEW : FEMALE_PREVIEW;

  // Detect if we have a real dedicated male voice
  const hasDedicatedMaleVoice = gender === "male" && autoVoice
    ? MALE_RE.test(autoVoice)
    : true;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-3xl w-full max-w-md p-6 shadow-soft animate-rise overflow-y-auto max-h-[90dvh]"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-aurora flex items-center justify-center">
              <Settings2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="font-display text-lg font-semibold">Voice tone</div>
              <div className="text-[11px] text-muted-foreground">Tune the voice — saved to this device.</div>
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

        {/* Speak toggle */}
        <label className="flex items-center justify-between glass rounded-2xl px-4 py-3 mb-4 cursor-pointer">
          <span className="text-sm font-medium flex items-center gap-2">
            <Volume2 className="h-4 w-4" /> Speak replies aloud
          </span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => { setEnabled(e.target.checked); setVoiceEnabled(e.target.checked); }}
            className="h-4 w-4 accent-primary"
          />
        </label>

        {/* Gender selector */}
        <div className="mb-3">
          <div className="text-xs font-medium text-muted-foreground mb-1.5">Voice gender</div>
          <div className="grid grid-cols-3 gap-2">
            {GENDER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleGenderChange(opt.value)}
                className={`py-2.5 rounded-2xl text-sm font-medium transition-all ${
                  gender === opt.value
                    ? "bg-aurora text-primary-foreground shadow-neon"
                    : "glass text-muted-foreground hover:text-foreground hover:bg-white/10"
                }`}
              >
                <span className="mr-1">{opt.emoji}</span>{opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Auto-voice hint */}
        {autoVoice && !voiceName && (
          <div className={`text-[11px] flex items-start gap-1.5 rounded-xl px-3 py-2 mb-3 ${
            !hasDedicatedMaleVoice && gender === "male"
              ? "text-[oklch(0.75_0.18_55)] bg-[oklch(0.75_0.18_55)/0.08]"
              : "text-muted-foreground glass"
          }`}>
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            <span>
              {!hasDedicatedMaleVoice && gender === "male"
                ? `No dedicated male voice found — using "${autoVoice}" with low pitch. For a real male voice, pick one from the list below.`
                : `Auto-selected: "${autoVoice}"`
              }
            </span>
          </div>
        )}

        <div className="space-y-4">
          {/* Voice picker */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1.5">Specific voice (optional)</div>
            <select
              value={voiceName || ""}
              onChange={(e) => {
                const v = e.target.value || null;
                setVoiceName(v);
                commit({ voiceName: v });
              }}
              className="w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary appearance-none"
            >
              <option value="">Auto ({gender} preference)</option>
              {sorted.map((v) => (
                <option key={`${v.name}-${v.lang}`} value={v.name}>
                  {v.name} [{v.lang}]{v.localService ? " ✓" : ""}
                </option>
              ))}
            </select>
            {sorted.length === 0 && (
              <div className="text-[11px] text-muted-foreground mt-1.5">
                Click "Preview voice" once to load the voice list.
              </div>
            )}
            <div className="text-[10px] text-muted-foreground mt-1">
              ✓ = local voice (reliable). Remote voices need internet.
            </div>
          </div>

          {/* Speed */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">Speed</span>
              <span className="text-xs tabular-nums">{rate.toFixed(2)}×</span>
            </div>
            <input
              type="range" min={0.6} max={1.6} step={0.05} value={rate}
              onChange={(e) => { const v = Number(e.target.value); setRate(v); commit({ rate: v }); }}
              className="w-full accent-primary"
            />
          </div>

          {/* Pitch */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Pitch
                {gender === "male" && pitch > 1.0 && (
                  <span className="ml-1.5 text-[oklch(0.75_0.18_55)]">(high for male — try ≤ 0.8)</span>
                )}
              </span>
              <span className="text-xs tabular-nums">{pitch.toFixed(2)}</span>
            </div>
            <input
              type="range" min={0.5} max={1.6} step={0.05} value={pitch}
              onChange={(e) => { const v = Number(e.target.value); setPitch(v); commit({ pitch: v }); }}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>← Deeper / male</span>
              <span>Higher / female →</span>
            </div>
          </div>

          <button
            onClick={() => speakPreview(previewText)}
            className="w-full bg-aurora text-primary-foreground rounded-2xl py-3 text-sm font-medium flex items-center justify-center gap-2 shadow-neon hover:scale-[1.01] transition"
          >
            <Play className="h-4 w-4" />
            Preview {gender === "male" ? "male" : gender === "female" ? "female" : ""} voice
          </button>
        </div>
      </div>
    </div>
  );
}
