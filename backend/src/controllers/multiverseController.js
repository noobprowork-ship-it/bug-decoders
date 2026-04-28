import { openai } from "../config/openai.js";
import Session from "../models/Session.js";
import { requireFields, safeJSON, clampInt } from "../utils/validate.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

/**
 * POST /api/multiverse/simulate
 *
 * Choice Multiverse Simulator — generates 3 alternate futures for a decision.
 *
 * Body:
 *   {
 *     decision: string,
 *     context?: string,
 *     branches?: number (default 3, clamped 2..5),
 *     horizonYears?: number (default 5, clamped 1..30)
 *   }
 *
 * Example response:
 *   {
 *     "sessionId": "...",
 *     "branches": [
 *       {
 *         "name": "The Builder Path",
 *         "summary": "You ship the MVP solo and grow slowly.",
 *         "probability": 0.42,
 *         "milestones": [{ "year": 1, "event": "MVP launches" }],
 *         "risks": ["burnout"],
 *         "wins": ["full ownership"]
 *       },
 *       ...
 *     ],
 *     "recommended": "The Builder Path",
 *     "rationale": "Aligned with your current energy & values."
 *   }
 */
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

    const session = await Session.create({
      userId: req.user.id,
      type: "multiverse",
      title: decision.slice(0, 80),
      messages: [
        { role: "user", content: decision },
        { role: "assistant", content: raw },
      ],
      metadata: { decision, branches, horizonYears, context },
    });

    return res.json({ sessionId: session._id, ...parsed });
  } catch (err) {
    console.error("[multiverseController.simulate]", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/multiverse — list past simulations.
 */
export async function listSimulations(req, res) {
  try {
    const sims = await Session.find({ userId: req.user.id, type: "multiverse" })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();
    return res.json({ simulations: sims });
  } catch (err) {
    console.error("[multiverseController.listSimulations]", err);
    return res.status(500).json({ error: err.message });
  }
}
