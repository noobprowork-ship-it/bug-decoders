/**
 * Test: AI Chat (Life Command Center / general chat)
 */
import { api, ensureBackend, ensureUser, expect, log, runTest, summarize } from "./_helpers.js";

await ensureBackend();
log.step("AI chat — auth-protected");

const noAuth = await api("/api/ai/chat", {
  method: "POST",
  body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
});
expect("rejects without token (401)", noAuth.status === 401);

await runTest("ai-chat (DB-backed)", async () => {
  const { token } = await ensureUser("ai-chat");

  const badInput = await api("/api/ai/chat", { method: "POST", body: JSON.stringify({}) }, token);
  expect("validates messages[] (400)", badInput.status === 400);

  const res = await api(
    "/api/ai/chat",
    { method: "POST", body: JSON.stringify({ messages: [{ role: "user", content: "Say hi in 3 words." }] }) },
    token
  );
  log.info(`status=${res.status} body=${summarize(res.data)}`);

  const acceptable = res.ok || /openai|api key|mongo|database/i.test(JSON.stringify(res.data || ""));
  expect("authenticated /ai/chat returns reply or a structured error", acceptable);
});
