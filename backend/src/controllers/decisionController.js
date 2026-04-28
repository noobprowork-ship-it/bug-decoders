import Session from "../models/Session.js";
import { openai } from "../config/openai.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

export async function evaluate(req, res) {
  try {
    const { question, options = [], criteria = [] } = req.body;
    if (!question || options.length === 0) {
      return res.status(400).json({ error: "question and options[] are required" });
    }

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are Aurora's Decision Engine. Output strict JSON." },
        {
          role: "user",
          content: `Help evaluate this decision:
Question: ${question}
Options: ${options.join(" | ")}
Criteria: ${criteria.join(", ") || "balanced long-term wellbeing"}

Return JSON: { recommended, scores: [{ option, score (0-100), pros: [...], cons: [...] }], rationale }.`,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const session = await Session.create({
      userId: req.user.id,
      type: "decision",
      title: question.slice(0, 80),
      messages: [
        { role: "user", content: question },
        { role: "assistant", content: raw },
      ],
      metadata: { options, criteria },
    });

    return res.json({ sessionId: session._id, ...parsed });
  } catch (err) {
    console.error("[decisionController.evaluate]", err);
    return res.status(500).json({ error: err.message });
  }
}

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
