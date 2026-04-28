import Session from "../models/Session.js";
import { openai } from "../config/openai.js";
import { requireFields, safeJSON, clampInt } from "../utils/validate.js";
import { tryDB } from "../utils/db.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

export async function generateCinematic(req, res) {
  try {
    if (!requireFields(req.body, ["theme"], res)) return;
    const { theme } = req.body;
    const scenes = clampInt(req.body.scenes, { min: 3, max: 10, fallback: 5 });
    const tone = req.body.tone || "epic";
    const protagonist = req.body.protagonist || "the user";

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are Aurora's Cinematic Director. Output strict JSON ONLY: { title, logline, scenes:[{index,setting,action,dialogue,visual_prompt}] }. Each visual_prompt must be a vivid, comma-separated image-model prompt (lens, lighting, mood).",
        },
        {
          role: "user",
          content: `Theme: ${theme}
Tone: ${tone}
Protagonist: ${protagonist}
Number of scenes: ${scenes}.`,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = safeJSON(raw, {});

    const session = await tryDB(() =>
      Session.create({
        userId: req.user.id,
        type: "cinematic",
        title: parsed?.title || theme,
        messages: [{ role: "assistant", content: raw }],
        metadata: { theme, scenes, tone, protagonist },
      })
    );

    return res.json({ sessionId: session?._id || null, cinematic: parsed });
  } catch (err) {
    console.error("[cinematicController.generateCinematic]", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function listCinematics(req, res) {
  const sessions = await tryDB(
    () =>
      Session.find({ userId: req.user.id, type: "cinematic" })
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean(),
    []
  );
  return res.json({ cinematics: sessions || [] });
}

export async function getCinematic(req, res) {
  const session = await tryDB(
    () =>
      Session.findOne({ _id: req.params.id, userId: req.user.id, type: "cinematic" }).lean(),
    null
  );
  if (!session) return res.status(404).json({ error: "Cinematic not found" });
  return res.json({ cinematic: session });
}
