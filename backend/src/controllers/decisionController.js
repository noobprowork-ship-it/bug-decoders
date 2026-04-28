import Session from "../models/Session.js";
import { openai } from "../config/openai.js";
import { requireFields, safeJSON, asArray } from "../utils/validate.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

/**
 * POST /api/decision/evaluate
 *
 * AI Ethical Decision Assistant — scores each option for risk + ethics and
 * recommends the safest, highest-integrity choice.
 *
 * Body:
 *   {
 *     question: string,
 *     options: string[]  (>= 2),
 *     criteria?: string[],
 *     stakeholders?: string[]
 *   }
 *
 * Example response:
 *   {
 *     "sessionId": "...",
 *     "recommended": "Option B",
 *     "scores": [
 *       {
 *         "option": "Option A",
 *         "score": 62,
 *         "riskScore": 71,
 *         "ethicsScore": 58,
 *         "pros": ["faster"],
 *         "cons": ["high blast radius"]
 *       },
 *       {
 *         "option": "Option B",
 *         "score": 81,
 *         "riskScore": 28,
 *         "ethicsScore": 90,
 *         "pros": ["transparent"],
 *         "cons": ["slower"]
 *       }
 *     ],
 *     "rationale": "Option B has the lowest risk and highest ethics score, with acceptable speed loss.",
 *     "safestChoice": "Option B"
 *   }
 */
export async function evaluate(req, res) {
  try {
    if (!requireFields(req.body, ["question", "options"], res)) return;
    const { question } = req.body;
    const options = asArray(req.body.options);
    if (options.length < 2) {
      return res.status(400).json({ error: "options[] must contain at least 2 entries" });
    }
    const criteria = asArray(req.body.criteria);
    const stakeholders = asArray(req.body.stakeholders);

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are Aurora's Ethical Decision Assistant. Output strict JSON ONLY: { recommended, safestChoice, scores:[{option,score(0-100),riskScore(0-100, higher=worse),ethicsScore(0-100, higher=better),pros:[],cons:[]}], rationale }. safestChoice is the option with the lowest riskScore.",
        },
        {
          role: "user",
          content: `Question: ${question}
Options: ${options.join(" | ")}
Criteria: ${criteria.join(", ") || "balanced long-term wellbeing"}
Stakeholders: ${stakeholders.join(", ") || "self"}`,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = safeJSON(raw, { scores: [] });

    if (Array.isArray(parsed.scores) && parsed.scores.length && !parsed.safestChoice) {
      const safest = [...parsed.scores].sort((a, b) => (a.riskScore || 0) - (b.riskScore || 0))[0];
      parsed.safestChoice = safest?.option;
    }

    const session = await Session.create({
      userId: req.user.id,
      type: "decision",
      title: question.slice(0, 80),
      messages: [
        { role: "user", content: question },
        { role: "assistant", content: raw },
      ],
      metadata: { options, criteria, stakeholders, feature: "ethical-decision" },
    });

    return res.json({ sessionId: session._id, ...parsed });
  } catch (err) {
    console.error("[decisionController.evaluate]", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/decision — list past decisions.
 *
 * Example response: { "decisions": [{ "_id": "...", "title": "...", "metadata": {...} }] }
 */
export async function listDecisions(req, res) {
  try {
    const sessions = await Session.find({ userId: req.user.id, type: "decision" })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();
    return res.json({ decisions: sessions });
  } catch (err) {
    console.error("[decisionController.listDecisions]", err);
    return res.status(500).json({ error: err.message });
  }
}
