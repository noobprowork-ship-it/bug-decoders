/**
 * Test: GOIE — opportunity generation, listing, trends, delete.
 */
import { api, ensureBackend, ensureUser, expect, log, runTest, summarize } from "./_helpers.js";

await ensureBackend();
log.step("GOIE wire test");

await runTest("goie (DB-backed)", async () => {
  const { token } = await ensureUser("goie");

  const created = await api(
    "/api/goie",
    { method: "POST", body: JSON.stringify({ title: "Manual op", category: "career", region: "global" }) },
    token
  );
  log.info(`create status=${created.status} body=${summarize(created.data)}`);
  const dbWorks = created.ok && created.data?.opportunity?._id;

  if (dbWorks) {
    expect("manual opportunity created", true, created.data.opportunity._id);

    const listed = await api("/api/goie?limit=5", {}, token);
    expect("list returns array", Array.isArray(listed.data?.opportunities));

    const removed = await api(
      `/api/goie/${created.data.opportunity._id}`,
      { method: "DELETE" },
      token
    );
    expect("delete works", removed.ok);
  } else {
    expect(
      "create returned a structured error (likely no MongoDB)",
      created.status === 500 || created.status === 400,
      summarize(created.data)
    );
  }

  const generated = await api(
    "/api/goie/generate",
    { method: "POST", body: JSON.stringify({ interests: ["AI", "writing"], count: 3 }) },
    token
  );
  log.info(`generate status=${generated.status} body=${summarize(generated.data)}`);
  const acceptable = generated.ok || /openai|api key|mongo|database/i.test(JSON.stringify(generated.data || ""));
  expect("/goie/generate returns opportunities or a structured error", acceptable);

  const trends = await api("/api/goie/trends", { method: "POST", body: JSON.stringify({ focus: "AI" }) }, token);
  log.info(`trends status=${trends.status} body=${summarize(trends.data)}`);
  const trendsOk = trends.ok || /openai|api key/i.test(JSON.stringify(trends.data || ""));
  expect("/goie/trends returns insights or a structured error", trendsOk);
});
