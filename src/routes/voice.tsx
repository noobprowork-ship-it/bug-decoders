import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Shell } from "@/components/aurora/Shell";
import { GlowCard, PageHeader, NeonButton } from "@/components/aurora/ui";
import { Mic, Send, Loader2, AlertTriangle } from "lucide-react";
import { openVoiceCompanion, type VoiceMessage } from "@/lib/api";
import { isVoiceEnabled, setVoiceEnabled, speak, stopSpeaking } from "@/lib/voice";
import { Volume2, VolumeX } from "lucide-react";

export const Route = createFileRoute("/voice")({
  head: () => ({ meta: [{ title: "Voice AI Companion — LifeOS" }] }),
  component: Voice,
});

type Msg = { role: "user" | "assistant"; content: string };

function Voice() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceOn, setVoiceOn] = useState<boolean>(() => (typeof window !== "undefined" ? isVoiceEnabled() : true));
  const voiceOnRef = useRef(voiceOn);
  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);
  const clientRef = useRef<ReturnType<typeof openVoiceCompanion> | null>(null);
  const streamBufferRef = useRef("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const client = openVoiceCompanion({
      onOpen: () => setConnected(true),
      onClose: () => setConnected(false),
      onMessage: (msg: VoiceMessage) => {
        if (msg.type === "stream-start") {
          streamBufferRef.current = "";
          setStreaming(true);
          setMessages((m) => [...m, { role: "assistant", content: "" }]);
        } else if (msg.type === "stream-chunk") {
          streamBufferRef.current += msg.text;
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: streamBufferRef.current };
            return copy;
          });
        } else if (msg.type === "stream-end") {
          setStreaming(false);
          const final = msg.text || streamBufferRef.current;
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: final };
            return copy;
          });
          if (voiceOnRef.current && final) speak(final);
        } else if (msg.type === "error") {
          setError(msg.message);
          setStreaming(false);
        }
      },
    });
    clientRef.current = client;
    return () => client.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function toggleVoice() {
    const next = !voiceOn;
    setVoiceOn(next);
    setVoiceEnabled(next);
    if (!next) stopSpeaking();
  }

  function send() {
    const text = input.trim();
    if (!text || streaming || !clientRef.current) return;
    setError(null);
    stopSpeaking();
    const newMsgs = [...messages, { role: "user" as const, content: text }];
    setMessages(newMsgs);
    setInput("");
    clientRef.current.sendChat(
      text,
      messages.map((m) => ({ role: m.role, content: m.content }))
    );
  }

  return (
    <Shell>
      <PageHeader
        eyebrow="Module 09"
        icon={Mic}
        title="Voice AI Companion"
        subtitle="Always on. Multilingual. Speaks in the tone you need — gentle coach, sharp strategist, or quiet friend."
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <GlowCard glow="pink" className="lg:col-span-2 flex flex-col min-h-[520px]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm">
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-primary animate-pulse" : "bg-muted"}`} />
              <span>{connected ? "Connected · LifeOS is listening" : "Connecting…"}</span>
            </div>
            <div className="flex items-center gap-3">
              {streaming && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> thinking
                </div>
              )}
              <button
                onClick={toggleVoice}
                className="h-9 w-9 rounded-full glass flex items-center justify-center hover:bg-white/10 transition"
                aria-label={voiceOn ? "Mute voice replies" : "Unmute voice replies"}
                title={voiceOn ? "Voice replies on" : "Voice replies off"}
              >
                {voiceOn ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[440px]">
            {messages.length === 0 && (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <div className="h-20 w-20 rounded-full bg-aurora animate-pulse-glow mx-auto mb-4 flex items-center justify-center">
                    <Mic className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <p className="text-muted-foreground text-sm">Ask Aurora anything — life, work, decisions, ideas.</p>
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-aurora text-primary-foreground shadow-neon" : "glass"}`}>
                  {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
                </div>
              </div>
            ))}
            {error && (
              <div className="flex items-start gap-2 glass rounded-2xl p-3 text-xs text-[oklch(0.7_0.22_320)]">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>{error}</div>
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              placeholder="Type to Aurora…"
              disabled={!connected || streaming}
              className="flex-1 glass rounded-2xl px-4 py-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary"
            />
            <NeonButton onClick={send} disabled={!connected || streaming || !input.trim()}>
              <Send className="h-4 w-4" />
            </NeonButton>
          </div>
        </GlowCard>

        <div className="space-y-4">
          <GlowCard glow="blue">
            <h3 className="font-display font-semibold mb-3">How it works</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>· Streaming GPT-4 powered replies</li>
              <li>· Persistent across this session</li>
              <li>· Ask about life, work, decisions, ideas</li>
              <li>· Pair with Multiverse + Mind for depth</li>
            </ul>
          </GlowCard>
          <GlowCard glow="purple">
            <h3 className="font-display font-semibold mb-3">Try asking</h3>
            <div className="space-y-2">
              {[
                "What should I focus on this week?",
                "Help me decide between two job offers.",
                "Why do I procrastinate on big projects?",
                "Write me a 5-year vision statement.",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="w-full text-left glass hover:bg-white/10 rounded-xl px-3 py-2 text-xs transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </GlowCard>
        </div>
      </div>
    </Shell>
  );
}
