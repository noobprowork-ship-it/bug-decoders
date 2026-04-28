import Session from "../models/Session.js";
import { openai } from "../config/openai.js";
import { requireFields, safeJSON, clampInt } from "../utils/validate.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

/**
 * POST /api/cinematic/generate
 *
 * Life Cinematic Director — generates cinematic scenes with both copy and
 * image-generation prompts you can feed to any image model.
 *
 * Body:
 *   {
 *     theme: string,
 *     scenes?: number (default 5, clamped 3..10),
 *     tone?: "epic"|"intimate"|"noir"|"hopeful"|"surreal" (default "epic"),
 *     protagonist?: string
 *   }
 *
 * Example response:
 *   {
 *     "sessionId": "...",
 *     "cinematic": {
 *       "title": "Aurora — First Light",
 *       "logline": "A maker rebuilds her life after the algorithms break.",
 *       "scenes": [
 *         {
 *           "index": 1,
 *           "setting": "Tokyo rooftop, dawn",
 *           "action": "She boots her terminal as the city wakes.",
 *           "dialogue": "AURORA: 'Day one of the rest of your life.'",
 *           "visual_prompt": "cinematic wide shot, Tokyo rooftop at dawn, neon fog, anamorphic lens, 35mm film grain"
 *         }
 *       ]
 *     }
 *   }
 */
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

    const session = await Session.create({
      userId: req.user.id,
      type: "cinematic",
      title: parsed?.title || theme,
      messages: [{ role: "assistant", content: raw }],
      metadata: { theme, scenes, tone, protagonist },
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
