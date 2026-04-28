import Session from "../models/Session.js";
import { openai } from "../config/openai.js";
import { requireFields, safeJSON, asArray } from "../utils/validate.js";
import { tryDB } from "../utils/db.js";
import { tryAI } from "../utils/ai.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

export async function evaluate(req, res, next) {
  try {
    if (!requireFields(req.body, ["question", "options"], res)) return;
    const { question } = req.body;
    const options = asArray(req.body.options);
    if (options.length < 2) {
      return res.status(400).json({ error: "options[] must contain at least 2 entries" });
    }
    const criteria = asArray(req.body.criteria);
    const stakeholders = asArray(req.body.stakeholders);

    const completion = await tryAI(() =>
      openai.chat.completions.create({
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
      })
    );

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = safeJSON(raw, { scores: [] });

    if (Array.isArray(parsed.scores) && parsed.scores.length && !parsed.safestChoice) {
      const safest = [...parsed.scores].sort((a, b) => (a.riskScore || 0) - (b.riskScore || 0))[0];
      parsed.safestChoice = safest?.option;
    }

    const session = await tryDB(() =>
      Session.create({
        userId: req.user.id,
        type: "decision",
        title: question.slice(0, 80),
        messages: [
          { role: "user", content: question },
          { role: "assistant", content: raw },
        ],
        metadata: { options, criteria, stakeholders, feature: "ethical-decision" },
      })
    );

    return res.json({ sessionId: session?._id || null, ...parsed });
  } catch (err) {
    return next(err);
  }
}

export async function listDecisions(req, res) {
  const sessions = await tryDB(
    () =>
      Session.find({ userId: req.user.id, type: "decision" })
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean(),
    []
  );
  return res.json({ decisions: sessions || [] });
}
