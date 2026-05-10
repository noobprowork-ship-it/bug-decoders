/**
 * Voice synthesis — speaks assistant replies aloud using the browser's
 * built-in SpeechSynthesis API.
 *
 * Supports user-selectable tone (voice, rate, pitch, gender) persisted in
 * localStorage. Defaults to a warm female voice when available.
 * Gender can be set to "female" | "male" | "auto".
 *
 * Male voice fix: when gender changes, pitch is reset to the appropriate
 * gender default so the voice actually sounds male/female. Also works
 * around Chrome's cancel()+speak() race condition with a 50ms delay.
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

const DEFAULT_PITCH: Record<VoiceGender, number> = {
  female: 1.1,
  male:   0.8,
  auto:   1.0,
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
  if (typeof window === "undefined") return { voiceName: null, rate: 1, pitch: 1.1, gender: "female" };
  const gender = (window.localStorage.getItem(KEY_GENDER) as VoiceGender) || "female";
  const storedPitch = window.localStorage.getItem(KEY_PITCH);
  return {
    voiceName: window.localStorage.getItem(KEY_VOICE),
    rate:  clamp(Number(window.localStorage.getItem(KEY_RATE))  || 1,    0.5, 2),
    pitch: clamp(Number(storedPitch) || DEFAULT_PITCH[gender], 0.5, 2),
    gender,
  };
}

export function setVoiceTone(tone: Partial<VoiceTone>) {
  if (typeof window === "undefined") return;

  if (tone.voiceName !== undefined) {
    if (tone.voiceName) window.localStorage.setItem(KEY_VOICE, tone.voiceName);
    else                window.localStorage.removeItem(KEY_VOICE);
    cachedVoice = null;
  }
  if (tone.rate !== undefined) {
    window.localStorage.setItem(KEY_RATE, String(clamp(tone.rate, 0.5, 2)));
  }

  if (tone.gender !== undefined) {
    window.localStorage.setItem(KEY_GENDER, tone.gender);
    // Reset pitch to the gender-appropriate default so male/female sounds correct
    const newPitch = tone.pitch ?? DEFAULT_PITCH[tone.gender];
    window.localStorage.setItem(KEY_PITCH, String(clamp(newPitch, 0.5, 2)));
    cachedVoice = null;
  } else if (tone.pitch !== undefined) {
    window.localStorage.setItem(KEY_PITCH, String(clamp(tone.pitch, 0.5, 2)));
  }

  window.dispatchEvent(new CustomEvent("lifeos:voice-tone"));
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, isNaN(v) ? lo : v));
}

let cachedVoice: SpeechSynthesisVoice | null = null;
let voicesLoadedOnce = false;

export function listVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices();
}

const FEMALE_NAMES = [
  "Samantha", "Victoria", "Karen", "Tessa", "Moira", "Allison",
  "Google UK English Female",
  "Microsoft Aria Online (Natural) - English (United States)",
  "Microsoft Jenny Online (Natural) - English (United States)",
  "Microsoft Zira - English (United States)",
  "Ava", "Serena", "Susan", "Fiona", "Veena",
];

const MALE_NAMES = [
  "Daniel", "Alex", "Fred", "Tom", "Aaron", "Arthur",
  "Google UK English Male",
  "Microsoft David Desktop - English (United States)",
  "Microsoft Mark - English (United States)",
  "Microsoft Guy Online (Natural) - English (United States)",
  "Albert", "Bruce", "Junior", "Ralph", "Lee",
];

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const tone = getVoiceTone();

  // User pinned a specific voice — use it
  if (tone.voiceName) {
    const match = voices.find((v) => v.name === tone.voiceName);
    if (match) return match;
  }

  const en   = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const pool = en.length ? en : voices;

  if (tone.gender === "male") {
    // 1. Try known male voice names
    for (const n of MALE_NAMES) {
      const v = pool.find((vv) => vv.name === n);
      if (v) return v;
    }
    // 2. Heuristic: name contains "male" or "man"
    const byName = pool.find((v) => /\b(male|man)\b/i.test(v.name));
    if (byName) return byName;
    // 3. Avoid known female voices, take first remaining
    const notFemale = pool.filter(
      (v) => !/\b(female|woman|samantha|aria|jenny|zira|fiona|victoria|karen)\b/i.test(v.name)
    );
    return notFemale[0] || pool[0] || null;
  }

  if (tone.gender === "female") {
    for (const n of FEMALE_NAMES) {
      const v = pool.find((vv) => vv.name === n);
      if (v) return v;
    }
    const byName = pool.find((v) => /\b(female|woman)\b/i.test(v.name));
    if (byName) return byName;
    // Avoid known male voices
    const notMale = pool.filter(
      (v) => !/\b(male|man|daniel|fred|ralph|albert|bruce)\b/i.test(v.name)
    );
    return notMale[0] || pool[0] || null;
  }

  // auto — just return first English voice
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
  // Fallback if voiceschanged never fires (some browsers)
  setTimeout(() => { if (!voicesLoadedOnce) { voicesLoadedOnce = true; cb(); } }, 600);
}

function doSpeak(text: string, forcePickVoice = false) {
  if (!cachedVoice || forcePickVoice) cachedVoice = pickVoice();
  window.speechSynthesis.cancel();
  const utter    = new SpeechSynthesisUtterance(text);
  if (cachedVoice) utter.voice = cachedVoice;
  const tone     = getVoiceTone();
  utter.rate     = tone.rate;
  utter.pitch    = tone.pitch;
  utter.volume   = 1;
  // Chrome bug: must defer speak() slightly after cancel() or it silently fails
  setTimeout(() => window.speechSynthesis.speak(utter), 50);
}

export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (!isVoiceEnabled()) return;
  const cleaned = text
    .replace(/[*_`#>~]/g, "")
    .replace(/\(https?:\/\/[^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
  if (!cleaned) return;
  ensureVoicesReady(() => doSpeak(cleaned));
}

export function speakPreview(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  // Always re-pick voice in preview so settings changes are reflected immediately
  ensureVoicesReady(() => doSpeak(text, true));
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}
