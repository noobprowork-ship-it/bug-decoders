import User from "../models/User.js";
import Session from "../models/Session.js";
import Opportunity from "../models/Opportunity.js";
import { openai } from "../config/openai.js";
import { safeJSON } from "../utils/validate.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

function pct(num, den) {
  if (!den) return 0;
  return Math.round((num / den) * 100);
}

/**
 * GET /api/dashboard
 *
 * Dashboard Intelligence Layer — aggregates progress, insights, predictions.
 *
 * Example response:
 *   {
 *     "user": { "name": "Amit", "tier": "pro" },
 *     "metrics": {
 *       "momentumPct": 92,
 *       "opportunitiesCount": 14,
 *       "decisionsCount": 3,
 *       "futureScore": "A+",
 *       "sessionsLast7d": 12,
 *       "sessionsPrior7d": 7
 *     },
 *     "insights": ["Your skill graph crossed escape velocity"],
 *     "predictions": [{ "horizon": "7d", "claim": "...", "confidence": 0.78 }],
 *     "recentActivity": [{ "type": "decision", "title": "...", "at": "..." }],
 *     "topOpportunities": [{ "title": "...", "score": 87 }]
 *   }
 */
export async function getDashboard(req, res) {
  try {
    const userId = req.user.id;
    const now = Date.now();
    const d7 = new Date(now - 7 * 86400000);
    const d14 = new Date(now - 14 * 86400000);

    const [user, sessionsLast7d, sessionsPrior7d, opportunitiesCount, decisionsCount, recent, topOpps] =
      await Promise.all([
        User.findById(userId).select("name email tier identityProfile settings").lean(),
        Session.countDocuments({ userId, createdAt: { $gte: d7 } }),
        Session.countDocuments({ userId, createdAt: { $gte: d14, $lt: d7 } }),
        Opportunity.countDocuments({ userId }),
        Session.countDocuments({ userId, type: "decision" }),
        Session.find({ userId }).sort({ updatedAt: -1 }).limit(8).select("type title updatedAt").lean(),
        Opportunity.find({ userId }).sort({ score: -1 }).limit(5).select("title score category").lean(),
      ]);

    const momentumPct = Math.min(100, sessionsLast7d * 8 + (sessionsPrior7d ? pct(sessionsLast7d, sessionsPrior7d) : 0));

    const futureScoreBands = [
      { min: 90, label: "A+" }, { min: 80, label: "A" }, { min: 70, label: "B+" },
      { min: 60, label: "B" },  { min: 50, label: "C+" }, { min: 0,  label: "C" },
    ];
    const futureScore = futureScoreBands.find((b) => momentumPct >= b.min)?.label ?? "C";

    let aiLayer = { insights: [], predictions: [] };
    try {
      const completion = await openai.chat.completions.create({
        model: CHAT_MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are Aurora's Dashboard Intelligence. Output strict JSON ONLY: { insights:[3 short strings], predictions:[{horizon,claim,confidence(0-1)}] }.",
          },
          {
            role: "user",
            content: `User: ${user?.name || "user"}; Identity: ${JSON.stringify(user?.identityProfile || {})};
Sessions last 7d: ${sessionsLast7d}; prior 7d: ${sessionsPrior7d};
Top opportunities: ${JSON.stringify(topOpps)};
Recent activity: ${JSON.stringify(recent)}.`,
          },
        ],
      });
      const raw = completion.choices?.[0]?.message?.content ?? "{}";
      aiLayer = safeJSON(raw, aiLayer);
    } catch (err) {
      console.warn("[dashboardController] AI layer skipped:", err.message);
    }

    return res.json({
      user: { name: user?.name, email: user?.email, tier: user?.tier || "free" },
      metrics: {
        momentumPct,
        opportunitiesCount,
        decisionsCount,
        futureScore,
        sessionsLast7d,
        sessionsPrior7d,
      },
      insights: aiLayer.insights || [],
      predictions: aiLayer.predictions || [],
      recentActivity: (recent || []).map((s) => ({ type: s.type, title: s.title, at: s.updatedAt })),
      topOpportunities: topOpps,
    });
  } catch (err) {
    console.error("[dashboardController.getDashboard]", err);
    return res.status(500).json({ error: err.message });
  }
}
