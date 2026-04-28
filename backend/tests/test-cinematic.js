/**
 * Test: Life Cinematic Director
 */
import { api, ensureBackend, ensureUser, expect, log, runTest, summarize } from "./_helpers.js";

await ensureBackend();
log.step("Cinematic wire test");

await runTest("cinematic (DB-backed)", async () => {
  const { token } = await ensureUser("cinematic");

  const missing = await api("/api/cinematic/generate", { method: "POST", body: JSON.stringify({}) }, token);
  expect("missing theme → 400", missing.status === 400);

  const res = await api(
    "/api/cinematic/generate",
    { method: "POST", body: JSON.stringify({ theme: "future self at age 40", scenes: 4, tone: "hopeful" }) },
    token
  );
  log.info(`status=${res.status} body=${summarize(res.data)}`);

  const acceptable = res.ok || /openai|api key|mongo|database/i.test(JSON.stringify(res.data || ""));
  expect("cinematic/generate returns storyboard or a structured error", acceptable);

  if (res.ok) {
    expect("returns sessionId", !!res.data?.sessionId);
    expect("cinematic.scenes is an array", Array.isArray(res.data?.cinematic?.scenes));
  }
});
