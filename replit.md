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
- **Deployment:** Configured as autoscale; build = `npm run build`, run = `npm run dev`.

## Backend (`/backend`)
A separate Node + Express + MongoDB API lives in `backend/` so it doesn't collide with the frontend's `/src`.

- **Entry:** `backend/server.js` (Express + WebSocket on the same HTTP server)
- **Port:** `3001` (configurable via `PORT`); host `localhost`
- **Auth:** JWT via `Authorization: Bearer <token>` (`backend/src/utils/verifyToken.js`)
- **Voice login:** Whisper API transcription via `backend/src/utils/voiceLogin.js` (multer in-memory upload)
- **AI:** OpenAI client in `backend/src/config/openai.js` (chat for AI features, voice companion over WebSocket at `/ws/voice`)
- **Models:** `User`, `Session`, `Opportunity` (Mongoose)
- **Routes mounted under `/api/*`:** `auth`, `ai`, `goie`, `multiverse`, `identity`, `mind`, `cinematic`, `decision`
- **Run:** `cd backend && npm install && npm run dev`
- **Env:** see `backend/.env.example` (`MONGODB_URI`, `JWT_SECRET`, `OPENAI_API_KEY`, …). The server boots even when env vars are missing — it logs warnings and AI/DB calls fail with clear errors.

## Notes
- The Lovable Vite wrapper auto-includes tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build only), componentTagger (dev only), the `@` path alias, React/TanStack dedupe, and error logger plugins. Do not add these manually.
- Two Node engine warnings appear during install (some `@tanstack/start-*` sub-packages prefer Node ≥22), but the app runs fine on Node 20.
