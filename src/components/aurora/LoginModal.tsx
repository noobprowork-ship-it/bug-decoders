/**
 * LifeOS Login Modal
 *
 * Sign In:        Real Google One-Tap (Google Identity Services)
 *                 Falls back to email/password if VITE_GOOGLE_CLIENT_ID is not set.
 * Create Account: Email / password registration (unchanged).
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X, Mail, Loader2, AlertTriangle,
  Sparkles, Linkedin, Github, Link2, Eye, EyeOff,
} from "lucide-react";
import { auth, setToken } from "@/lib/api";
import { setStoredUser } from "@/lib/user";

/* ── Google Identity Services global type ──────────────────────────────── */
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(cfg: {
            client_id: string;
            callback: (r: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            context?: string;
          }): void;
          renderButton(parent: HTMLElement, cfg: object): void;
          prompt(cb?: (n: {
            isNotDisplayed(): boolean;
            isSkippedMoment(): boolean;
          }) => void): void;
          cancel(): void;
        };
      };
    };
  }
}

export type LoginMode = "signin" | "signup";

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

          {/* Tab switcher */}
          <div className="flex gap-2 mb-6 glass rounded-2xl p-1">
            <button
              onClick={() => setMode("signin")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${
                mode === "signin"
                  ? "bg-aurora text-primary-foreground shadow-neon"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${
                mode === "signup"
                  ? "bg-aurora text-primary-foreground shadow-neon"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Create Account
            </button>
          </div>

          {mode === "signin" && (
            <GoogleSignInPanel
              onSuccess={onSuccess}
              onCreateAccount={() => setMode("signup")}
            />
          )}
          {mode === "signup" && (
            <CreateAccountPanel
              onSuccess={onSuccess}
              onSignIn={() => setMode("signin")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Shared helpers ─────────────────────────────────────────────────────── */

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
  const base = "w-full glass rounded-2xl p-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary";

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
            className={`${base} resize-none ${Icon ? "pl-9" : ""}`}
          />
        ) : (
          <input
            type={inputType} placeholder={placeholder} value={value}
            onChange={(e) => onChange(e.target.value)}
            autoComplete={autoComplete}
            className={`${base} ${Icon ? "pl-9" : ""} ${isPassword ? "pr-10" : ""}`}
          />
        )}
        {isPassword && (
          <button type="button" onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}

const GoogleLogo = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

/* ── Google Sign-In Panel (One-Tap) ─────────────────────────────────────── */
function GoogleSignInPanel({
  onSuccess, onCreateAccount,
}: { onSuccess: () => void; onCreateAccount: () => void }) {
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [err, setErr]       = useState<string | null>(null);
  const buttonRef           = useRef<HTMLDivElement>(null);
  const clientId            = (import.meta as Record<string, unknown>).env
    ? ((import.meta as Record<string, unknown>).env as Record<string, string>).VITE_GOOGLE_CLIENT_ID
    : undefined;

  const handleCredential = useCallback(async (response: { credential: string }) => {
    setStatus("loading");
    setErr(null);
    try {
      const resp = await auth.googleOneTap({ credential: response.credential });
      setToken(resp.token);
      setStoredUser({
        id:       resp.user?.id,
        email:    resp.user?.email,
        name:     resp.user?.name,
        photoUrl: resp.user?.photoUrl,
        tier:     resp.user?.tier,
      });
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sign-in failed. Please try again.");
      setStatus("idle");
    }
  }, [onSuccess]);

  useEffect(() => {
    if (!clientId) return;

    let interval: ReturnType<typeof setInterval> | null = null;

    const init = () => {
      const g = window.google?.accounts?.id;
      if (!g) return false;

      g.initialize({
        client_id:             clientId,
        callback:              handleCredential,
        auto_select:           false,
        cancel_on_tap_outside: true,
        context:               "signin",
      });

      if (buttonRef.current) {
        g.renderButton(buttonRef.current, {
          theme:  "outline",
          size:   "large",
          text:   "continue_with",
          shape:  "rectangular",
          width:  380,
          logo_alignment: "left",
        });
      }

      // Trigger One-Tap prompt (may not show if already dismissed)
      g.prompt();
      return true;
    };

    if (!init()) {
      interval = setInterval(() => {
        if (init()) { clearInterval(interval!); interval = null; }
      }, 150);
    }

    return () => { if (interval) clearInterval(interval); };
  }, [clientId, handleCredential]);

  // ── Google not configured — graceful fallback to email sign-in ───────────
  if (!clientId) {
    return <EmailSignInFallback onSuccess={onSuccess} onCreateAccount={onCreateAccount} />;
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-11 w-11 rounded-2xl bg-aurora flex items-center justify-center">
          <GoogleLogo />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Sign in with Google</h2>
          <p className="text-xs text-muted-foreground">Choose your Google account to continue</p>
        </div>
      </div>

      {/* Google renders its branded button into this div */}
      <div
        ref={buttonRef}
        className="w-full min-h-[44px] flex items-center justify-center mb-4"
      />

      {status === "loading" && (
        <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Signing you in…
        </div>
      )}

      {err && <div className="mt-2"><ErrMsg text={err} /></div>}

      <p className="text-center text-xs text-muted-foreground mt-5">
        No account?{" "}
        <button onClick={onCreateAccount} className="text-primary hover:underline font-medium">
          Create one free
        </button>
      </p>
    </div>
  );
}

/* ── Email Sign-In Fallback (no Google Client ID configured) ────────────── */
function EmailSignInFallback({
  onSuccess, onCreateAccount,
}: { onSuccess: () => void; onCreateAccount: () => void }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!email.trim())    { setErr("Email is required.");    return; }
    if (!password.trim()) { setErr("Password is required."); return; }
    setLoading(true);
    try {
      const resp = await auth.login({ email: email.trim(), password });
      setToken(resp.token);
      setStoredUser({
        id:    (resp.user as { id?: string })?.id,
        email: resp.user?.email,
        name:  (resp.user as { name?: string })?.name,
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
      <div className="flex items-center gap-3 mb-5">
        <div className="h-11 w-11 rounded-2xl bg-aurora flex items-center justify-center">
          <Mail className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-display text-xl font-bold">Sign in</h2>
          <p className="text-xs text-muted-foreground">Use your LifeOS credentials</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <Field type="email" label="Email" placeholder="you@example.com"
          value={email} onChange={setEmail} autoComplete="email" />
        <Field type="password" label="Password" placeholder="••••••••"
          value={password} onChange={setPassword} autoComplete="current-password" />
        {err && <ErrMsg text={err} />}
        <SubmitBtn loading={loading}>
          <Sparkles className="h-4 w-4" /> Sign in
        </SubmitBtn>
      </form>

      <p className="text-center text-xs text-muted-foreground mt-4">
        No account?{" "}
        <button onClick={onCreateAccount} className="text-primary hover:underline">
          Create one free
        </button>
      </p>
    </div>
  );
}

/* ── Create Account Panel (email / password signup — unchanged) ─────────── */
function CreateAccountPanel({
  onSuccess, onSignIn,
}: { onSuccess: () => void; onSignIn: () => void }) {
  const [name, setName]           = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [linkedin, setLinkedin]   = useState("");
  const [github, setGithub]       = useState("");
  const [portfolio, setPortfolio] = useState("");
  const [loading, setLoading]     = useState(false);
  const [err, setErr]             = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!email.trim())        { setErr("Email is required.");                        return; }
    if (!password.trim())     { setErr("Password is required.");                     return; }
    if (password.length < 6)  { setErr("Password must be at least 6 characters.");  return; }
    setLoading(true);
    try {
      const bio: Record<string, string> = {};
      if (linkedin.trim())  bio.linkedin  = linkedin.trim();
      if (github.trim())    bio.github    = github.trim();
      if (portfolio.trim()) bio.portfolio = portfolio.trim();

      const resp = await auth.register({
        name: name.trim() || undefined,
        email: email.trim(),
        password,
        ...(Object.keys(bio).length ? { bio } : {}),
      });
      setToken(resp.token);
      setStoredUser({
        id:    (resp.user as { id?: string })?.id,
        email: resp.user?.email,
        name:  (resp.user as { name?: string })?.name || name.trim() || undefined,
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
          <h2 className="font-display text-xl font-bold">Create account</h2>
          <p className="text-xs text-muted-foreground">Join LifeOS — your AI life OS</p>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <Field placeholder="Full name (optional)" label="Name" value={name} onChange={setName} />
        <Field type="email" label="Email" placeholder="you@example.com"
          value={email} onChange={setEmail} autoComplete="email" />
        <Field type="password" label="Password" placeholder="••••••••"
          value={password} onChange={setPassword} autoComplete="new-password" />

        <div className="pt-1">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Profile links (optional)
          </div>
          <div className="space-y-2">
            <Field type="url" placeholder="LinkedIn URL"   value={linkedin}   onChange={setLinkedin}   icon={Linkedin} />
            <Field type="url" placeholder="GitHub URL"     value={github}     onChange={setGithub}     icon={Github} />
            <Field type="url" placeholder="Portfolio URL"  value={portfolio}  onChange={setPortfolio}  icon={Link2} />
          </div>
        </div>

        {err && <ErrMsg text={err} />}

        <SubmitBtn loading={loading}>
          <Sparkles className="h-4 w-4" /> Create account
        </SubmitBtn>
      </form>

      <p className="text-center text-xs text-muted-foreground mt-4">
        Already have an account?{" "}
        <button onClick={onSignIn} className="text-primary hover:underline">
          Sign in
        </button>
      </p>
    </div>
  );
}
