/**
 * Voice synthesis — speaks assistant replies using the browser's SpeechSynthesis API.
 *
 * Root causes of male voice failure (all fixed here):
 *
 * 1. STALE VOICE OBJECT: Chrome invalidates SpeechSynthesisVoice objects when
 *    the voices list refreshes. Storing the object (not the name) makes Chrome
 *    silently ignore it and fall back to the default (female) voice.
 *    FIX: Store only the voice NAME. Resolve a fresh object at speak-time.
 *
 * 2. CHROME PAUSED STATE BUG: After cancel() or tab blur, Chrome's
 *    speechSynthesis silently enters "paused" state. Calling speak() in
 *    paused state produces silence.
 *    FIX: Always call resume() before speak().
 *
 * 3. CANCEL+SPEAK RACE CONDITION: 50ms delay after cancel() is not enough
 *    on slower devices/browsers — the utterance is dropped silently.
 *    FIX: 150ms delay.
 *
 * 4. REMOTE VOICE UNAVAILABILITY: "Google UK English Male" is a remote voice
 *    that may not load in restricted environments (iframes, firewalls).
 *    FIX: Prefer local (localService=true) male voices; include broader
 *    heuristics as deep fallbacks.
 *
 * 5. PITCH NOT MATCHING GENDER ON FIRST ASSIGN: If pitch was stored from
 *    a female session and gender changes to male, stored pitch (1.1) is used.
 *    FIX: setVoiceTone resets pitch to gender default when gender changes.
 */

const KEY_ENABLED = "lifeos.voice.enabled";
const KEY_VOICE   = "lifeos.voice.name";   // stores voice NAME (string), not object
const KEY_RATE    = "lifeos.voice.rate";
const KEY_PITCH   = "lifeos.voice.pitch";
const KEY_GENDER  = "lifeos.voice.gender";

export type VoiceGender = "female" | "male" | "auto";

export type VoiceTone = {
  voiceName: string | null;
  rate:   number;
  pitch:  number;
  gender: VoiceGender;
};

export const DEFAULT_PITCH: Record<VoiceGender, number> = {
  female: 1.1,
  male:   0.75,   // noticeably lower for a clear masculine tone
  auto:   1.0,
};

/* ── localStorage helpers ────────────────────────────────────────────────── */

export function isVoiceEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY_ENABLED) !== "0";
}

export function setVoiceEnabled(on: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_ENABLED, on ? "1" : "0");
}

export function getVoiceTone(): VoiceTone {
  if (typeof window === "undefined") {
    return { voiceName: null, rate: 1, pitch: DEFAULT_PITCH.male, gender: "male" };
  }
  const gender = (window.localStorage.getItem(KEY_GENDER) as VoiceGender) || "male";
  const storedPitch = window.localStorage.getItem(KEY_PITCH);
  return {
    voiceName: window.localStorage.getItem(KEY_VOICE),
    rate:  clamp(Number(window.localStorage.getItem(KEY_RATE))  || 1,                    0.5, 2),
    pitch: clamp(Number(storedPitch) || DEFAULT_PITCH[gender],   0.5, 2),
    gender,
  };
}

export function setVoiceTone(tone: Partial<VoiceTone>) {
  if (typeof window === "undefined") return;

  if (tone.voiceName !== undefined) {
    if (tone.voiceName) window.localStorage.setItem(KEY_VOICE, tone.voiceName);
    else                window.localStorage.removeItem(KEY_VOICE);
    cachedVoiceName = null; // invalidate name cache
  }
  if (tone.rate !== undefined) {
    window.localStorage.setItem(KEY_RATE, String(clamp(tone.rate, 0.5, 2)));
  }

  if (tone.gender !== undefined) {
    window.localStorage.setItem(KEY_GENDER, tone.gender);
    // Always reset pitch to gender-appropriate default when gender changes.
    // Using tone.pitch override only if explicitly provided.
    const resetPitch = tone.pitch ?? DEFAULT_PITCH[tone.gender];
    window.localStorage.setItem(KEY_PITCH, String(clamp(resetPitch, 0.5, 2)));
    cachedVoiceName = null; // invalidate so next speak re-picks
  } else if (tone.pitch !== undefined) {
    window.localStorage.setItem(KEY_PITCH, String(clamp(tone.pitch, 0.5, 2)));
  }

  window.dispatchEvent(new CustomEvent("lifeos:voice-tone"));
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, isNaN(v) ? lo : v));
}

/* ── Voice name cache (NOT object cache — objects go stale in Chrome) ──── */
let cachedVoiceName: string | null = null;
let voicesLoadedOnce = false;

export function listVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return [];
  return window.speechSynthesis.getVoices();
}

/** Resolve a FRESH SpeechSynthesisVoice object by name at call-time. */
function resolveVoice(name: string | null): SpeechSynthesisVoice | null {
  if (!name) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.name === name) || null;
}

/* ── Known voice name lists ─────────────────────────────────────────────── */

// Verified male voice names across macOS / Windows / Chrome / Safari / Firefox
const MALE_NAMES_LOCAL = [
  // macOS built-in (local)
  "Alex", "Daniel", "Fred", "Junior", "Ralph",
  "Albert", "Bruce", "Lee", "Tom",
  // Windows built-in (local)
  "Microsoft David Desktop - English (United States)",
  "Microsoft Mark - English (United States)",
  "Microsoft David - English (United States)",
];

const MALE_NAMES_REMOTE = [
  // Chrome remote voices
  "Google UK English Male",
  "Microsoft Guy Online (Natural) - English (United States)",
  "Microsoft Roger Online (Natural) - English (United States)",
  "Microsoft Ryan Online (Natural) - English (United States)",
  "Microsoft Eric Online (Natural) - English (United States)",
  "Microsoft Andrew Online (Natural) - English (United States)",
  "Microsoft Brian Online (Natural) - English (United States)",
  "Microsoft Christopher Online (Natural) - English (United States)",
];

const FEMALE_KEYWORDS =
  /\b(female|woman|samantha|aria|jenny|zira|fiona|victoria|karen|allison|tessa|moira|ava|serena|susan|emma|claire|bella)\b/i;
const MALE_KEYWORDS =
  /\b(male|man|daniel|alex|fred|tom|aaron|arthur|david|mark|guy|albert|bruce|junior|ralph|lee|roger|ryan|eric|andrew|brian)\b/i;

/**
 * Pick the best voice NAME for the current gender preference.
 * Returns the NAME string (not the voice object) to avoid stale-object bugs.
 */
export function pickVoiceName(): string | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const tone = getVoiceTone();

  // User pinned a specific voice — honour it if still available
  if (tone.voiceName) {
    if (voices.find((v) => v.name === tone.voiceName)) return tone.voiceName;
  }

  const en   = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const pool = en.length ? en : voices;

  if (tone.gender === "male") {
    // 1. Try known LOCAL male voices first (most reliable — not network-dependent)
    for (const n of MALE_NAMES_LOCAL) {
      if (pool.find((v) => v.name === n && v.localService !== false)) return n;
    }
    // 2. Try known LOCAL male voices (any localService value)
    for (const n of MALE_NAMES_LOCAL) {
      if (pool.find((v) => v.name === n)) return n;
    }
    // 3. Try known remote male voices
    for (const n of MALE_NAMES_REMOTE) {
      if (pool.find((v) => v.name === n)) return n;
    }
    // 4. Heuristic: voice name contains a male keyword
    const byKeyword = pool.find((v) => MALE_KEYWORDS.test(v.name));
    if (byKeyword) return byKeyword.name;
    // 5. Last resort: any voice that doesn't look female
    const notFemale = pool.filter((v) => !FEMALE_KEYWORDS.test(v.name));
    if (notFemale.length) return notFemale[0].name;
    // 6. Absolute fallback — whatever is first (we'll compensate with very low pitch)
    return pool[0]?.name || null;
  }

  if (tone.gender === "female") {
    // Standard female priority list
    const FEMALE_NAMES = [
      "Samantha", "Victoria", "Karen", "Tessa", "Moira", "Allison",
      "Microsoft Aria Online (Natural) - English (United States)",
      "Microsoft Jenny Online (Natural) - English (United States)",
      "Microsoft Zira - English (United States)",
      "Google UK English Female",
      "Ava", "Serena", "Susan", "Fiona",
    ];
    for (const n of FEMALE_NAMES) {
      if (pool.find((v) => v.name === n)) return n;
    }
    const byKeyword = pool.find((v) => FEMALE_KEYWORDS.test(v.name));
    if (byKeyword) return byKeyword.name;
    const notMale = pool.filter((v) => !MALE_KEYWORDS.test(v.name));
    return (notMale[0] || pool[0])?.name || null;
  }

  // auto — first English voice
  return pool[0]?.name || null;
}

/* ── Voice readiness ─────────────────────────────────────────────────────── */

function ensureVoicesReady(cb: () => void) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    voicesLoadedOnce = true;
    cb();
    return;
  }
  const handler = () => {
    voicesLoadedOnce = true;
    window.speechSynthesis.removeEventListener("voiceschanged", handler);
    cb();
  };
  window.speechSynthesis.addEventListener("voiceschanged", handler);
  // Hard timeout: some browsers never fire voiceschanged
  setTimeout(() => { if (!voicesLoadedOnce) { voicesLoadedOnce = true; cb(); } }, 800);
}

/* ── Core speak implementation ───────────────────────────────────────────── */

function doSpeak(text: string, forceRepick = false) {
  // Pick voice NAME (never cache the object — Chrome invalidates them)
  if (!cachedVoiceName || forceRepick) {
    cachedVoiceName = pickVoiceName();
  }

  // Always cancel any ongoing speech first
  window.speechSynthesis.cancel();

  const tone  = getVoiceTone();
  const utter = new SpeechSynthesisUtterance(text);

  // Resolve a FRESH voice object by name at speak-time
  const freshVoice = resolveVoice(cachedVoiceName);
  if (freshVoice) {
    utter.voice = freshVoice;
    // Also set lang from the voice to help the browser route correctly
    utter.lang = freshVoice.lang || "en-US";
  } else {
    // No voice found — set lang so the browser can pick one itself
    utter.lang = "en-US";
  }

  utter.rate   = tone.rate;
  utter.pitch  = tone.pitch;
  utter.volume = 1;

  // FIX: Chrome silently enters "paused" state after cancel() or tab blur.
  // resume() + 150ms delay ensures the engine is ready to accept a new utterance.
  setTimeout(() => {
    try {
      window.speechSynthesis.resume(); // un-pause Chrome's engine
      window.speechSynthesis.speak(utter);
    } catch {
      // Some browsers throw if called in a restricted context — ignore silently
    }
  }, 150);
}

/* ── Public API ──────────────────────────────────────────────────────────── */

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
  // Force re-pick so settings changes are heard immediately
  ensureVoicesReady(() => doSpeak(text, true));
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}
