import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { WebSocketServer } from "ws";

import { connectDB } from "./src/config/db.js";
import { openai } from "./src/config/openai.js";

import authRoutes from "./src/routes/auth.js";
import aiRoutes from "./src/routes/ai.js";
import goieRoutes from "./src/routes/goie.js";
import multiverseRoutes from "./src/routes/multiverse.js";
import identityRoutes from "./src/routes/identity.js";
import mindRoutes from "./src/routes/mind.js";
import cinematicRoutes from "./src/routes/cinematic.js";
import decisionRoutes from "./src/routes/decision.js";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
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

app.use((_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.use((err, _req, res, _next) => {
  console.error("[server] unhandled error:", err);
  res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "localhost";

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: "/ws/voice" });

wss.on("connection", (ws) => {
  console.log("[ws] voice companion client connected");

  ws.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      const { type, text } = msg || {};

      if (type === "ping") {
        ws.send(JSON.stringify({ type: "pong", time: Date.now() }));
        return;
      }

      if (type === "chat" && text) {
        const completion = await openai.chat.completions.create({
          model: process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are Aurora, a calm, insightful AI life companion." },
            { role: "user", content: text },
          ],
        });

        const reply = completion.choices?.[0]?.message?.content ?? "";
        ws.send(JSON.stringify({ type: "reply", text: reply }));
      }
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
    });
  } catch (err) {
    console.error("[server] failed to start:", err);
    process.exit(1);
  }
})();
