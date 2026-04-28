import User from "../models/User.js";
import Session from "../models/Session.js";
import { openai } from "../config/openai.js";
import { requireFields, safeJSON, asArray } from "../utils/validate.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

/**
 * GET /api/identity — return the user's saved identity profile.
 *
 * Example response:
 *   { "identity": { "archetype": "Visionary Builder", "strengths": [...], "history": [...] } }
 */
export async function getIdentity(req, res) {
  try {
    const user = await User.findById(req.user.id).select("identityProfile name email");
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ identity: user.identityProfile || {} });
  } catch (err) {
    console.error("[identityController.getIdentity]", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * PUT /api/identity — replace the user's identity profile (admin/manual edits).
 *
 * Example response: { "identity": { ...updatedProfile } }
 */
export async function updateIdentity(req, res) {
  try {
    const updates = req.body || {};
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { identityProfile: updates } },
      { new: true }
    ).select("identityProfile");
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ identity: user.identityProfile });
  } catch (err) {
    console.error("[identityController.updateIdentity]", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/identity/insights — generate an identity reflection from traits/goals.
 *
 * Body: { traits: string[], goals: string[], recentReflections?: string[] }
 *
 * Example response:
 *   {
 *     "insights": {
 *       "archetype": "Quiet Catalyst",
 *       "strengths": ["systems thinking", "deep focus"],
 *       "blindspots": ["asks for help too late"],
 *       "next_chapter": "Lead a small team without losing maker time."
 *     }
 *   }
 */
export async function generateIdentityInsights(req, res) {
  try {
    if (!requireFields(req.body, ["traits"], res)) return;
    const traits = asArray(req.body.traits);
    const goals = asArray(req.body.goals);
    const reflections = asArray(req.body.recentReflections);

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are Aurora's Identity Engine. Output strict JSON ONLY: { archetype, strengths:[], blindspots:[], next_chapter, mantra }.",
        },
        {
          role: "user",
          content: `Traits: ${traits.join(", ")}
Goals: ${goals.join(", ") || "n/a"}
Recent reflections: ${reflections.join(" | ") || "n/a"}`,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = safeJSON(raw, {});

    await User.findByIdAndUpdate(req.user.id, {
      $set: { "identityProfile.lastInsight": parsed, "identityProfile.lastInsightAt": new Date() },
      $push: {
        "identityProfile.history": {
          $each: [{ at: new Date(), insight: parsed, traits, goals }],
          $slice: -30,
        },
      },
    });

    await Session.create({
      userId: req.user.id,
      type: "identity",
      title: "Identity insights",
      messages: [
        { role: "user", content: JSON.stringify({ traits, goals }) },
        { role: "assistant", content: raw },
      ],
      metadata: { feature: "identity-insights" },
    });

    return res.json({ insights: parsed });
  } catch (err) {
    console.error("[identityController.generateIdentityInsights]", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/identity/evolution — Identity Evolution Tracker.
 * Returns time-series growth data points derived from past identity sessions.
 *
 * Example response:
 *   {
 *     "graph": [
 *       { "at": "2026-04-21T...", "archetype": "Maker", "strengthsCount": 3, "blindspotsCount": 2 },
 *       ...
 *     ],
 *     "trajectory": "ascending",
 *     "summary": "You've added 4 strengths over the last 30 days."
 *   }
 */
export async function getEvolutionGraph(req, res) {
  try {
    const user = await User.findById(req.user.id).select("identityProfile");
    const history = user?.identityProfile?.history || [];

    const sessions = await Session.find({ userId: req.user.id, type: "identity" })
      .sort({ createdAt: 1 })
      .select("createdAt metadata messages")
      .lean();

    const graph = [];
    for (const h of history) {
      graph.push({
        at: h.at,
        archetype: h.insight?.archetype || null,
        strengthsCount: (h.insight?.strengths || []).length,
        blindspotsCount: (h.insight?.blindspots || []).length,
      });
    }
    for (const s of sessions) {
      const msg = s.messages?.find((m) => m.role === "assistant");
      const parsed = msg ? safeJSON(msg.content, null) : null;
      if (parsed) {
        graph.push({
          at: s.createdAt,
          archetype: parsed.archetype || null,
          strengthsCount: (parsed.strengths || []).length,
          blindspotsCount: (parsed.blindspots || []).length,
        });
      }
    }
    graph.sort((a, b) => new Date(a.at) - new Date(b.at));

    let trajectory = "stable";
    if (graph.length >= 2) {
      const first = graph[0].strengthsCount - graph[0].blindspotsCount;
      const last = graph[graph.length - 1].strengthsCount - graph[graph.length - 1].blindspotsCount;
      if (last > first) trajectory = "ascending";
      else if (last < first) trajectory = "descending";
    }

    const summary = graph.length
      ? `${graph.length} identity snapshots logged; trajectory is ${trajectory}.`
      : "No identity history yet — generate insights to start your evolution graph.";

    return res.json({ graph, trajectory, summary });
  } catch (err) {
    console.error("[identityController.getEvolutionGraph]", err);
    return res.status(500).json({ error: err.message });
  }
}
