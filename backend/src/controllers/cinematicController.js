import Session from "../models/Session.js";
import { openai } from "../config/openai.js";
import { requireFields, safeJSON, clampInt } from "../utils/validate.js";
import { tryDB } from "../utils/db.js";
import { tryAI } from "../utils/ai.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const IMAGE_FALLBACK_MODEL = process.env.OPENAI_IMAGE_FALLBACK_MODEL || "dall-e-3";

/**
 * Generate a single image for a scene's visual prompt. Returns either
 * { url } (hosted URL) or { dataUrl } (base64 data URL) so the frontend
 * can display it directly. Returns null on failure (we don't want one
 * failed image to take down the whole cinematic).
 *
 * If the primary image model fails (e.g. `gpt-image-1` not enabled on
 * the account or via the Replit AI Integration proxy), we transparently
 * fall back to a second model so users still get visuals.
 */
async function callImageModel(model, prompt) {
  // gpt-image-1 returns b64_json by default; dall-e-3 supports both.
  const params = {
    model,
    prompt: `Cinematic still, high detail, photoreal, dramatic lighting. ${prompt}`,
    size: "1024x1024",
    n: 1,
  };
  return openai.images.generate(params);
}

async function generateSceneImage(prompt) {
  if (!prompt || typeof prompt !== "string") return null;
  const tryModel = async (model) => {
    const result = await tryAI(() => callImageModel(model, prompt));
    const item = result?.data?.[0];
    if (!item) return null;
    if (item.url) return { url: item.url };
    if (item.b64_json) return { dataUrl: `data:image/png;base64,${item.b64_json}` };
    return null;
  };
  try {
    const primary = await tryModel(IMAGE_MODEL);
    if (primary) return primary;
  } catch (err) {
    console.warn(`[cinematic] primary image model (${IMAGE_MODEL}) failed:`, err?.code || err?.message);
  }
  if (IMAGE_FALLBACK_MODEL && IMAGE_FALLBACK_MODEL !== IMAGE_MODEL) {
    try {
      const fallback = await tryModel(IMAGE_FALLBACK_MODEL);
      if (fallback) return fallback;
    } catch (err) {
      console.warn(`[cinematic] fallback image model (${IMAGE_FALLBACK_MODEL}) failed:`, err?.code || err?.message);
    }
  }
  return null;
}

export async function generateCinematic(req, res, next) {
  try {
    if (!requireFields(req.body, ["theme"], res)) return;
    const { theme } = req.body;
    const scenes = clampInt(req.body.scenes, { min: 3, max: 10, fallback: 5 });
    const tone = req.body.tone || "epic";
    const protagonist = req.body.protagonist || "the user";

    const completion = await tryAI(() =>
      openai.chat.completions.create({
        model: CHAT_MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are LifeOS's Cinematic Director. Output strict JSON ONLY: { title, logline, scenes:[{index,setting,action,dialogue,visual_prompt}] }. Each visual_prompt must be a vivid, comma-separated image-model prompt (lens, lighting, mood, composition).",
          },
          {
            role: "user",
            content: `Theme: ${theme}
Tone: ${tone}
Protagonist: ${protagonist}
Number of scenes: ${scenes}.`,
          },
        ],
      })
    );

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = safeJSON(raw, {});
    const sceneList = Array.isArray(parsed?.scenes) ? parsed.scenes : [];

    // Generate images in parallel — capped at 6 to keep latency reasonable.
    const MAX_IMAGES = 6;
    const imagedScenes = await Promise.all(
      sceneList.map(async (s, i) => {
        if (i >= MAX_IMAGES) return s;
        const img = await generateSceneImage(s?.visual_prompt);
        return { ...s, image: img };
      })
    );
    parsed.scenes = imagedScenes;

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
    return next(err);
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
