/**
 * Voice synthesis — speaks assistant replies aloud using the browser's
 * built-in SpeechSynthesis API.
 *
 * Now supports user-selectable tone (voice, rate, pitch) persisted in
 * localStorage. Defaults to a warm female voice when available, with a
 * slightly raised pitch for a friendly, JARVIS-like presence.
 */

const KEY_ENABLED = "lifeos.voice.enabled";
const KEY_VOICE = "lifeos.voice.name";
const KEY_RATE = "lifeos.voice.rate";
const KEY_PITCH = "lifeos.voice.pitch";

export type VoiceTone = {
  voiceName: string | null;
  rate: number;
  pitch: number;
};

export function isVoiceEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY_ENABLED) !== "0";
}

export function setVoiceEnabled(on: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_ENABLED, on ? "1" : "0");
}

export function getVoiceTone(): VoiceTone {
  if (typeof window === "undefined") return { voiceName: null, rate: 1, pitch: 1.05 };
  return {
    voiceName: window.localStorage.getItem(KEY_VOICE),
    rate: clamp(Number(window.localStorage.getItem(KEY_RATE)) || 1, 0.5, 2),
    pitch: clamp(Number(window.localStorage.getItem(KEY_PITCH)) || 1.05, 0.5, 2),
  };
}

export function setVoiceTone(tone: Partial<VoiceTone>) {
  if (typeof window === "undefined") return;
  if (tone.voiceName !== undefined) {
    if (tone.voiceName) window.localStorage.setItem(KEY_VOICE, tone.voiceName);
    else window.localStorage.removeItem(KEY_VOICE);
    cachedVoice = null;
  }
  if (tone.rate !== undefined) window.localStorage.setItem(KEY_RATE, String(clamp(tone.rate, 0.5, 2)));
  if (tone.pitch !== undefined) window.localStorage.setItem(KEY_PITCH, String(clamp(tone.pitch, 0.5, 2)));
  window.dispatchEvent(new CustomEvent("lifeos:voice-tone"));
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

let cachedVoice: SpeechSynthesisVoice | null = null;
let voicesLoadedOnce = false;

export function listVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices();
}

function pickFemaleVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const tone = getVoiceTone();
  if (tone.voiceName) {
    const match = voices.find((v) => v.name === tone.voiceName);
    if (match) return match;
  }

  const preferredNames = [
    "Samantha", "Victoria", "Karen", "Tessa", "Moira", "Allison",
    "Google UK English Female", "Google US English",
    "Microsoft Aria", "Microsoft Jenny", "Microsoft Zira",
    "Ava", "Serena", "Susan",
  ];

  const en = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const pool = en.length ? en : voices;

  for (const name of preferredNames) {
    const v = pool.find((vv) => vv.name === name);
    if (v) return v;
  }
  const female = pool.find((v) => /female|woman/i.test(v.name));
  if (female) return female;
  return pool[0] || null;
}

function ensureVoicesReady(cb: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    voicesLoadedOnce = true;
    cb();
    return;
  }
  const onChange = () => {
    voicesLoadedOnce = true;
    window.speechSynthesis.removeEventListener("voiceschanged", onChange);
    cb();
  };
  window.speechSynthesis.addEventListener("voiceschanged", onChange);
  setTimeout(() => {
    if (!voicesLoadedOnce) cb();
  }, 500);
}

export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (!isVoiceEnabled()) return;
  const cleaned = text.replace(/[*_`#>~]/g, "").replace(/\(https?:\/\/[^)]+\)/g, "").trim();
  if (!cleaned) return;
  ensureVoicesReady(() => {
    if (!cachedVoice) cachedVoice = pickFemaleVoice();
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(cleaned);
    if (cachedVoice) utter.voice = cachedVoice;
    const tone = getVoiceTone();
    utter.rate = tone.rate;
    utter.pitch = tone.pitch;
    utter.volume = 1;
    window.speechSynthesis.speak(utter);
  });
}

export function speakPreview(text: string) {
  // Speak even if disabled (used by the settings preview button).
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  ensureVoicesReady(() => {
    cachedVoice = pickFemaleVoice();
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    if (cachedVoice) utter.voice = cachedVoice;
    const tone = getVoiceTone();
    utter.rate = tone.rate;
    utter.pitch = tone.pitch;
    utter.volume = 1;
    window.speechSynthesis.speak(utter);
  });
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}
