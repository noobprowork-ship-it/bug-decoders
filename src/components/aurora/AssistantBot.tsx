import { useCallback, useEffect, useRef, useState, memo } from "react";
import {
  Sparkles, Mic, Send, X, Square, Loader2, AlertTriangle, Bot,
  Volume2, VolumeX, Settings2, Radio, Newspaper,
} from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { openVoiceCompanion, transcribeAudio, news, type VoiceMessage } from "@/lib/api";
import { isVoiceEnabled, setVoiceEnabled, speak, stopSpeaking } from "@/lib/voice";
import { trackAction } from "@/lib/activityTracker";
import { isSpeechRecognitionSupported, startListening, type ListenerHandle } from "@/lib/speechRecognition";
import { VoiceSettings } from "./VoiceSettings";

type Msg = { role: "user" | "assistant"; content: string };

const PAGE_HINTS: Record<string, string> = {
  "/": "Welcome to LifeOS. Sign in with Google or create an account to get started.",
  "/dashboard": "This is your home base. Open a module like GOIE, Multiverse, Mind, or Community to start.",
  "/goie": "GOIE generates real-world opportunities with sources. Add interests/skills, then tap Generate opportunities.",
  "/multiverse": "Type a decision and I'll branch out alternate futures with milestones, risks and wins.",
  "/mind": "Pour out your thoughts in Decode, or answer questions in Universe — I'll build a mind map.",
  "/voice": "This is the full-screen voice companion — ask me anything, I'll stream a reply.",
  "/explore": "Explore shows your behavior patterns and hidden skills. Try generating a report!",
  "/profile": "This is your Profile. Fill in your skills, bio, and links — then hit Career AI for personalised job and career recommendations!",
  "/people": "Find your tribe! Add your interests and skills on the left, and I'll match you to the best online communities.",
  "/rjss": "Job Search — add your skills and let AI find the best matching opportunities for you.",
  "/courses": "Courses & Internships — search for free courses and real internship opportunities.",
};

const WELCOME =
  "Hi, I'm your LifeOS companion. Tap the radar to talk hands-free, or type below. " +
  "Ask me anything, including current news, markets, or world events.";

const NEWS_TRIGGERS = /\b(news|today|latest|current|right now|markets?|stock|stocks?|s&p|nasdaq|war|elect|space|launch|nasa|spacex|score|match|crypto|bitcoin|ethereum|weather)\b/i;

// Memoised message bubble to avoid re-rendering all messages on every chunk
const MessageBubble = memo(({ role, content }: { role: "user" | "assistant"; content: string }) => (
  <div
    className={`max-w-[86%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
      role === "user" ? "ml-auto bg-aurora text-primary-foreground" : "glass text-foreground"
    }`}
  >
    {content || <span className="opacity-40">…</span>}
  </div>
));
MessageBubble.displayName = "MessageBubble";

export function AssistantBot() {
  const [open, setOpen]               = useState(false);
  const [messages, setMessages]       = useState<Msg[]>([]);
  const [input, setInput]             = useState("");
  const [streaming, setStreaming]     = useState(false);
  const [recording, setRecording]     = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [listening, setListening]     = useState(false);
  const [interim, setInterim]         = useState("");
  const [err, setErr]                 = useState<string | null>(null);
  const [voiceOn, setVoiceOn]         = useState<boolean>(() =>
    typeof window !== "undefined" ? isVoiceEnabled() : true
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  const path = useRouterState({ select: (s) => s.location.pathname });

  const clientRef      = useRef<ReturnType<typeof openVoiceCompanion> | null>(null);
  const streamBufRef   = useRef("");
  const voiceOnRef     = useRef(voiceOn);
  const recRef         = useRef<MediaRecorder | null>(null);
  const chunksRef      = useRef<BlobPart[]>([]);
  const scrollRef      = useRef<HTMLDivElement>(null);
  const listenHandleRef = useRef<ListenerHandle | null>(null);
  const sessionIdRef   = useRef<string | null>(null);
  const openedRef      = useRef(false);

  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);

  const supportsSR = typeof window !== "undefined" && isSpeechRecognitionSupported();

  // Open WebSocket lazily — only once per panel open
  useEffect(() => {
    if (!open) return;
    if (openedRef.current && clientRef.current) return;
    openedRef.current = true;

    const client = openVoiceCompanion({
      onOpen: () => {
        if (messages.length === 0) {
          const initial: Msg[] = [{ role: "assistant", content: WELCOME }];
          const hint = PAGE_HINTS[path];
          if (hint) initial.push({ role: "assistant", content: hint });
          setMessages(initial);
        }
      },
      onMessage: (msg: VoiceMessage) => {
        if (msg.type === "session" && (msg as { sessionId?: string }).sessionId) {
          sessionIdRef.current = (msg as { sessionId: string }).sessionId;
        } else if (msg.type === "stream-start") {
          streamBufRef.current = "";
          setStreaming(true);
          setMessages((m) => [...m, { role: "assistant", content: "" }]);
        } else if (msg.type === "stream-chunk") {
          streamBufRef.current += msg.text;
          // Only update the last message (avoid full array clone every chunk)
          setMessages((m) => {
            if (m.length === 0) return m;
            const last = { ...m[m.length - 1], content: streamBufRef.current };
            return [...m.slice(0, -1), last];
          });
        } else if (msg.type === "stream-end") {
          setStreaming(false);
          if (voiceOnRef.current && streamBufRef.current) speak(streamBufRef.current);
        } else if (msg.type === "error") {
          setStreaming(false);
          setErr((msg as { message?: string }).message || "Something went wrong");
        }
      },
    });
    clientRef.current = client;

    return () => {
      client.close();
      clientRef.current = null;
      openedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Inject page hint when route changes (while open)
  useEffect(() => {
    if (!open) return;
    const hint = PAGE_HINTS[path];
    if (!hint) return;
    setMessages((m) => {
      if (m.length && m[m.length - 1].content === hint) return m;
      return [...m, { role: "assistant", content: hint }];
    });
  }, [path, open]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, interim]);

  // Stop listening when panel is closed
  useEffect(() => {
    if (!open && listenHandleRef.current) {
      listenHandleRef.current.abort();
      listenHandleRef.current = null;
      setListening(false);
      setInterim("");
    }
  }, [open]);

  const handleNewsQuery = useCallback(async (q: string) => {
    streamBufRef.current = "";
    setStreaming(true);
    setMessages((m) => [...m, { role: "assistant", content: "" }]);
    try {
      const resp = await news.ask({ query: q });

      let full = "";

      // New structured format
      if (resp.articles?.length) {
        const header = resp.headline ? `**${resp.headline}**\n\n` : "";
        const summary = resp.summary ? `${resp.summary}\n\n` : "";
        const articleLines = resp.articles.slice(0, 5).map((a, i) =>
          `**${i + 1}. ${a.title}** _(${a.source} · ${a.publishedAt})_\n${a.description}${a.sourceUrl ? `\n[Read more →](${a.sourceUrl})` : ""}`
        ).join("\n\n");
        const notice = resp.notice ? `\n\n_${resp.notice}_` : "";
        full = header + summary + articleLines + notice;
      } else {
        // Legacy plain-text format fallback
        const sourcesLine = resp.sources?.length
          ? "\n\nSources: " + resp.sources.slice(0, 3).map((s) => `[${s.title}](${s.url})`).join(" · ")
          : "";
        const noticeLine = resp.notice ? `\n\n_${resp.notice}_` : "";
        full = (resp.answer || "I couldn't find anything live right now.") + sourcesLine + noticeLine;
      }

      setMessages((m) => {
        if (!m.length) return m;
        const last = { ...m[m.length - 1], content: full };
        return [...m.slice(0, -1), last];
      });
      const speakText = resp.summary || resp.answer || "";
      if (voiceOnRef.current && speakText) speak(speakText);
    } catch (e) {
      setMessages((m) => {
        if (!m.length) return m;
        const last = {
          ...m[m.length - 1],
          content: "I couldn't reach the news desk right now — " +
            (e instanceof Error ? e.message : "try again in a moment."),
        };
        return [...m.slice(0, -1), last];
      });
    } finally {
      setStreaming(false);
    }
  }, []);

  const send = useCallback((text: string) => {
    const t = text.trim();
    if (!t || streaming) return;
    setErr(null);
    stopSpeaking();
    trackAction("assistant.send");
    const next: Msg[] = [...messages, { role: "user", content: t }];
    setMessages(next);
    setInput("");
    setInterim("");

    if (NEWS_TRIGGERS.test(t)) {
      handleNewsQuery(t);
      return;
    }

    const history = next.slice(-10).map((m) => ({ role: m.role, content: m.content }));
    clientRef.current?.sendChat(t, history.slice(0, -1), sessionIdRef.current);
  }, [streaming, messages, handleNewsQuery]);

  const toggleVoice = useCallback(() => {
    const next = !voiceOn;
    setVoiceOn(next);
    setVoiceEnabled(next);
    if (!next) stopSpeaking();
  }, [voiceOn]);

  const startInstantListen = useCallback(() => {
    if (!supportsSR) { startRecord(); return; }
    setErr(null);
    stopSpeaking();
    setListening(true);
    setInterim("");
    listenHandleRef.current = startListening({
      onPartial: (txt) => setInterim(txt),
      onFinal: (txt) => {
        setInterim("");
        if (txt) send(txt);
      },
      onError: (e) => {
        setListening(false);
        setInterim("");
        if (e.code === "not-allowed" || e.code === "service-not-allowed") {
          setErr("Microphone permission denied. Allow it in your browser to talk to LifeOS.");
        } else if (e.code !== "no-speech" && e.code !== "aborted") {
          setErr(e.message);
        }
      },
      onEnd: () => setListening(false),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [send, supportsSR]);

  const stopInstantListen = useCallback(() => {
    listenHandleRef.current?.stop();
    listenHandleRef.current = null;
    setListening(false);
    setInterim("");
  }, []);

  async function startRecord() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        if (blob.size < 200) return;
        setTranscribing(true);
        try {
          const resp = await transcribeAudio(blob);
          if (resp.text?.trim()) send(resp.text.trim());
        } catch (e) {
          setErr(e instanceof Error ? e.message : "Transcription failed");
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Microphone permission denied");
    }
  }

  function stopRecord() { recRef.current?.stop(); setRecording(false); }

  if (path === "/") return null;

  const micBusy   = listening || recording || transcribing;
  const micAction = listening ? stopInstantListen : recording ? stopRecord : startInstantListen;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed right-4 top-1/2 -translate-y-1/2 z-50"
          aria-label="Open LifeOS assistant"
        >
          <div className="relative h-14 w-14 rounded-full bg-aurora shadow-neon animate-pulse-glow flex items-center justify-center hover:scale-110 transition-transform">
            <Bot className="h-6 w-6 text-primary-foreground" />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[oklch(0.75_0.18_150)] animate-pulse" />
          </div>
        </button>
      )}

      {open && (
        <div className="fixed right-4 bottom-20 lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 z-50 w-[min(380px,calc(100vw-2rem))] h-[min(580px,calc(100dvh-8rem))] glass-strong rounded-3xl shadow-soft flex flex-col overflow-hidden animate-rise">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 flex-shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-aurora flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-display font-semibold">LifeOS AI</div>
                <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 truncate">
                  {streaming ? (
                    "Thinking…"
                  ) : listening ? (
                    <><span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.7_0.22_25)] animate-pulse flex-shrink-0" />Listening — just speak</>
                  ) : transcribing ? (
                    "Transcribing…"
                  ) : (
                    "Online · ready to help"
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => setSettingsOpen(true)}
                className="h-8 w-8 rounded-full glass flex items-center justify-center hover:bg-white/10"
                aria-label="Voice settings"
                title="Voice tone & settings"
              >
                <Settings2 className="h-4 w-4" />
              </button>
              <button
                onClick={toggleVoice}
                className="h-8 w-8 rounded-full glass flex items-center justify-center hover:bg-white/10"
                aria-label={voiceOn ? "Mute" : "Unmute"}
                title={voiceOn ? "Voice on" : "Voice off"}
              >
                {voiceOn ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4" />}
              </button>
              <button
                onClick={() => { stopSpeaking(); stopInstantListen(); setOpen(false); }}
                className="h-8 w-8 rounded-full glass flex items-center justify-center hover:bg-white/10"
                aria-label="Close assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick actions */}
          <div className="px-3 pt-2.5 flex gap-2 flex-wrap flex-shrink-0">
            <button
              onClick={() => send("What's the latest in world news right now?")}
              disabled={streaming}
              className="text-[11px] glass rounded-full px-3 py-1.5 hover:bg-white/10 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Newspaper className="h-3 w-3" /> Today's news
            </button>
            <button
              onClick={() => send("How are global markets doing today?")}
              disabled={streaming}
              className="text-[11px] glass rounded-full px-3 py-1.5 hover:bg-white/10 transition disabled:opacity-50"
            >
              📈 Markets
            </button>
            <button
              onClick={() => send("What's the latest in space exploration?")}
              disabled={streaming}
              className="text-[11px] glass rounded-full px-3 py-1.5 hover:bg-white/10 transition disabled:opacity-50"
            >
              🚀 Space
            </button>
          </div>

          {/* Message list */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0">
            {messages.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-8">Connecting…</div>
            )}
            {messages.map((m, i) => (
              <MessageBubble key={i} role={m.role} content={m.content} />
            ))}
            {interim && (
              <div className="ml-auto max-w-[86%] rounded-2xl px-3 py-2 text-sm italic opacity-70 bg-aurora/40 text-primary-foreground">
                {interim}…
              </div>
            )}
            {err && (
              <div className="flex items-start gap-2 text-xs text-[oklch(0.7_0.22_320)] glass rounded-2xl p-3">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>{err}</span>
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="p-3 border-t border-white/5 flex items-center gap-2 flex-shrink-0">
            <button
              onClick={micAction}
              disabled={transcribing && !listening}
              className={`h-10 w-10 rounded-2xl flex-shrink-0 flex items-center justify-center transition-transform ${
                listening || recording
                  ? "bg-[oklch(0.7_0.22_25)] text-white animate-pulse"
                  : "bg-aurora text-primary-foreground shadow-neon hover:scale-105"
              } disabled:opacity-50`}
              aria-label={listening ? "Stop listening" : recording ? "Stop recording" : "Talk"}
              title={supportsSR ? (listening ? "Tap to stop" : "Talk hands-free") : "Tap to record"}
            >
              {transcribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : listening ? (
                <Radio className="h-4 w-4" />
              ) : recording ? (
                <Square className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
            <input
              type="text"
              placeholder={listening ? "Listening — just speak…" : "Ask anything…"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
              className="flex-1 glass rounded-2xl px-3 py-2.5 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary min-w-0"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || streaming}
              className="h-10 w-10 rounded-2xl flex-shrink-0 bg-aurora text-primary-foreground flex items-center justify-center shadow-neon hover:scale-105 transition-transform disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <VoiceSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
