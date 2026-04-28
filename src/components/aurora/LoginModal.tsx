import { useEffect, useRef, useState } from "react";
import { X, Mail, Mic, ChromeIcon, Loader2, AlertTriangle, Square, Sparkles } from "lucide-react";
import { auth, setToken } from "@/lib/api";
import { setStoredUser } from "@/lib/user";

export type LoginMode = "email" | "voice" | "google";

export function LoginModal({
  mode,
  onClose,
  onSuccess,
}: {
  mode: LoginMode;
  onClose: () => void;
  onSuccess: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-rise"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md glass-strong rounded-3xl p-7 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-8 w-8 rounded-full glass flex items-center justify-center hover:bg-white/10"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {mode === "email" && <EmailPanel onSuccess={onSuccess} />}
        {mode === "voice" && <VoicePanel onSuccess={onSuccess} />}
        {mode === "google" && <GooglePanel onSuccess={onSuccess} />}
      </div>
    </div>
  );
}

/* ---------- Email login / signup ---------- */
function EmailPanel({ onSuccess }: { onSuccess: () => void }) {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!email.trim() || !password.trim()) {
      setErr("Email and password are required.");
      return;
    }
    setLoading(true);
    try {
      const resp =
        tab === "signin"
          ? await auth.login({ email: email.trim(), password })
          : await auth.register({ name: name.trim() || undefined, email: email.trim(), password });
      setToken(resp.token);
      setStoredUser({
        id: (resp.user as { id?: string })?.id,
        email: resp.user?.email,
        name: (resp.user as { name?: string })?.name || (tab === "signup" ? name.trim() || undefined : undefined),
      });
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-11 w-11 rounded-2xl bg-aurora flex items-center justify-center">
          <Mail className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">
            {tab === "signin" ? "Sign in" : "Create account"}
          </h2>
          <p className="text-xs text-muted-foreground">Use your LifeOS email</p>
        </div>
      </div>

      <div className="flex gap-2 mb-5 glass rounded-2xl p-1">
        {(["signin", "signup"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-xl text-xs font-medium transition ${
              tab === t ? "bg-aurora text-primary-foreground shadow-neon" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "signin" ? "Sign in" : "Sign up"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3">
        {tab === "signup" && (
          <input
            type="text"
            placeholder="Name (optional)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary"
          />
        )}
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary"
          autoComplete="email"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary"
          autoComplete={tab === "signin" ? "current-password" : "new-password"}
        />

        {err && (
          <div className="flex items-start gap-2 text-xs text-[oklch(0.7_0.22_320)]">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-aurora text-primary-foreground rounded-2xl py-3.5 shadow-neon hover:scale-[1.01] transition font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {tab === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>
    </div>
  );
}

/* ---------- Voice login ---------- */
function VoicePanel({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [recording, setRecording] = useState(false);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  async function start() {
    setErr(null); setTranscript(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudio(blob);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Microphone access denied.");
    }
  }
  function stop() {
    recRef.current?.stop();
    setRecording(false);
  }

  async function submit() {
    if (!email.trim()) return setErr("Email is required.");
    if (!audio) return setErr("Record a short voice phrase first.");
    setSubmitting(true); setErr(null);
    try {
      const resp = await auth.voiceLogin(email.trim(), audio);
      setToken(resp.token);
      setStoredUser({
        id: resp.user?.id,
        email: resp.user?.email,
        name: (resp.user as { name?: string })?.name,
      });
      setTranscript(resp.transcript || null);
      setTimeout(onSuccess, 700);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Voice login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-11 w-11 rounded-2xl bg-aurora flex items-center justify-center animate-pulse-glow">
          <Mic className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Voice login</h2>
          <p className="text-xs text-muted-foreground">Speak your passphrase — we'll transcribe and match it.</p>
        </div>
      </div>

      <input
        type="email"
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary mb-4"
      />

      <div className="glass rounded-2xl p-5 mb-4 flex flex-col items-center">
        {recording ? (
          <button
            onClick={stop}
            className="h-20 w-20 rounded-full bg-[oklch(0.7_0.22_25)] flex items-center justify-center animate-pulse"
            aria-label="Stop recording"
          >
            <Square className="h-7 w-7 text-white" />
          </button>
        ) : (
          <button
            onClick={start}
            className="h-20 w-20 rounded-full bg-aurora flex items-center justify-center shadow-neon hover:scale-105 transition"
            aria-label="Start recording"
          >
            <Mic className="h-8 w-8 text-primary-foreground" />
          </button>
        )}
        <p className="text-xs text-muted-foreground mt-3">
          {recording ? "Recording — tap to stop" : audio ? "Tap to re-record" : "Tap mic and say a short phrase"}
        </p>
        {audioUrl && !recording && <audio src={audioUrl} controls className="w-full mt-3" />}
      </div>

      {err && (
        <div className="flex items-start gap-2 text-xs text-[oklch(0.7_0.22_320)] mb-3">
          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{err}</span>
        </div>
      )}
      {transcript && (
        <div className="text-xs text-muted-foreground mb-3 glass rounded-xl p-3">
          Heard: <span className="text-foreground">"{transcript}"</span>
        </div>
      )}

      <button
        onClick={submit}
        disabled={!audio || submitting}
        className="w-full bg-aurora text-primary-foreground rounded-2xl py-3.5 shadow-neon hover:scale-[1.01] transition font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Sign in with voice
      </button>
    </div>
  );
}

/* ---------- Google (real account, real bio) ---------- */
function GooglePanel({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [bioText, setBioText] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setErr("Please enter your real Google email so we can link your data.");
      return;
    }
    setLoading(true);
    try {
      const resp = await auth.google({
        email: email.trim(),
        name: name.trim() || undefined,
        photoUrl: photoUrl.trim() || undefined,
        bio: bioText.trim() ? { about: bioText.trim() } : undefined,
      });
      setToken(resp.token);
      setStoredUser({
        id: resp.user?.id,
        email: resp.user?.email,
        name: resp.user?.name || name.trim() || undefined,
        photoUrl: resp.user?.photoUrl || photoUrl.trim() || undefined,
        tier: resp.user?.tier,
      });
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Google sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-11 w-11 rounded-2xl bg-aurora flex items-center justify-center">
          <ChromeIcon className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Continue with Google</h2>
          <p className="text-xs text-muted-foreground">Real account · saved across sessions.</p>
        </div>
      </div>

      <div className="text-xs text-muted-foreground mb-4 glass rounded-xl p-3 leading-relaxed">
        Sign in with your real Google email — we'll create or reload your LifeOS profile and
        keep your bio, history and assistant memory in your private database.
      </div>

      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="you@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          type="text"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          type="url"
          placeholder="Profile photo URL (optional)"
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          className="w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary"
        />
        <textarea
          placeholder="A short bio so Aurora gets you (optional)"
          value={bioText}
          onChange={(e) => setBioText(e.target.value)}
          rows={2}
          className="w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary resize-none"
        />
        {err && (
          <div className="flex items-start gap-2 text-xs text-[oklch(0.7_0.22_320)]">
            <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{err}</span>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-aurora text-primary-foreground rounded-2xl py-3.5 shadow-neon hover:scale-[1.01] transition font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChromeIcon className="h-4 w-4" />}
          Continue with Google
        </button>
      </form>
    </div>
  );
}
