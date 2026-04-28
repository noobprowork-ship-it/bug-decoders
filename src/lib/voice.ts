/**
 * Voice synthesis — speaks assistant replies aloud using the browser's
 * built-in SpeechSynthesis API. Picks a female voice when available
 * (no extra API call, no quota, works offline).
 *
 * Persistence: a "voice enabled" flag is stored in localStorage so the
 * preference survives reloads.
 */

const KEY = "lifeos.voice.enabled";

export function isVoiceEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) !== "0";
}

export function setVoiceEnabled(on: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, on ? "1" : "0");
}

let cachedVoice: SpeechSynthesisVoice | null = null;
let voicesLoadedOnce = false;

function pickFemaleVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

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
  // Fall back to anything with "female" in the name, then first English voice.
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
  // Some browsers don't fire the event without a kick.
  setTimeout(() => {
    if (!voicesLoadedOnce) cb();
  }, 500);
}

/** Speak the given text using a female voice. Cancels any in-flight speech. */
export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (!isVoiceEnabled()) return;
  const cleaned = text.replace(/[*_`#>~]/g, "").trim();
  if (!cleaned) return;
  ensureVoicesReady(() => {
    if (!cachedVoice) cachedVoice = pickFemaleVoice();
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(cleaned);
    if (cachedVoice) utter.voice = cachedVoice;
    utter.rate = 1;
    utter.pitch = 1.05;
    utter.volume = 1;
    window.speechSynthesis.speak(utter);
  });
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}
