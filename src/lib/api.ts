/**
 * Aurora frontend API client.
 *
 * In development the Vite dev server proxies `/api/*` and `/ws/voice` to the
 * Express backend (default http://localhost:3001), so all calls below use
 * relative URLs and "just work" from the browser.
 *
 * Quick examples:
 *
 *   // Email + password login
 *   await fetch("/api/auth/login", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify({ email, password }),
 *   });
 *
 *   // GOIE — generate fresh opportunities
 *   await fetch("/api/goie/generate", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
 *     body: JSON.stringify({ interests: ["AI", "design"], count: 5 }),
 *   });
 *
 *   // Multiverse — generate alternate futures
 *   await fetch("/api/multiverse/simulate", {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
 *     body: JSON.stringify({ decision: "Should I move to Tokyo?", branches: 3 }),
 *   });
 *
 *   // AI Voice Companion — streaming WebSocket
 *   const socket = new WebSocket(`${location.origin.replace(/^http/, "ws")}/ws/voice`);
 *   socket.onopen = () => socket.send(JSON.stringify({ type: "chat", text: "hi Aurora" }));
 *   socket.onmessage = (e) => console.log(JSON.parse(e.data));
 */

const TOKEN_KEY = "aurora.token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

/**
 * Structured error from the Aurora API. Carries the HTTP status, a stable
 * `code` (e.g. "ai_quota_exceeded") and a human-friendly `hint` so UI pages
 * can render an actionable banner instead of just "500: error".
 */
export class ApiError extends Error {
  status: number;
  code?: string;
  hint?: string;
  providerStatus?: number;
  constructor(message: string, opts: { status: number; code?: string; hint?: string; providerStatus?: number }) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status;
    this.code = opts.code;
    this.hint = opts.hint;
    this.providerStatus = opts.providerStatus;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

async function request<T = unknown>(
  path: string,
  init: RequestInit = {},
  { auth = true }: { auth?: boolean } = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(path, { ...init, headers, credentials: "same-origin" });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) {
    const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
    const message =
      (typeof obj.error === "string" && obj.error) ||
      (typeof obj.message === "string" && obj.message) ||
      `Request failed: ${res.status}`;
    throw new ApiError(String(message), {
      status: res.status,
      code: typeof obj.code === "string" ? obj.code : undefined,
      hint: typeof obj.hint === "string" ? obj.hint : undefined,
      providerStatus: typeof obj.providerStatus === "number" ? obj.providerStatus : undefined,
    });
  }
  return data as T;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body),
});

// ---------------- Auth ----------------
export const auth = {
  register: (body: { name?: string; email: string; password: string }) =>
    request<{ token: string; user: { id: string; email: string } }>(
      "/api/auth/register",
      json(body),
      { auth: false }
    ),
  login: (body: { email: string; password: string }) =>
    request<{ token: string; user: { id: string; email: string } }>(
      "/api/auth/login",
      json(body),
      { auth: false }
    ),
  voiceLogin: (email: string, audio: Blob) => {
    const fd = new FormData();
    fd.append("email", email);
    fd.append("audio", audio, "voice.webm");
    return request<{ token: string; transcript: string; user: { id: string; email: string } }>(
      "/api/auth/voice-login",
      { method: "POST", body: fd },
      { auth: false }
    );
  },
  me: () => request<{ user: unknown }>("/api/auth/me"),
};

// ---------------- AI Life Command Center ----------------
export const commandCenter = {
  plan: (body: {
    goals: string[];
    currentChallenges?: string[];
    timeAvailableHoursPerDay?: number;
    mood?: string;
  }) => request("/api/command-center/plan", json(body)),
  latest: () => request("/api/command-center/latest"),
};

// ---------------- AI chat (general) ----------------
export const ai = {
  chat: (body: {
    messages: { role: "user" | "assistant"; content: string }[];
    system?: string;
    sessionId?: string;
  }) => request<{ reply: string; sessionId: string }>("/api/ai/chat", json(body)),
  sessions: () => request("/api/ai/sessions"),
  session: (id: string) => request(`/api/ai/sessions/${encodeURIComponent(id)}`),
};

// ---------------- Identity Evolution Tracker ----------------
export const identity = {
  get: () => request("/api/identity"),
  update: (body: Record<string, unknown>) =>
    request("/api/identity", { method: "PUT", body: JSON.stringify(body) }),
  insights: (body: { traits: string[]; goals?: string[]; recentReflections?: string[] }) =>
    request("/api/identity/insights", json(body)),
  evolution: () => request("/api/identity/evolution"),
};

// ---------------- Multiverse Simulator ----------------
export const multiverse = {
  simulate: (body: {
    decision: string;
    context?: string;
    branches?: number;
    horizonYears?: number;
  }) => request("/api/multiverse/simulate", json(body)),
  list: () => request("/api/multiverse"),
};

// ---------------- Cinematic Director ----------------
export const cinematic = {
  generate: (body: { theme: string; scenes?: number; tone?: string; protagonist?: string }) =>
    request("/api/cinematic/generate", json(body)),
  list: () => request("/api/cinematic"),
  get: (id: string) => request(`/api/cinematic/${encodeURIComponent(id)}`),
};

// ---------------- Reality Architect Engine ----------------
export const reality = {
  planWeek: (body: {
    vision: string;
    constraints?: string[];
    currentHabits?: string[];
    startDate?: string;
  }) => request("/api/reality/plan-week", json(body)),
  latest: () => request("/api/reality/latest"),
};

// ---------------- Mind Universe Explorer ----------------
export const mind = {
  profile: () => request("/api/mind"),
  decode: (body: { thoughts: string; mood?: string; recent_events?: string[] }) =>
    request("/api/mind/decode", json(body)),
  explore: (body: { responses: Record<string, string> }) =>
    request("/api/mind/explore", json(body)),
  sessions: () => request("/api/mind/sessions"),
};

// ---------------- GOIE ----------------
export const goie = {
  list: (params?: { category?: string; region?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.category) q.set("category", params.category);
    if (params?.region) q.set("region", params.region);
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return request(`/api/goie${qs ? `?${qs}` : ""}`);
  },
  create: (body: { title: string; description?: string; category?: string; region?: string }) =>
    request("/api/goie", json(body)),
  generate: (body: {
    interests?: string[];
    skills?: string[];
    region?: string;
    count?: number;
    timeframe?: "30d" | "90d" | "1y";
  }) => request("/api/goie/generate", json(body)),
  trends: (body: { focus?: string; region?: string }) => request("/api/goie/trends", json(body)),
  delete: (id: string) =>
    request(`/api/goie/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

// ---------------- Ethical Decision Assistant ----------------
export const decision = {
  evaluate: (body: {
    question: string;
    options: string[];
    criteria?: string[];
    stakeholders?: string[];
  }) => request("/api/decision/evaluate", json(body)),
  list: () => request("/api/decision"),
};

// ---------------- Activity & Skill Analyzer ----------------
export const activity = {
  analyze: (body: {
    activities: { name: string; frequencyPerWeek?: number; hoursPerWeek?: number }[];
    skills?: string[];
    ambitions?: string[];
  }) => request("/api/activity/analyze", json(body)),
  latest: () => request("/api/activity/latest"),
};

// ---------------- Smart Onboarding ----------------
export const onboarding = {
  start: () => request("/api/onboarding/start", { method: "POST" }),
  answer: (body: { questionId: string; answer: string }) =>
    request("/api/onboarding/answer", json(body)),
  profile: () => request("/api/onboarding/profile"),
};

// ---------------- Dashboard Intelligence ----------------
export const dashboard = {
  get: () => request("/api/dashboard"),
};

// ---------------- AI Voice Companion (WebSocket) ----------------
export type VoiceMessage =
  | { type: "auth-ok"; userId: string }
  | { type: "pong"; time: number }
  | { type: "stream-start" }
  | { type: "stream-chunk"; text: string }
  | { type: "stream-end"; text: string }
  | { type: "error"; message: string; code?: string; hint?: string; providerStatus?: number };

export function openVoiceCompanion(opts: {
  onMessage: (msg: VoiceMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
} = { onMessage: () => {} }) {
  if (typeof window === "undefined") {
    throw new Error("openVoiceCompanion must be called in the browser");
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${window.location.host}/ws/voice`;
  const socket = new WebSocket(url);
  socket.addEventListener("open", () => {
    const token = getToken();
    if (token) socket.send(JSON.stringify({ type: "auth", token }));
    opts.onOpen?.();
  });
  socket.addEventListener("close", () => opts.onClose?.());
  socket.addEventListener("message", (event) => {
    try { opts.onMessage(JSON.parse(event.data) as VoiceMessage); } catch { /* ignore */ }
  });
  return {
    socket,
    sendChat: (text: string, history: { role: string; content: string }[] = []) =>
      socket.send(JSON.stringify({ type: "chat", text, history })),
    ping: () => socket.send(JSON.stringify({ type: "ping" })),
    close: () => socket.close(),
  };
}

export default {
  auth, ai, commandCenter, identity, multiverse, cinematic, reality, mind,
  goie, decision, activity, onboarding, dashboard, openVoiceCompanion,
  getToken, setToken,
};
