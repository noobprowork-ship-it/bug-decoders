/**
 * Web Speech API wrapper — gives us instant, on-device transcription
 * (no server round-trip), enabling JARVIS-like always-listening mode.
 *
 * Falls back gracefully on browsers that don't support SpeechRecognition
 * (Firefox); callers can detect support via `isSpeechRecognitionSupported()`.
 */

type SR = {
  start: () => void;
  stop: () => void;
  abort: () => void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

function getCtor(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function isSpeechRecognitionSupported(): boolean {
  return !!getCtor();
}

export type ListenerHandle = {
  stop: () => void;
  abort: () => void;
};

export type ListenerOptions = {
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError?: (err: { code: string; message: string }) => void;
  onStart?: () => void;
  onEnd?: () => void;
  continuous?: boolean;
  lang?: string;
};

/** Start listening. Returns a handle with stop/abort. */
export function startListening(opts: ListenerOptions): ListenerHandle {
  const Ctor = getCtor();
  if (!Ctor) {
    opts.onError?.({ code: "unsupported", message: "Speech recognition not supported in this browser." });
    return { stop: () => {}, abort: () => {} };
  }
  const rec = new Ctor() as SR;
  rec.continuous = opts.continuous !== false;
  rec.interimResults = true;
  rec.lang = opts.lang || "en-US";

  let stopped = false;

  rec.onresult = (e: any) => {
    let interim = "";
    let final = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (interim && opts.onPartial) opts.onPartial(interim.trim());
    if (final.trim()) opts.onFinal(final.trim());
  };

  rec.onerror = (e: any) => {
    if (e?.error === "no-speech" || e?.error === "aborted") return;
    opts.onError?.({ code: e?.error || "error", message: e?.message || e?.error || "Speech recognition error" });
  };

  rec.onstart = () => opts.onStart?.();
  rec.onend = () => {
    if (stopped) {
      opts.onEnd?.();
      return;
    }
    // Auto-restart so always-on mode keeps listening through pauses.
    if (opts.continuous !== false) {
      try {
        rec.start();
      } catch {
        opts.onEnd?.();
      }
    } else {
      opts.onEnd?.();
    }
  };

  try {
    rec.start();
  } catch (err) {
    opts.onError?.({ code: "start_failed", message: (err as Error).message });
  }

  return {
    stop: () => {
      stopped = true;
      try { rec.stop(); } catch { /* noop */ }
    },
    abort: () => {
      stopped = true;
      try { rec.abort(); } catch { /* noop */ }
    },
  };
}
