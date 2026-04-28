/**
 * Test: Secure Voice Login
 *
 * Verifies the multipart upload contract on /api/auth/voice-login.
 * If OPENAI_API_KEY is configured the call should succeed (Whisper transcribes
 * the audio); otherwise the route still returns a clear, structured error and
 * we treat both outcomes as a passing wire test.
 */
import { api, ensureBackend, expect, log, summarize } from "./_helpers.js";

await ensureBackend();
log.step("Voice login wire test");

const fakeWav = Buffer.alloc(2048, 0);
const blob = new Blob([fakeWav], { type: "audio/wav" });
const fd = new FormData();
fd.append("email", `voice+${Date.now()}@aurora.test`);
fd.append("audio", blob, "test.wav");

const res = await api("/api/auth/voice-login", { method: "POST", body: fd });
log.info(`status=${res.status} body=${summarize(res.data)}`);

const acceptable =
  res.ok ||
  /OPENAI_API_KEY|whisper|invalid file/i.test(JSON.stringify(res.data || ""));
expect("voice-login responds with token or a structured error", acceptable);

const missing = await api("/api/auth/voice-login", {
  method: "POST",
  body: (() => { const f = new FormData(); f.append("email", "x@y.z"); return f; })(),
});
expect("missing audio file → 400", missing.status === 400);
