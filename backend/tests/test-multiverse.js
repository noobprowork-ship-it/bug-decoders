/**
 * Test: Choice Multiverse Simulator
 */
import { api, ensureBackend, ensureUser, expect, log, runTest, summarize } from "./_helpers.js";

await ensureBackend();
log.step("Multiverse wire test");

await runTest("multiverse (DB-backed)", async () => {
  const { token } = await ensureUser("multiverse");

  const missing = await api("/api/multiverse/simulate", { method: "POST", body: JSON.stringify({}) }, token);
  expect("missing decision → 400", missing.status === 400);

  const res = await api(
    "/api/multiverse/simulate",
    { method: "POST", body: JSON.stringify({ decision: "Should I move to Tokyo?", branches: 3, horizonYears: 5 }) },
    token
  );
  log.info(`status=${res.status} body=${summarize(res.data)}`);

  const acceptable = res.ok || /openai|api key|mongo|database/i.test(JSON.stringify(res.data || ""));
  expect("multiverse/simulate returns branches or a structured error", acceptable);

  if (res.ok) {
    expect("returns branches array", Array.isArray(res.data?.branches));
  }
});
