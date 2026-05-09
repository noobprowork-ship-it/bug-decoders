import { useEffect, useRef, useState } from "react";
import {
  X, Mail, Mic, ChromeIcon, Loader2, AlertTriangle,
  Square, Sparkles, Linkedin, Github, Link2,
} from "lucide-react";
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
        className="relative w-full max-w-md glass-strong rounded-3xl shadow-soft overflow-y-auto max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-7">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 rounded-full glass flex items-center justify-center hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {mode === "email"  && <EmailPanel  onSuccess={onSuccess} />}
          {mode === "voice"  && <VoicePanel  onSuccess={onSuccess} />}
          {mode === "google" && <GooglePanel onSuccess={onSuccess} />}
        </div>
      </div>
    </div>
  );
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

function Field({
  type = "text", placeholder, value, onChange, autoComplete, icon: Icon, rows,
}: {
  type?: string; placeholder: string; value: string;
  onChange: (v: string) => void; autoComplete?: string;
  icon?: React.ElementType; rows?: number;
}) {
  const cls =
    "w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary";
  const inner = (
    <>
      {Icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
          <Icon className="h-3.5 w-3.5" />
        </span>
      )}
      {rows ? (
        <textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className={`${cls} resize-none ${Icon ? "pl-9" : ""}`}
        />
      ) : (
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={`${cls} ${Icon ? "pl-9" : ""}`}
        />
      )}
    </>
  );
  return <div className="relative">{inner}</div>;
}

function ErrMsg({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 text-xs text-[oklch(0.7_0.22_320)]">
      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
      <span>{text}</span>
    </div>
  );
}

function SubmitBtn({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full bg-aurora text-primary-foreground rounded-2xl py-3.5 shadow-neon hover:scale-[1.01] transition font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

/* ── Email login / signup ────────────────────────────────────────────────── */
function EmailPanel({ onSuccess }: { onSuccess: () => void }) {
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!email.trim() || !password.trim()) { setErr("Email and password are required."); return; }
    setLoading(true);
    try {
      const profileLinks = tab === "signup"
        ? {
            linkedin:  linkedin.trim() || undefined,
            github:    github.trim() || undefined,
            portfolio: portfolio.trim() || undefined,
          }
        : undefined;

      const resp =
        tab === "signin"
          ? await auth.login({ email: email.trim(), password })
          : await auth.register({
              name: name.trim() || undefined,
              email: email.trim(),
              password,
              ...(profileLinks && Object.keys(profileLinks).some(Boolean) ? { bio: profileLinks } : {}),
            });

      setToken(resp.token);
      setStoredUser({
        id:    (resp.user as { id?: string })?.id,
        email: resp.user?.email,
        name:  (resp.user as { name?: string })?.name || (tab === "signup" ? name.trim() || undefined : undefined),
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
              tab === t
                ? "bg-aurora text-primary-foreground shadow-neon"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "signin" ? "Sign in" : "Sign up"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3">
        {tab === "signup" && (
          <Field placeholder="Full name (optional)" value={name} onChange={setName} />
        )}
        <Field
          type="email" placeholder="you@example.com" value={email}
          onChange={setEmail} autoComplete="email"
        />
        <Field
          type="password" placeholder="Password" value={password}
          onChange={setPassword}
          autoComplete={tab === "signin" ? "current-password" : "new-password"}
        />

        {tab === "signup" && (
          <>
            <div className="pt-1 pb-0.5">
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
                Profile links (optional)
              </div>
              <div className="space-y-2">
                <Field
                  type="url" placeholder="LinkedIn URL" value={linkedin}
                  onChange={setLinkedin} icon={Linkedin}
                />
                <Field
                  type="url" placeholder="GitHub URL" value={github}
                  onChange={setGithub} icon={Github}
                />
                <Field
                  type="url" placeholder="Portfolio / website URL" value={portfolio}
                  onChange={setPortfolio} icon={Link2}
                />
              </div>
            </div>
          </>
        )}

        {err && <ErrMsg text={err} />}

        <SubmitBtn loading={loading}>
          <Sparkles className="h-4 w-4" />
          {tab === "signin" ? "Sign in" : "Create account"}
        </SubmitBtn>
      </form>
    </div>
  );
}

/* ── Voice login ─────────────────────────────────────────────────────────── */
function VoicePanel({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [recording, setRecording] = useState(false);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const recRef    = useRef<MediaRecorder | null>(null);
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

  function stop() { recRef.current?.stop(); setRecording(false); }

  async function submit() {
    if (!email.trim()) return setErr("Email is required.");
    if (!audio) return setErr("Record a short voice phrase first.");
    setSubmitting(true); setErr(null);
    try {
      const resp = await auth.voiceLogin(email.trim(), audio);
      setToken(resp.token);
      setStoredUser({
        id:    resp.user?.id,
        email: resp.user?.email,
        name:  (resp.user as { name?: string })?.name,
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

      <Field
        type="email" placeholder="Your email" value={email}
        onChange={setEmail} autoComplete="email"
      />
      <div className="mt-4 glass rounded-2xl p-5 mb-4 flex flex-col items-center">
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

      {err && <div className="mb-3"><ErrMsg text={err} /></div>}
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

/* ── Google / profile link ───────────────────────────────────────────────── */
function GooglePanel({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail]       = useState("");
  const [name, setName]         = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [bioText, setBioText]   = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub]     = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setErr("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const bioPayload: Record<string, string> = {};
      if (bioText.trim())   bioPayload.about     = bioText.trim();
      if (linkedin.trim())  bioPayload.linkedin   = linkedin.trim();
      if (github.trim())    bioPayload.github     = github.trim();
      if (portfolio.trim()) bioPayload.portfolio  = portfolio.trim();

      const resp = await auth.google({
        email:    email.trim(),
        name:     name.trim() || undefined,
        photoUrl: photoUrl.trim() || undefined,
        bio:      Object.keys(bioPayload).length ? bioPayload : undefined,
      });
      setToken(resp.token);
      setStoredUser({
        id:       resp.user?.id,
        email:    resp.user?.email,
        name:     resp.user?.name || name.trim() || undefined,
        photoUrl: resp.user?.photoUrl || photoUrl.trim() || undefined,
        tier:     resp.user?.tier,
      });
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sign-in failed.");
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
        <Field
          type="email" placeholder="you@gmail.com" value={email}
          onChange={setEmail} autoComplete="email"
        />
        <Field placeholder="Full name" value={name} onChange={setName} />
        <Field
          type="url" placeholder="Profile photo URL (optional)"
          value={photoUrl} onChange={setPhotoUrl}
        />
        <Field
          placeholder="A short bio so Aurora gets you (optional)"
          value={bioText} onChange={setBioText} rows={2}
        />

        <div className="pt-1">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Profile links (optional)
          </div>
          <div className="space-y-2">
            <Field
              type="url" placeholder="LinkedIn URL" value={linkedin}
              onChange={setLinkedin} icon={Linkedin}
            />
            <Field
              type="url" placeholder="GitHub URL" value={github}
              onChange={setGithub} icon={Github}
            />
            <Field
              type="url" placeholder="Portfolio / website URL" value={portfolio}
              onChange={setPortfolio} icon={Link2}
            />
          </div>
        </div>

        {err && <ErrMsg text={err} />}

        <SubmitBtn loading={loading}>
          <ChromeIcon className="h-4 w-4" />
          Continue with Google
        </SubmitBtn>
      </form>
    </div>
  );
}
