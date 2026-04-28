# Aurora Mind OS

## Overview
A TanStack Start (React 19 + Vite 7) single-page/SSR application themed as "Aurora Mind OS — Intelligent Life Operating System". UI is built with shadcn-style components (Radix UI primitives + Tailwind CSS v4).

## Tech Stack
- **Framework:** TanStack Start + TanStack Router
- **Build tool:** Vite 7 (wrapped via `@lovable.dev/vite-tanstack-config`)
- **Frontend:** React 19, TypeScript, Tailwind CSS v4
- **UI library:** Radix UI primitives + shadcn/ui components
- **Package manager:** npm (uses package-lock.json)
- **Runtime:** Node.js 20

## Project Structure
- `src/routes/` — TanStack Router file-based routes (index, dashboard, mind, multiverse, voice, identity, ethics, cinematic, goie)
- `src/components/aurora/` — App-specific components (Shell, ui)
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
- **Auth:** JWT via `Authorization: Bearer <token>` (`backend/src/utils/verifyToken.js`)
- **Voice login:** Whisper API transcription via `backend/src/utils/voiceLogin.js` (multer in-memory upload)
- **AI:** OpenAI client in `backend/src/config/openai.js` (chat for AI features, voice companion over WebSocket at `/ws/voice`)
- **Models:** `User`, `Session`, `Opportunity` (Mongoose). `bufferTimeoutMS=1500` so calls fail fast when no DB is configured.
- **CORS:** `FRONTEND_URL` env var (comma-separated origins). When unset, all origins are allowed (dev default).
- **All 13 features mounted under `/api/*`:**
  `auth` (incl. `voice-login`), `ai/chat`, `command-center`, `reality`, `identity` (incl. `evolution`),
  `multiverse`, `cinematic`, `mind` (incl. `explore`), `goie` (incl. `generate`, `trends`),
  `decision`, `activity`, `onboarding`, `dashboard`, plus WS `/ws/voice`.
- **Env:** copy `backend/.env.example` → `backend/.env`. The server boots even when `MONGODB_URI` / `OPENAI_API_KEY` are missing — it logs warnings and AI/DB calls fail with clear, structured errors.

### Frontend ↔ backend wiring
- `vite.config.ts` proxies `/api/*` and `/ws/voice` from port 5000 → `BACKEND_URL` (default `http://localhost:3001`). The frontend uses **relative URLs** so the same code works in dev, behind the Replit iframe proxy, and in production.
- `src/lib/api.ts` is a typed fetch client covering every feature, plus `openVoiceCompanion()` for the streaming WebSocket.

### Tests, Postman, WebSocket demo
- **Test scripts:** `backend/tests/test-{voice-login,ai-chat,goie,multiverse,cinematic}.js`. Run all with `cd backend && npm test`. They wire-test each route, validate auth/400/401 contracts, and SKIP DB-backed assertions cleanly when `MONGODB_URI` is not set.
- **Postman collection:** `backend/postman/aurora.postman_collection.json` — import into Postman, set `baseUrl` and `token` collection variables.
- **WebSocket demo:** open `backend/examples/websocket-client.html` in a browser to chat with the streaming voice companion.

## Notes
- The Lovable Vite wrapper auto-includes tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build only), componentTagger (dev only), the `@` path alias, React/TanStack dedupe, and error logger plugins. Do not add these manually.
- Two Node engine warnings appear during install (some `@tanstack/start-*` sub-packages prefer Node ≥22), but the app runs fine on Node 20.
