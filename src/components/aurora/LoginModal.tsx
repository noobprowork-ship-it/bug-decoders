/**
 * LifeOS Login Modal
 *
 * Two login methods:
 *  - Email / Password (register or sign in)
 *  - Google (form-based — collects Google email + name → backend creates/reloads account)
 *
 * Voice login has been removed in favour of a simpler, more reliable UX.
 */

import { useState } from "react";
import {
  X, Mail, ChromeIcon, Loader2, AlertTriangle,
  Sparkles, Linkedin, Github, Link2, Eye, EyeOff,
} from "lucide-react";
import { auth, setToken } from "@/lib/api";
import { setStoredUser } from "@/lib/user";

export type LoginMode = "email" | "google";

export function LoginModal({
  mode: initialMode,
  onClose,
  onSuccess,
}: {
  mode: LoginMode;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<LoginMode>(initialMode);

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
            className="absolute top-4 right-4 h-8 w-8 rounded-full glass flex items-center justify-center hover:bg-white/10 z-10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Mode switcher */}
          <div className="flex gap-2 mb-6 glass rounded-2xl p-1">
            <button
              onClick={() => setMode("email")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition ${
                mode === "email"
                  ? "bg-aurora text-primary-foreground shadow-neon"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Mail className="h-3.5 w-3.5" /> Email
            </button>
            <button
              onClick={() => setMode("google")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition ${
                mode === "google"
                  ? "bg-aurora text-primary-foreground shadow-neon"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ChromeIcon className="h-3.5 w-3.5" /> Google
            </button>
          </div>

          {mode === "email"  && <EmailPanel  onSuccess={onSuccess} />}
          {mode === "google" && <GooglePanel onSuccess={onSuccess} />}
        </div>
      </div>
    </div>
  );
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

function Field({
  type = "text", label, placeholder, value, onChange, autoComplete, icon: Icon, rows,
}: {
  type?: string; label?: string; placeholder: string; value: string;
  onChange: (v: string) => void; autoComplete?: string;
  icon?: React.ElementType; rows?: number;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const inputType  = isPassword ? (show ? "text" : "password") : type;

  const cls = "w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary";
  const padLeft  = Icon ? "pl-9" : "";
  const padRight = isPassword ? "pr-10" : "";

  return (
    <div>
      {label && <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>}
      <div className="relative">
        {Icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
        {rows ? (
          <textarea
            placeholder={placeholder} value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={rows}
            className={`${cls} resize-none ${padLeft}`}
          />
        ) : (
          <input
            type={inputType} placeholder={placeholder} value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete={autoComplete}
            className={`${cls} ${padLeft} ${padRight}`}
          />
        )}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

function ErrMsg({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 text-xs text-[oklch(0.7_0.22_320)] glass rounded-xl p-2.5">
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
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub]     = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!email.trim())    { setErr("Email is required.");    return; }
    if (!password.trim()) { setErr("Password is required."); return; }
    if (password.length < 6 && tab === "signup") { setErr("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const bio = tab === "signup" ? {
        linkedin:  linkedin.trim()  || undefined,
        github:    github.trim()    || undefined,
        portfolio: portfolio.trim() || undefined,
      } : undefined;

      const resp =
        tab === "signin"
          ? await auth.login({ email: email.trim(), password })
          : await auth.register({
              name: name.trim() || undefined,
              email: email.trim(),
              password,
              ...(bio && Object.values(bio).some(Boolean) ? { bio } : {}),
            });

      setToken(resp.token);
      setStoredUser({
        id:    (resp.user as { id?: string })?.id,
        email: resp.user?.email,
        name:  (resp.user as { name?: string })?.name || (tab === "signup" ? name.trim() || undefined : undefined),
      });
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong. Please try again.");
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
          <p className="text-xs text-muted-foreground">Use your LifeOS email & password</p>
        </div>
      </div>

      <div className="flex gap-2 mb-5 glass rounded-2xl p-1">
        {(["signin", "signup"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setErr(null); }}
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
          <Field placeholder="Full name (optional)" label="Name" value={name} onChange={setName} />
        )}
        <Field
          type="email" label="Email" placeholder="you@example.com"
          value={email} onChange={setEmail} autoComplete="email"
        />
        <Field
          type="password" label="Password" placeholder="••••••••"
          value={password} onChange={setPassword}
          autoComplete={tab === "signin" ? "current-password" : "new-password"}
        />

        {tab === "signup" && (
          <div className="pt-1">
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Profile links (optional)
            </div>
            <div className="space-y-2">
              <Field type="url" placeholder="LinkedIn URL" value={linkedin} onChange={setLinkedin} icon={Linkedin} />
              <Field type="url" placeholder="GitHub URL"   value={github}   onChange={setGithub}   icon={Github} />
              <Field type="url" placeholder="Portfolio URL" value={portfolio} onChange={setPortfolio} icon={Link2} />
            </div>
          </div>
        )}

        {err && <ErrMsg text={err} />}

        <SubmitBtn loading={loading}>
          <Sparkles className="h-4 w-4" />
          {tab === "signin" ? "Sign in" : "Create account"}
        </SubmitBtn>
      </form>

      {tab === "signin" && (
        <p className="text-center text-xs text-muted-foreground mt-4">
          No account yet?{" "}
          <button onClick={() => { setTab("signup"); setErr(null); }} className="text-primary hover:underline">
            Create one free
          </button>
        </p>
      )}
    </div>
  );
}

/* ── Google / profile ────────────────────────────────────────────────────── */
function GooglePanel({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail]         = useState("");
  const [name, setName]           = useState("");
  const [photoUrl, setPhotoUrl]   = useState("");
  const [bioText, setBioText]     = useState("");
  const [linkedin, setLinkedin]   = useState("");
  const [github, setGithub]       = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [loading, setLoading]     = useState(false);
  const [err, setErr]             = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setErr("Please enter a valid email address."); return;
    }
    if (!name.trim()) {
      setErr("Please enter your name."); return;
    }
    setLoading(true);
    try {
      const bioPayload: Record<string, string> = {};
      if (bioText.trim())   bioPayload.about    = bioText.trim();
      if (linkedin.trim())  bioPayload.linkedin  = linkedin.trim();
      if (github.trim())    bioPayload.github    = github.trim();
      if (portfolio.trim()) bioPayload.portfolio = portfolio.trim();

      const resp = await auth.google({
        email:    email.trim(),
        name:     name.trim(),
        photoUrl: photoUrl.trim() || undefined,
        bio:      Object.keys(bioPayload).length ? bioPayload : undefined,
      });
      setToken(resp.token);
      setStoredUser({
        id:       resp.user?.id,
        email:    resp.user?.email,
        name:     resp.user?.name || name.trim(),
        photoUrl: resp.user?.photoUrl || photoUrl.trim() || undefined,
        tier:     resp.user?.tier,
      });
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div className="h-11 w-11 rounded-2xl bg-aurora flex items-center justify-center">
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path fill="white" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="white" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="white" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="white" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Continue with Google</h2>
          <p className="text-xs text-muted-foreground">Enter your Google account details</p>
        </div>
      </div>

      <div className="text-xs text-muted-foreground mb-4 glass rounded-xl p-3 leading-relaxed">
        Enter your Google email and name. Your account will be created or reloaded with your real Google profile — saved securely to our database.
      </div>

      <form onSubmit={submit} className="space-y-3">
        <Field type="email" label="Google email" placeholder="you@gmail.com" value={email} onChange={setEmail} autoComplete="email" />
        <Field label="Full name" placeholder="Your name" value={name} onChange={setName} />
        <Field type="url" label="Profile photo URL (optional)" placeholder="https://…" value={photoUrl} onChange={setPhotoUrl} />
        <Field label="Short bio (optional)" placeholder="What you do, what you're building…" value={bioText} onChange={setBioText} rows={2} />

        <div className="pt-1">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Profile links (optional)</div>
          <div className="space-y-2">
            <Field type="url" placeholder="LinkedIn URL" value={linkedin} onChange={setLinkedin} icon={Linkedin} />
            <Field type="url" placeholder="GitHub URL"   value={github}   onChange={setGithub}   icon={Github} />
            <Field type="url" placeholder="Portfolio URL" value={portfolio} onChange={setPortfolio} icon={Link2} />
          </div>
        </div>

        {err && <ErrMsg text={err} />}

        <SubmitBtn loading={loading}>
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          </svg>
          Continue with Google
        </SubmitBtn>
      </form>
    </div>
  );
}
