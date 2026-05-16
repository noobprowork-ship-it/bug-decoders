/**
 * LifeOS Login Modal
 *
 * When VITE_GOOGLE_CLIENT_ID is set:
 *   • Loads Google Identity Services (script already in __root.tsx)
 *   • Triggers the One-Tap auto-prompt (auto_select: true) immediately —
 *     the user is signed in with zero clicks if they have an active Google
 *     session in the browser.
 *   • Renders Google's branded button as a fallback if the prompt is dismissed.
 *   • Offers email/password below as an "other account" path.
 *
 * When VITE_GOOGLE_CLIENT_ID is NOT set:
 *   • Shows a clean email / password form with no Google references.
 *   • Users never see a broken or half-configured Google button.
 *
 * Session persistence: the JWT is stored in localStorage ("aurora.token").
 * On every app boot the Shell reads it and skips the modal entirely.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X, Mail, Loader2, AlertTriangle,
  Sparkles, Eye, EyeOff, Lock, User as UserIcon,
  Linkedin, Github, Link2,
} from "lucide-react";
import { auth, setToken } from "@/lib/api";
import { setStoredUser } from "@/lib/user";

/* ── Google Identity Services type shim ──────────────────────────────────── */
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
            itp_support?: boolean;
          }): void;
          renderButton(parent: HTMLElement, cfg: object): void;
          prompt(cb?: (n: {
            isNotDisplayed(): boolean;
            isSkippedMoment(): boolean;
            getMomentType(): string;
          }) => void): void;
          cancel(): void;
          disableAutoSelect(): void;
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
        className="relative w-full max-w-[420px] glass-strong rounded-3xl shadow-soft overflow-y-auto max-h-[90dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-8 w-8 rounded-full glass flex items-center justify-center hover:bg-white/10 z-10"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-7">
          {mode === "signin" ? (
            <SignInPanel
              onSuccess={onSuccess}
              onCreateAccount={() => setMode("signup")}
            />
          ) : (
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

/* ── Shared primitives ───────────────────────────────────────────────────── */

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
  type = "text", label, placeholder, value, onChange, autoComplete, icon: Icon,
}: {
  type?: string; label?: string; placeholder: string; value: string;
  onChange: (v: string) => void; autoComplete?: string;
  icon?: React.ElementType;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const inputType  = isPassword ? (show ? "text" : "password") : type;
  const base = "w-full glass rounded-2xl px-3 py-3 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary transition";

  return (
    <div>
      {label && <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>}
      <div className="relative">
        {Icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
        <input
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={`${base} ${Icon ? "pl-9" : ""} ${isPassword ? "pr-10" : ""}`}
        />
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

const GoogleLogo = () => (
  <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const Divider = ({ label }: { label: string }) => (
  <div className="flex items-center gap-3 my-4">
    <div className="flex-1 h-px bg-border/60" />
    <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">{label}</span>
    <div className="flex-1 h-px bg-border/60" />
  </div>
);

/* ── Sign-In Panel ───────────────────────────────────────────────────────── */
function SignInPanel({
  onSuccess,
  onCreateAccount,
}: { onSuccess: () => void; onCreateAccount: () => void }) {
  const clientId: string | undefined = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-7">
        <div className="h-14 w-14 rounded-2xl bg-aurora flex items-center justify-center mb-4 shadow-neon">
          <Sparkles className="h-7 w-7 text-primary-foreground" />
        </div>
        <h2 className="font-display text-2xl font-bold">Welcome back</h2>
        <p className="text-sm text-muted-foreground mt-1">Sign in to continue to LifeOS</p>
      </div>

      {clientId ? (
        <GoogleOneTapSignIn
          clientId={clientId}
          onSuccess={onSuccess}
          onCreateAccount={onCreateAccount}
        />
      ) : (
        <EmailSignIn onSuccess={onSuccess} onCreateAccount={onCreateAccount} />
      )}
    </div>
  );
}

/* ── Google One-Tap (when VITE_GOOGLE_CLIENT_ID is configured) ───────────── */
function GoogleOneTapSignIn({
  clientId,
  onSuccess,
  onCreateAccount,
}: { clientId: string; onSuccess: () => void; onCreateAccount: () => void }) {
  const [gsiStatus, setGsiStatus]     = useState<"loading" | "ready" | "failed">("loading");
  const [authLoading, setAuthLoading] = useState(false);
  const [showEmail, setShowEmail]     = useState(false);
  const [err, setErr]                 = useState<string | null>(null);
  const buttonRef                     = useRef<HTMLDivElement>(null);

  const handleCredential = useCallback(async (response: { credential: string }) => {
    setAuthLoading(true);
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
      setErr(e instanceof Error ? e.message : "Google sign-in failed. Please try again.");
      setAuthLoading(false);
    }
  }, [onSuccess]);

  useEffect(() => {
    if (!clientId) return;

    let ticker: ReturnType<typeof setInterval> | undefined;
    let tries = 0;

    const tryInit = () => {
      tries++;
      const g = window.google?.accounts?.id;
      if (!g) {
        if (tries > 40) { setGsiStatus("failed"); clearInterval(ticker); }
        return;
      }

      clearInterval(ticker);

      g.initialize({
        client_id:             clientId,
        callback:              handleCredential,
        auto_select:           true,   // ← sign in automatically if only one Google account
        cancel_on_tap_outside: true,
        context:               "signin",
        itp_support:           true,   // ← ITP support for Safari
      });

      if (buttonRef.current) {
        g.renderButton(buttonRef.current, {
          theme:          "outline",
          size:           "large",
          text:           "continue_with",
          shape:          "rectangular",
          width:          370,
          logo_alignment: "left",
        });
      }

      setGsiStatus("ready");

      // Fire the prompt — auto_select means it may resolve silently
      g.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // One-Tap was suppressed — the rendered button below still works
        }
      });
    };

    ticker = setInterval(tryInit, 150);
    return () => clearInterval(ticker);
  }, [clientId, handleCredential]);

  if (authLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span>Signing you in with Google…</span>
      </div>
    );
  }

  return (
    <div>
      {/* Google branded button */}
      <div className="min-h-[44px] flex items-center justify-center">
        {gsiStatus === "loading" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading Google sign-in…
          </div>
        )}
        {gsiStatus === "failed" && (
          <button
            type="button"
            onClick={() => setShowEmail(true)}
            className="w-full glass border border-border/60 rounded-2xl py-3 px-4 flex items-center justify-center gap-3 text-sm font-medium hover:bg-white/5 transition"
          >
            <GoogleLogo /> Continue with Google
          </button>
        )}
        <div ref={buttonRef} className={gsiStatus === "ready" ? "w-full" : "hidden"} />
      </div>

      {err && <div className="mt-3"><ErrMsg text={err} /></div>}

      <Divider label="or" />

      {showEmail ? (
        <EmailSignIn onSuccess={onSuccess} onCreateAccount={onCreateAccount} />
      ) : (
        <button
          type="button"
          onClick={() => setShowEmail(true)}
          className="w-full glass border border-border/40 rounded-2xl py-3 px-4 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition"
        >
          <Mail className="h-4 w-4" /> Use email &amp; password
        </button>
      )}

      <p className="text-center text-xs text-muted-foreground mt-5">
        No account?{" "}
        <button onClick={onCreateAccount} className="text-primary hover:underline font-medium">
          Create one free
        </button>
      </p>
    </div>
  );
}

/* ── Email Sign-In (primary when no Google, secondary when Google is on) ─── */
function EmailSignIn({
  onSuccess,
  onCreateAccount,
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
        id:    (resp.user as any)?.id,
        email: resp.user?.email,
        name:  (resp.user as any)?.name,
      });
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sign-in failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field
        type="email" label="Email" placeholder="you@example.com"
        value={email} onChange={setEmail}
        autoComplete="email" icon={Mail}
      />
      <Field
        type="password" label="Password" placeholder="••••••••"
        value={password} onChange={setPassword}
        autoComplete="current-password" icon={Lock}
      />
      {err && <ErrMsg text={err} />}
      <SubmitBtn loading={loading}>
        <Sparkles className="h-4 w-4" /> Sign in
      </SubmitBtn>
      <p className="text-center text-xs text-muted-foreground pt-1">
        No account?{" "}
        <button type="button" onClick={onCreateAccount} className="text-primary hover:underline font-medium">
          Create one free
        </button>
      </p>
    </form>
  );
}

/* ── Create Account Panel ────────────────────────────────────────────────── */
function CreateAccountPanel({
  onSuccess,
  onSignIn,
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
    if (!email.trim())        { setErr("Email is required.");                       return; }
    if (!password.trim())     { setErr("Password is required.");                    return; }
    if (password.length < 6)  { setErr("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const bio: Record<string, string> = {};
      if (linkedin.trim())  bio.linkedin  = linkedin.trim();
      if (github.trim())    bio.github    = github.trim();
      if (portfolio.trim()) bio.portfolio = portfolio.trim();

      const resp = await auth.register({
        name:     name.trim() || undefined,
        email:    email.trim(),
        password,
        ...(Object.keys(bio).length ? { bio } : {}),
      });
      setToken(resp.token);
      setStoredUser({
        id:    (resp.user as any)?.id,
        email: resp.user?.email,
        name:  (resp.user as any)?.name || name.trim() || undefined,
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
      {/* Header */}
      <div className="flex flex-col items-center text-center mb-7">
        <div className="h-14 w-14 rounded-2xl bg-aurora flex items-center justify-center mb-4 shadow-neon">
          <UserIcon className="h-7 w-7 text-primary-foreground" />
        </div>
        <h2 className="font-display text-2xl font-bold">Create account</h2>
        <p className="text-sm text-muted-foreground mt-1">Join LifeOS — your AI life OS</p>
      </div>

      <form onSubmit={submit} className="space-y-3">
        <Field
          label="Full name" placeholder="Your name (optional)"
          value={name} onChange={setName} icon={UserIcon}
        />
        <Field
          type="email" label="Email" placeholder="you@example.com"
          value={email} onChange={setEmail}
          autoComplete="email" icon={Mail}
        />
        <Field
          type="password" label="Password" placeholder="Min 6 characters"
          value={password} onChange={setPassword}
          autoComplete="new-password" icon={Lock}
        />

        <div className="pt-1">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Profile links (optional)
          </div>
          <div className="space-y-2">
            <Field type="url" placeholder="LinkedIn profile URL" value={linkedin} onChange={setLinkedin} icon={Linkedin} />
            <Field type="url" placeholder="GitHub profile URL"   value={github}   onChange={setGithub}   icon={Github} />
            <Field type="url" placeholder="Portfolio / website"  value={portfolio} onChange={setPortfolio} icon={Link2} />
          </div>
        </div>

        {err && <ErrMsg text={err} />}

        <SubmitBtn loading={loading}>
          <Sparkles className="h-4 w-4" /> Create account
        </SubmitBtn>
      </form>

      <p className="text-center text-xs text-muted-foreground mt-4">
        Already have an account?{" "}
        <button type="button" onClick={onSignIn} className="text-primary hover:underline font-medium">
          Sign in
        </button>
      </p>
    </div>
  );
}
