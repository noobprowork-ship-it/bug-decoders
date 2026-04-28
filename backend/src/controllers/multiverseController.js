import { openai } from "../config/openai.js";
import Session from "../models/Session.js";
import { requireFields, safeJSON, clampInt } from "../utils/validate.js";
import { tryDB } from "../utils/db.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

export async function simulate(req, res) {
  try {
    if (!requireFields(req.body, ["decision"], res)) return;
    const { decision } = req.body;
    const context = req.body.context || "";
    const branches = clampInt(req.body.branches, { min: 2, max: 5, fallback: 3 });
    const horizonYears = clampInt(req.body.horizonYears, { min: 1, max: 30, fallback: 5 });

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are Aurora's Multiverse Simulator. Output strict JSON ONLY: { branches:[{name,summary,probability(0-1),milestones:[{year,event}],risks:[],wins:[]}], recommended, rationale }. branches.length MUST equal the requested count.",
        },
        {
          role: "user",
          content: `Decision: ${decision}
Context: ${context || "n/a"}
Branches: ${branches}
Time horizon: ${horizonYears} years.`,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = safeJSON(raw, { branches: [] });

    const session = await tryDB(() =>
      Session.create({
        userId: req.user.id,
        type: "multiverse",
        title: decision.slice(0, 80),
        messages: [
          { role: "user", content: decision },
          { role: "assistant", content: raw },
        ],
        metadata: { decision, branches, horizonYears, context },
      })
    );

    return res.json({ sessionId: session?._id || null, ...parsed });
  } catch (err) {
    console.error("[multiverseController.simulate]", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function listSimulations(req, res) {
  const sims = await tryDB(
    () =>
      Session.find({ userId: req.user.id, type: "multiverse" })
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean(),
    []
  );
  return res.json({ simulations: sims || [] });
}
