/**
 * Voice synthesis — speaks assistant replies aloud using the browser's
 * built-in SpeechSynthesis API.
 *
 * Supports user-selectable tone (voice, rate, pitch, gender) persisted in
 * localStorage. Defaults to a warm female voice when available, with a
 * slightly raised pitch for a friendly, JARVIS-like presence.
 * Gender can be set to "female" | "male" | "auto".
 */

const KEY_ENABLED = "lifeos.voice.enabled";
const KEY_VOICE   = "lifeos.voice.name";
const KEY_RATE    = "lifeos.voice.rate";
const KEY_PITCH   = "lifeos.voice.pitch";
const KEY_GENDER  = "lifeos.voice.gender";

export type VoiceGender = "female" | "male" | "auto";

export type VoiceTone = {
  voiceName: string | null;
  rate: number;
  pitch: number;
  gender: VoiceGender;
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
  if (typeof window === "undefined") return { voiceName: null, rate: 1, pitch: 1.05, gender: "female" };
  const gender = (window.localStorage.getItem(KEY_GENDER) as VoiceGender) || "female";
  return {
    voiceName: window.localStorage.getItem(KEY_VOICE),
    rate: clamp(Number(window.localStorage.getItem(KEY_RATE)) || 1, 0.5, 2),
    pitch: clamp(Number(window.localStorage.getItem(KEY_PITCH)) || (gender === "male" ? 0.85 : 1.05), 0.5, 2),
    gender,
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
  if (tone.gender !== undefined) {
    window.localStorage.setItem(KEY_GENDER, tone.gender);
    cachedVoice = null;
  }
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

const FEMALE_NAMES = [
  "Samantha", "Victoria", "Karen", "Tessa", "Moira", "Allison",
  "Google UK English Female", "Google US English",
  "Microsoft Aria", "Microsoft Jenny", "Microsoft Zira",
  "Ava", "Serena", "Susan",
];

const MALE_NAMES = [
  "Daniel", "Alex", "Fred", "Tom", "Aaron", "Arthur",
  "Google UK English Male",
  "Microsoft David", "Microsoft Mark", "Microsoft Guy",
  "Albert", "Bruce", "Junior", "Ralph",
];

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const tone = getVoiceTone();

  // If user pinned a specific voice, honour it
  if (tone.voiceName) {
    const match = voices.find((v) => v.name === tone.voiceName);
    if (match) return match;
  }

  const en = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const pool = en.length ? en : voices;

  if (tone.gender === "male") {
    for (const name of MALE_NAMES) {
      const v = pool.find((vv) => vv.name === name);
      if (v) return v;
    }
    const male = pool.find((v) => /\bmale\b|man\b/i.test(v.name));
    if (male) return male;
    // fallback: first English voice (probably male on most OS)
    return pool[0] || null;
  }

  // female or auto → prefer female
  for (const name of FEMALE_NAMES) {
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
    if (!cachedVoice) cachedVoice = pickVoice();
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
    cachedVoice = pickVoice();
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
