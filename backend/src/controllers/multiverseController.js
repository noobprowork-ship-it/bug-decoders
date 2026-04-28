import { openai } from "../config/openai.js";
import Session from "../models/Session.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

export async function simulate(req, res) {
  try {
    const { decision, context = "", branches = 3, horizonYears = 5 } = req.body;
    if (!decision) return res.status(400).json({ error: "decision is required" });

    const prompt = `Simulate ${branches} parallel-universe branches for the decision:
"${decision}"
Context: ${context || "n/a"}
Time horizon: ${horizonYears} years.

Return JSON: { branches: [{ name, summary, probability (0-1), milestones: [{year, event}], risks: [...], wins: [...] }] }.`;

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are Aurora's Multiverse Simulator. Always answer with strict JSON." },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = { branches: [] }; }

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
