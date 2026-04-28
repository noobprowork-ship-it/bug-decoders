import "dotenv/config";
import http from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import morgan from "morgan";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { connectDB } from "./src/config/db.js";
import { openai } from "./src/config/openai.js";
import { tryAI, isAIError, aiErrorPayload } from "./src/utils/ai.js";
import { verifyTokenString } from "./src/utils/verifyToken.js";

import authRoutes from "./src/routes/auth.js";
import aiRoutes from "./src/routes/ai.js";
import goieRoutes from "./src/routes/goie.js";
import multiverseRoutes from "./src/routes/multiverse.js";
import identityRoutes from "./src/routes/identity.js";
import mindRoutes from "./src/routes/mind.js";
import cinematicRoutes from "./src/routes/cinematic.js";
import decisionRoutes from "./src/routes/decision.js";
import commandCenterRoutes from "./src/routes/commandCenter.js";
import realityRoutes from "./src/routes/reality.js";
import activityRoutes from "./src/routes/activity.js";
import onboardingRoutes from "./src/routes/onboarding.js";
import dashboardRoutes from "./src/routes/dashboard.js";

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || "";
const ALLOWED_ORIGINS = FRONTEND_URL
  ? FRONTEND_URL.split(",").map((s) => s.trim()).filter(Boolean)
  : null;

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (!ALLOWED_ORIGINS) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS: origin not allowed: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "aurora-backend", time: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/goie", goieRoutes);
app.use("/api/multiverse", multiverseRoutes);
app.use("/api/identity", identityRoutes);
app.use("/api/mind", mindRoutes);
app.use("/api/cinematic", cinematicRoutes);
app.use("/api/decision", decisionRoutes);
app.use("/api/command-center", commandCenterRoutes);
app.use("/api/reality", realityRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/dashboard", dashboardRoutes);

const CLIENT_DIST = path.resolve(__dirname, "..", "dist", "client");
const SERVER_DIST = path.resolve(__dirname, "..", "dist", "server");
const SERVER_ENTRY = path.join(SERVER_DIST, "index.js");
const SERVE_FRONTEND = process.env.SERVE_FRONTEND !== "false" && fs.existsSync(SERVER_ENTRY);

if (SERVE_FRONTEND) {
  console.log(`[server] serving built frontend (SSR) from ${SERVER_DIST}`);
  app.use(
    "/assets",
    express.static(path.join(CLIENT_DIST, "assets"), {
      immutable: true,
      maxAge: "1y",
    })
  );
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: "1h" }));

  const ssrModulePromise = import(`file://${SERVER_ENTRY}`).then((m) => m.default || m);

  app.use(async (req, res, next) => {
    if (req.path.startsWith("/api/") || req.path.startsWith("/ws/")) return next();
    try {
      const worker = await ssrModulePromise;
      const protocol =
        req.headers["x-forwarded-proto"] || (req.socket && req.socket.encrypted ? "https" : "http");
      const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
      const url = `${protocol}://${host}${req.originalUrl || req.url}`;

      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (v === undefined) continue;
        if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv));
        else headers.set(k, String(v));
      }

      const init = { method: req.method, headers };
      if (!["GET", "HEAD"].includes(req.method)) {
        init.body = req;
        init.duplex = "half";
      }

      const request = new Request(url, init);
      const response = await worker.fetch(request, process.env, {
        waitUntil() {},
        passThroughOnException() {},
      });

      res.status(response.status);
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === "content-encoding") return;
        res.setHeader(key, value);
      });

      if (!response.body) return res.end();
      const reader = response.body.getReader();
      const pump = async () => {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        res.end();
      };
      await pump();
    } catch (err) {
      console.error("[ssr] error rendering", req.originalUrl, err);
      next(err);
    }
  });
}

app.use("/api/*", (_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.use((err, _req, res, _next) => {
  if (isAIError(err)) {
    console.warn("[ai] provider error:", err.code, "-", err.providerMessage);
    return res.status(err.status).json(aiErrorPayload(err));
  }
  console.error("[server] unhandled error:", err);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "0.0.0.0";
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: "/ws/voice" });

/**
 * AI Voice Companion — WebSocket protocol
 *
 * Client → server messages (JSON strings):
 *   { type: "auth", token: "<jwt>" }                  // optional, attaches user context
 *   { type: "ping" }                                   // server replies { type:"pong", time }
 *   { type: "chat", text: string, history?: [...] }   // streams AI reply token-by-token
 *
 * Server → client messages (JSON strings):
 *   { type: "pong", time }
 *   { type: "stream-start" }
 *   { type: "stream-chunk", text }                     // partial token(s)
 *   { type: "stream-end", text }                       // full reply (for convenience)
 *   { type: "error", message }
 */
wss.on("connection", (ws) => {
  console.log("[ws] voice companion client connected");
  let userCtx = null;

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    try {
      const { type } = msg || {};

      if (type === "ping") {
        ws.send(JSON.stringify({ type: "pong", time: Date.now() }));
        return;
      }

      if (type === "auth" && msg.token) {
        try {
          userCtx = verifyTokenString(msg.token);
          ws.send(JSON.stringify({ type: "auth-ok", userId: userCtx.id }));
        } catch (err) {
          ws.send(JSON.stringify({ type: "error", message: "Invalid token" }));
        }
        return;
      }

      if (type === "chat" && msg.text) {
        const history = Array.isArray(msg.history) ? msg.history : [];
        const messages = [
          {
            role: "system",
            content:
              "You are Aurora — a calm, insightful AI life companion. Reply in short, human, voice-friendly sentences.",
          },
          ...history.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: msg.text },
        ];

        ws.send(JSON.stringify({ type: "stream-start" }));

        let full = "";
        try {
          const stream = await tryAI(() =>
            openai.chat.completions.create({
              model: CHAT_MODEL,
              messages,
              stream: true,
            })
          );
          for await (const part of stream) {
            const delta = part.choices?.[0]?.delta?.content || "";
            if (delta) {
              full += delta;
              ws.send(JSON.stringify({ type: "stream-chunk", text: delta }));
            }
          }
        } catch (streamErr) {
          if (isAIError(streamErr)) {
            console.warn("[ws] ai error:", streamErr.code, "-", streamErr.providerMessage);
            ws.send(JSON.stringify({ type: "error", ...aiErrorPayload(streamErr), message: streamErr.message }));
          } else {
            console.error("[ws] stream error:", streamErr);
            ws.send(JSON.stringify({ type: "error", message: streamErr.message, code: "ws_stream_error" }));
          }
          return;
        }

        ws.send(JSON.stringify({ type: "stream-end", text: full }));
        return;
      }

      ws.send(JSON.stringify({ type: "error", message: `Unknown message type: ${type}` }));
    } catch (err) {
      console.error("[ws] error:", err);
      ws.send(JSON.stringify({ type: "error", message: err.message }));
    }
  });

  ws.on("close", () => console.log("[ws] voice companion client disconnected"));
});

(async () => {
  try {
    await connectDB();
    server.listen(PORT, HOST, () => {
      console.log(`[server] Aurora backend listening on http://${HOST}:${PORT}`);
      console.log(`[server] WebSocket voice channel at ws://${HOST}:${PORT}/ws/voice`);
      console.log(`[server] Mounted feature routes:
  POST   /api/auth/register
  POST   /api/auth/login
  POST   /api/auth/voice-login            (Secure Voice Login)
  GET    /api/auth/me
  POST   /api/ai/chat                     (AI Life Command Center / general chat)
  GET    /api/ai/sessions
  GET    /api/ai/sessions/:id
  POST   /api/command-center/plan         (Top-5 priorities + 7-day plan)
  GET    /api/command-center/latest
  POST   /api/reality/plan-week           (Reality Architect Engine)
  GET    /api/reality/latest
  POST   /api/identity/insights           (Identity Evolution Tracker)
  GET    /api/identity/evolution
  GET    /api/identity, PUT /api/identity
  POST   /api/multiverse/simulate         (Choice Multiverse Simulator)
  GET    /api/multiverse
  POST   /api/cinematic/generate          (Life Cinematic Director)
  GET    /api/cinematic, GET /api/cinematic/:id
  POST   /api/mind/decode                 (Thought decoder)
  POST   /api/mind/explore                (Mind Universe Explorer)
  GET    /api/mind, GET /api/mind/sessions
  GET    /api/goie, POST /api/goie
  POST   /api/goie/generate               (GOIE — opportunity synthesis)
  POST   /api/goie/trends                 (GOIE — global trends + insights)
  POST   /api/decision/evaluate           (AI Ethical Decision Assistant)
  GET    /api/decision
  POST   /api/activity/analyze            (Activity & Skill Analyzer)
  GET    /api/activity/latest
  POST   /api/onboarding/start            (Smart Onboarding)
  POST   /api/onboarding/answer
  GET    /api/onboarding/profile
  GET    /api/dashboard                   (Dashboard Intelligence Layer)
  WS     /ws/voice                        (AI Voice Companion — streaming)`);
    });
  } catch (err) {
    console.error("[server] failed to start:", err);
    process.exit(1);
  }
})();
