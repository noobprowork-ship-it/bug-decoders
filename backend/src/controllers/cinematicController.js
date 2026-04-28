import Session from "../models/Session.js";
import { openai } from "../config/openai.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

export async function generateCinematic(req, res) {
  try {
    const { theme = "future self", scenes = 5, tone = "epic" } = req.body;

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are Aurora's Cinematic Engine — output strict JSON storyboards." },
        {
          role: "user",
          content: `Create a ${scenes}-scene cinematic storyboard. Theme: "${theme}". Tone: ${tone}.
Return JSON: { title, logline, scenes: [{ index, setting, action, dialogue, visual_prompt }] }.`,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const session = await Session.create({
      userId: req.user.id,
      type: "cinematic",
      title: parsed?.title || theme,
      messages: [{ role: "assistant", content: raw }],
      metadata: { theme, scenes, tone },
    });

    return res.json({ sessionId: session._id, cinematic: parsed });
  } catch (err) {
    console.error("[cinematicController.generateCinematic]", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function listCinematics(req, res) {
  try {
    const sessions = await Session.find({ userId: req.user.id, type: "cinematic" })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();
    return res.json({ cinematics: sessions });
  } catch (err) {
    console.error("[cinematicController.listCinematics]", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function getCinematic(req, res) {
  try {
    const session = await Session.findOne({ _id: req.params.id, userId: req.user.id, type: "cinematic" }).lean();
    if (!session) return res.status(404).json({ error: "Cinematic not found" });
    return res.json({ cinematic: session });
  } catch (err) {
    console.error("[cinematicController.getCinematic]", err);
    return res.status(500).json({ error: err.message });
  }
}
