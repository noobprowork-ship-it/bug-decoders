import { useEffect, useRef, useState } from "react";
import { Sparkles, Mic, Send, X, Square, Loader2, AlertTriangle, Bot } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { openVoiceCompanion, transcribeAudio, type VoiceMessage } from "@/lib/api";

type Msg = { role: "user" | "assistant"; content: string };

const PAGE_HINTS: Record<string, string> = {
  "/": "Welcome to LifeOS. Pick a sign-in method, or skip to the dashboard to explore.",
  "/dashboard": "This is your home base. Open a module like GOIE, Multiverse, Cinematic, or Mind to start.",
  "/goie": "GOIE generates real-world opportunities with sources. Add interests/skills, then tap Generate opportunities.",
  "/multiverse": "Type a decision and I'll branch out alternate futures with milestones, risks and wins.",
  "/cinematic": "Describe a theme and I'll direct a cinematic with images for each scene.",
  "/mind": "Pour out your thoughts in Decode, or answer questions in Universe — I'll build a mind map.",
  "/voice": "This is the full-screen voice companion — ask me anything, I'll stream a reply.",
};

const WELCOME = "Hi, I'm your LifeOS assistant. Tap the mic to talk, or type below. I can guide you through any feature.";

export function AssistantBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const path = useRouterState({ select: (s) => s.location.pathname });

  const clientRef = useRef<ReturnType<typeof openVoiceCompanion> | null>(null);
  const streamBufRef = useRef("");
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Open WebSocket only when bot is opened (saves bandwidth on first paint)
  useEffect(() => {
    if (!open) return;
    if (clientRef.current) return;

    const client = openVoiceCompanion({
      onOpen: () => {
        if (messages.length === 0) {
          const initial: Msg[] = [];
          initial.push({ role: "assistant", content: WELCOME });
          if (PAGE_HINTS[path]) initial.push({ role: "assistant", content: PAGE_HINTS[path] });
          setMessages(initial);
        }
      },
      onMessage: (msg: VoiceMessage) => {
        if (msg.type === "stream-start") {
          streamBufRef.current = "";
          setStreaming(true);
          setMessages((m) => [...m, { role: "assistant", content: "" }]);
        } else if (msg.type === "stream-chunk") {
          streamBufRef.current += msg.text;
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: streamBufRef.current };
            return copy;
          });
        } else if (msg.type === "stream-end") {
          setStreaming(false);
        } else if (msg.type === "error") {
          setStreaming(false);
          setErr(msg.message || "Something went wrong");
        }
      },
    });
    clientRef.current = client;
    return () => {
      client.close();
      clientRef.current = null;
    };
  }, [open]);

  // When the path changes while open, send a contextual hint
  useEffect(() => {
    if (!open) return;
    const hint = PAGE_HINTS[path];
    if (!hint) return;
    setMessages((m) => {
      // Avoid duplicate consecutive hint
      if (m.length && m[m.length - 1].content === hint) return m;
      return [...m, { role: "assistant", content: hint }];
    });
  }, [path, open]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  function send(text: string) {
    const t = text.trim();
    if (!t || streaming) return;
    setErr(null);
    const next: Msg[] = [...messages, { role: "user", content: t }];
    setMessages(next);
    setInput("");
    const history = next.slice(-10).map((m) => ({ role: m.role, content: m.content }));
    clientRef.current?.sendChat(t, history.slice(0, -1));
  }

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
        if (blob.size < 200) return; // ignore empty
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
  function stopRecord() {
    recRef.current?.stop();
    setRecording(false);
  }

  // Don't render the bot on the landing page (it has its own login UI)
  if (path === "/") return null;

  return (
    <>
      {/* Floating launcher — middle-right edge */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed right-4 top-1/2 -translate-y-1/2 z-50 group"
          aria-label="Open LifeOS assistant"
        >
          <div className="relative h-14 w-14 rounded-full bg-aurora shadow-neon animate-pulse-glow flex items-center justify-center hover:scale-110 transition">
            <Bot className="h-6 w-6 text-primary-foreground" />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[oklch(0.75_0.18_150)] animate-pulse" />
          </div>
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div className="fixed right-4 bottom-4 lg:bottom-auto lg:top-1/2 lg:-translate-y-1/2 z-50 w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100vh-6rem))] glass-strong rounded-3xl shadow-soft flex flex-col overflow-hidden animate-rise">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-aurora flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <div className="text-sm font-display font-semibold">LifeOS Assistant</div>
                <div className="text-[10px] text-muted-foreground">
                  {streaming ? "Thinking…" : transcribing ? "Listening…" : "Online · ready to help"}
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="h-8 w-8 rounded-full glass flex items-center justify-center hover:bg-white/10"
              aria-label="Close assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-8">
                Connecting…
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "ml-auto bg-aurora text-primary-foreground"
                    : "glass text-foreground"
                }`}
              >
                {m.content || <span className="opacity-50">…</span>}
              </div>
            ))}
            {err && (
              <div className="flex items-start gap-2 text-xs text-[oklch(0.7_0.22_320)] glass rounded-2xl p-3">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>{err}</span>
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="p-3 border-t border-white/5 flex items-center gap-2">
            <button
              onClick={recording ? stopRecord : startRecord}
              disabled={transcribing}
              className={`h-10 w-10 rounded-2xl flex items-center justify-center transition ${
                recording
                  ? "bg-[oklch(0.7_0.22_25)] text-white animate-pulse"
                  : "bg-aurora text-primary-foreground shadow-neon hover:scale-105"
              } disabled:opacity-50`}
              aria-label={recording ? "Stop recording" : "Start voice input"}
            >
              {transcribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : recording ? (
                <Square className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
            <input
              type="text"
              placeholder="Ask anything…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
              className="flex-1 glass rounded-2xl px-3 py-2.5 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || streaming}
              className="h-10 w-10 rounded-2xl bg-aurora text-primary-foreground flex items-center justify-center shadow-neon hover:scale-105 transition disabled:opacity-50"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
