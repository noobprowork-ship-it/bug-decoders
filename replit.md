# LifeOS

## Overview
A TanStack Start (React 19 + Vite 7) single-page/SSR application themed as **"LifeOS — Your Life, Operated"** (formerly "Aurora Mind OS"). UI is built with shadcn-style components (Radix UI primitives + Tailwind CSS v4). All visible product copy uses LifeOS branding; the `src/components/aurora/` folder name is preserved internally to avoid breaking imports.

## Recent Changes (2026-04-28)
- **Explore feature** added: new sidebar route `/explore` (`src/routes/explore.tsx`) backed by `POST /api/explore/insights` (`backend/src/controllers/exploreController.js` + `backend/src/routes/explore.js`). Frontend tracks anonymous in-app activity in `localStorage` via `src/lib/activityTracker.ts` (page-view + action events with 7-day rollups). The Explore page shows an activity dashboard (sessions, actions, in-app minutes, top pages, top actions) and a "Generate insights" button that posts the rolled-up summary to the backend, which returns a structured behavioral report (engagement score, hidden skills, interests, behavior patterns, career paths, recommendations, weekly report). Works without the AI provider thanks to a deterministic local fallback.
- **Theme toggle** added: light/dark switcher in the sidebar (`src/components/aurora/ThemeToggle.tsx`, helpers in `src/lib/theme.ts`). The choice is persisted to `localStorage` and applied via a `.light` / `.dark` class on `<html>`. A new `.light` palette in `src/styles.css` reskins surfaces (background, glass, borders) while keeping the LifeOS neon primary/accent colors.
- **Voice replies** added to the AI Assistant + Voice page: assistant streams now finish with browser SpeechSynthesis playback in a female voice (`src/lib/voice.ts` — picks Samantha / Aria / Jenny / Zira when available, falls back to any English female voice). A speaker (Volume2/VolumeX) toggle in both UIs lets the user mute, and the choice is persisted.
- **Stored user** added: `src/lib/user.ts` saves the logged-in user's name + email to `localStorage` from all three sign-in flows in `LoginModal` (email, Google demo, voice). The sidebar now shows the real name/initial in the bottom pill, and the dashboard greeting falls back to the stored name when the API hasn't responded yet.
- **Mind Map UX** upgraded (`src/components/aurora/MindMap.tsx`): zoom in / zoom out / fit-to-screen buttons, ⌘/Ctrl+scroll to zoom, drag-to-pan when zoomed in, fully responsive via SVG `viewBox`.
- **Cinematic image generation** hardened: `gpt-image-1` is the primary model with an automatic fallback to `dall-e-3` (or whatever is configured via `OPENAI_IMAGE_FALLBACK_MODEL`) so quotas/availability gaps don't break a generation.

## Earlier (2026-04-28)
- **Rebranded** end-to-end from "Aurora Mind OS" → "LifeOS" (UI strings, page titles, AI system prompts).
- **Removed** Identity & Ethics features (route files deleted, removed from sidebar nav and dashboard tiles).
- **Login system** wired: new `LoginModal` (`src/components/aurora/LoginModal.tsx`) supports Email login/signup, Voice login (MediaRecorder → Whisper), and a Google demo flow (`POST /api/auth/google-demo` — creates a `@lifeos.demo` account + JWT since real OAuth isn't configured).
- **Floating AI Assistant** (`src/components/aurora/AssistantBot.tsx`) is mounted in `Shell` so it appears on every authenticated page (middle-right edge). It expands to a chat panel with streaming text replies (over the existing `/ws/voice` WebSocket) and voice input via `POST /api/ai/transcribe` (Whisper).
- **Cinematic** now generates a real image per scene by calling `openai.images.generate` (model `gpt-image-1`) for each `visual_prompt` in parallel (capped at 6 images). Returned scenes carry `image: { url } | { dataUrl }` and the frontend renders them inline.
- **GOIE** prompts now require `sourceUrl`, `sourceName`, and a `references[]` array per opportunity. The `Opportunity` Mongoose model gained `sourceName` + `references` subdoc; the frontend renders the source link plus a list of referenced citations with a "why" line each.
- **Mind** decoder + universe explorer now also return a `mindmap: { center, branches:[{ label, color, children:[{ label }] }] }`. New `MindMap` component (`src/components/aurora/MindMap.tsx`) renders it as an interactive radial SVG (no external deps, fully responsive via viewBox).

## Tech Stack
- **Framework:** TanStack Start + TanStack Router
- **Build tool:** Vite 7 (wrapped via `@lovable.dev/vite-tanstack-config`)
- **Frontend:** React 19, TypeScript, Tailwind CSS v4
- **UI library:** Radix UI primitives + shadcn/ui components
- **Package manager:** npm (uses package-lock.json)
- **Runtime:** Node.js 20

## Project Structure
- `src/routes/` — TanStack Router file-based routes (index, dashboard, mind, multiverse, voice, cinematic, goie). Identity and Ethics routes were removed.
- `src/components/aurora/` — App-specific components: `Shell`, `ui`, `LoginModal`, `AssistantBot` (floating chat bot), `MindMap` (radial SVG mind map). Folder name kept for import stability after the LifeOS rebrand.
- `src/components/ui/` — shadcn UI primitives
- `src/lib/` — utilities
- `src/hooks/` — React hooks
- `src/styles.css` — Tailwind/global styles
- `vite.config.ts` — Vite config (overrides Lovable defaults to use port 5000 / host 0.0.0.0)
- `wrangler.jsonc` — Cloudflare Workers config (build artifact target)

## Replit Setup
- **Workflow:** `Start application` runs `npm run dev` and serves on port `5000` (webview).
- **Host config:** Vite is configured with `host: "0.0.0.0"`, `port: 5000`, `allowedHosts: true` so the Replit iframe proxy can reach the dev server.
- **Deployment (production):** Configured as autoscale.
  - `build = npm run build:all` — installs root + backend deps then runs `vite build` (outputs `dist/client/` static assets and `dist/server/index.js` SSR worker).
  - `run = npm run start` — boots the Express backend (`backend/server.js`) on `PORT` (5000 in production) with `NODE_ENV=production`. The backend serves all `/api/*` routes and `/ws/voice`, plus serves the built frontend: static assets from `dist/client/` and SSR-rendered HTML by adapting the TanStack Start worker (`dist/server/index.js`) to Node's HTTP layer using Web `Request`/`Response`. This keeps a single port for Replit autoscale and avoids any dev server in production.

## Backend (`/backend`)
A separate Node + Express + MongoDB API lives in `backend/` so it doesn't collide with the frontend's `/src`.

- **Entry:** `backend/server.js` (Express + WebSocket on the same HTTP server)
- **Port:** `3001` (configurable via `PORT`); host `0.0.0.0`
- **Workflow:** `Backend API` runs `cd backend && npm run dev` (console output, port 3001).
- **Auth:** JWT via `Authorization: Bearer <token>` (`backend/src/utils/verifyToken.js`). When no JWT is provided, an anonymous **guest** user is auto-created via the `aurora.guest` httpOnly cookie so every feature works without sign-in. Use `requireRealUser` middleware to gate endpoints that must reject guests.
- **Voice login:** Whisper API transcription via `backend/src/utils/voiceLogin.js` (multer in-memory upload)
- **AI:** OpenAI client in `backend/src/config/openai.js` (chat for AI features, voice companion over WebSocket at `/ws/voice`)
- **Models:** `User`, `Session`, `Opportunity` (Mongoose). `bufferTimeoutMS=1500` so calls fail fast when no DB is configured. All controllers wrap DB operations with `tryDB(fn, fallback)` from `backend/src/utils/db.js`, so AI responses are always returned to the client even when MongoDB is unavailable — persistence is best-effort.
- **AI error handling:** All controllers wrap OpenAI calls with `tryAI(() => openai.chat...)` from `backend/src/utils/ai.js`. The wrapper translates provider failures into a structured `AIError` (`status` 502/503, stable `code` like `ai_quota_exceeded` / `ai_rate_limited` / `ai_auth_failed` / `ai_not_configured` / `ai_provider_down`, friendly `message`, actionable `hint`). Controllers `next(err)` to the central handler in `server.js`, which serializes the AIError as JSON. The dashboard intentionally swallows AIErrors and exposes `aiStatus: { ok, code, message, hint }` so the UI degrades gracefully. The WebSocket voice handler emits the same shape as `{ type: "error", message, code, hint, providerStatus }`.
- **CORS:** `FRONTEND_URL` env var (comma-separated origins). When unset, all origins are allowed (dev default).
- **Features mounted under `/api/*`:**
  `auth` (incl. `voice-login`, `google` real account + `google-demo` legacy alias), `ai/chat` + `ai/transcribe` (Whisper), `command-center`, `reality`, `identity` (incl. `evolution`),
  `multiverse`, `cinematic` (image gen with `gpt-image-1` + automatic fallback to `OPENAI_IMAGE_FALLBACK_MODEL` / `dall-e-3`), `mind` (decode + explore now return a `mindmap`), `goie` (now returns `sourceUrl` + `sourceName` + `references[]`),
  `decision`, `activity`, `onboarding`, `dashboard`, `explore` (behavior intelligence — POST `/api/explore/insights`),
  `news` (current-affairs via OpenAI Responses API + `web_search_preview` tool, with chat-completion fallback),
  `sessions` (Postgres-backed chat history list/get), plus WS `/ws/voice`.
  (Identity/Ethics frontend routes were removed but the backend identity route is still mounted for backwards compatibility.)
- **Persistent storage:** Postgres is initialized on boot via `backend/src/config/postgres.js` using `DATABASE_URL`. Schema (auto-created): `lifeos_users`, `lifeos_chat_sessions`, `lifeos_chat_messages`, `lifeos_onboarding`, `lifeos_explore_reports`. Mongo is still optional and used as a legacy fallback. The WS voice handler persists every user/assistant turn into `lifeos_chat_messages` keyed by `sessionId`.
- **Env:** copy `backend/.env.example` → `backend/.env`. The server boots even when `MONGODB_URI` / `OPENAI_API_KEY` / `DATABASE_URL` are missing — it logs warnings and AI/DB calls fail with clear, structured errors. Optional `OPENAI_IMAGE_FALLBACK_MODEL` (default `dall-e-3`) controls the Cinematic fallback. Optional `OPENAI_SEARCH_MODEL` (default `gpt-4o`) is used by `/api/news`.

### Frontend ↔ backend wiring
- `vite.config.ts` proxies `/api/*` and `/ws/voice` from port 5000 → `BACKEND_URL` (default `http://localhost:3001`). The frontend uses **relative URLs** so the same code works in dev, behind the Replit iframe proxy, and in production.
- `src/lib/api.ts` is a typed fetch client covering every feature, plus `openVoiceCompanion()` for the streaming WebSocket. Newer additions: `news.ask()`, `persistedSessions.list()/get()`, `auth.google()` (real account).
- Every feature route (`dashboard`, `multiverse`, `voice`, `goie`, `mind`, `cinematic`) is fully wired with input forms, loading/error states, and live AI result rendering — no mock data.

### Theme & voice
- **Default theme:** light (clean soft-white). Implemented via `src/lib/theme.ts` (defaults to `"light"`) and an inline boot script in `src/routes/__root.tsx` that adds the right class before paint to avoid FOUC. Toggle via `ThemeToggle`; choice persists in `localStorage`.
- **Light palette:** see `.light` block in `src/styles.css` — soft cool-tinted white background, glassy white panels with subtle shadows, the same neon aurora primary/accent colors so visual identity is preserved.
- **JARVIS-like assistant** (`src/components/aurora/AssistantBot.tsx`): uses the browser's Web Speech API (`src/lib/speechRecognition.ts`) for instant continuous listening with interim results — no server round-trip. Falls back to MediaRecorder → Whisper on browsers without `SpeechRecognition` (Firefox). News intent detection (`/news|today|markets|space|war|crypto|.../i`) routes the message to `/api/news` for live web-search answers with citations.
- **Voice tone settings** (`src/components/aurora/VoiceSettings.tsx`): user picks voice / rate / pitch from the gear icon in the assistant header. Defaults to a warm female voice with a slightly raised pitch. Persisted in `localStorage` via `src/lib/voice.ts` (`getVoiceTone`, `setVoiceTone`, `speakPreview`, `listVoices`).
- **Real Google login**: `POST /api/auth/google` accepts `{ email, name, photoUrl, bio }` and creates/refreshes a real Postgres-backed `lifeos_users` row (or Mongo fallback). The login modal collects email + name + optional photo URL + optional bio so the assistant has real grounding from day one. The legacy `/api/auth/google-demo` endpoint still works as an alias for backwards compatibility.

### Tests, Postman, WebSocket demo
- **Test scripts:** `backend/tests/test-{voice-login,ai-chat,goie,multiverse,cinematic}.js`. Run all with `cd backend && npm test`. They wire-test each route, validate auth/400/401 contracts, and SKIP DB-backed assertions cleanly when `MONGODB_URI` is not set.
- **Postman collection:** `backend/postman/aurora.postman_collection.json` — import into Postman, set `baseUrl` and `token` collection variables.
- **WebSocket demo:** open `backend/examples/websocket-client.html` in a browser to chat with the streaming voice companion.

## Notes
- The Lovable Vite wrapper auto-includes tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build only), componentTagger (dev only), the `@` path alias, React/TanStack dedupe, and error logger plugins. Do not add these manually.
- Two Node engine warnings appear during install (some `@tanstack/start-*` sub-packages prefer Node ≥22), but the app runs fine on Node 20.
