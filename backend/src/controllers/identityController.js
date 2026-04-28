import User from "../models/User.js";
import { openai } from "../config/openai.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

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

export async function generateIdentityInsights(req, res) {
  try {
    const { traits = [], goals = [] } = req.body;

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are Aurora's Identity Engine. Output strict JSON." },
        {
          role: "user",
          content: `Generate an identity reflection given traits: ${traits.join(", ") || "n/a"} and goals: ${goals.join(", ") || "n/a"}.
Return JSON: { archetype, strengths: [...], blindspots: [...], next_chapter: string }.`,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    await User.findByIdAndUpdate(req.user.id, {
      $set: { "identityProfile.lastInsight": parsed, "identityProfile.lastInsightAt": new Date() },
    });

    return res.json({ insights: parsed });
  } catch (err) {
    console.error("[identityController.generateIdentityInsights]", err);
    return res.status(500).json({ error: err.message });
  }
}
