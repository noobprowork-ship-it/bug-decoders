import User from "../models/User.js";
import Session from "../models/Session.js";
import { openai } from "../config/openai.js";
import { requireFields, safeJSON, asArray } from "../utils/validate.js";
import { tryDB } from "../utils/db.js";
import { tryAI } from "../utils/ai.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

const MINDMAP_SCHEMA_HINT =
  "mindmap:{ center:string, branches:[{ label:string, color?:string, children:[{label:string, children?:[{label:string}]}] }] }";

export async function getMindProfile(req, res) {
  const user = await tryDB(
    () => User.findById(req.user.id).select("mindProfile").lean(),
    null
  );
  return res.json({ mind: user?.mindProfile || {} });
}

export async function decodeMind(req, res, next) {
  try {
    if (!requireFields(req.body, ["thoughts"], res)) return;
    const { thoughts } = req.body;
    const mood = req.body.mood || "unspecified";
    const recent = asArray(req.body.recent_events);

    const completion = await tryAI(() =>
      openai.chat.completions.create({
        model: CHAT_MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are LifeOS's Mind Decoder. Output strict JSON ONLY: " +
              `{ themes:[], cognitive_patterns:[], emotional_tone, recommendations:[], ${MINDMAP_SCHEMA_HINT} }. ` +
              "The mindmap.center should be a 1-3 word distillation of what's on the user's mind. " +
              "Use 4-6 branches drawn from themes and cognitive patterns; each branch should have 2-4 children that are concrete sub-thoughts, triggers or actions. Branch colors are short tokens like 'blue','pink','purple','green','amber'.",
          },
          {
            role: "user",
            content: `Thoughts: ${thoughts}
Mood: ${mood}
Recent events: ${recent.join("; ") || "n/a"}`,
          },
        ],
      })
    );

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = safeJSON(raw, {});

    await tryDB(() =>
      User.findByIdAndUpdate(req.user.id, {
        $set: { "mindProfile.lastDecoding": parsed, "mindProfile.lastDecodedAt": new Date() },
      })
    );

    await tryDB(() =>
      Session.create({
        userId: req.user.id,
        type: "mind",
        title: "Mind decoding",
        messages: [
          { role: "user", content: thoughts },
          { role: "assistant", content: raw },
        ],
        metadata: { mood, recent_events: recent, feature: "mind-decode" },
      })
    );

    return res.json({ decoding: parsed });
  } catch (err) {
    return next(err);
  }
}

export async function exploreMindUniverse(req, res, next) {
  try {
    if (!requireFields(req.body, ["responses"], res)) return;
    const responses = req.body.responses;

    const completion = await tryAI(() =>
      openai.chat.completions.create({
        model: CHAT_MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are LifeOS's Mind Universe Explorer. Output strict JSON ONLY: " +
              "{ personality:{type, traits:[{name,score(0-100)}]}, thinkingPatterns:[], cognitiveBiases:[], preferredEnvironments:[], growthLevers:[], " +
              `${MINDMAP_SCHEMA_HINT} }. ` +
              "The mindmap.center is the personality.type. Branches must include: 'Strengths', 'Patterns', 'Biases', 'Environments', 'Growth' — each with 2-4 specific child nodes drawn from the analysis.",
          },
          { role: "user", content: `Responses: ${JSON.stringify(responses)}` },
        ],
      })
    );

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = safeJSON(raw, {});

    await tryDB(() =>
      User.findByIdAndUpdate(req.user.id, {
        $set: { "mindProfile.universe": parsed, "mindProfile.universeAt": new Date() },
      })
    );

    await tryDB(() =>
      Session.create({
        userId: req.user.id,
        type: "mind",
        title: "Mind Universe exploration",
        messages: [
          { role: "user", content: JSON.stringify(responses) },
          { role: "assistant", content: raw },
        ],
        metadata: { feature: "mind-universe" },
      })
    );

    return res.json(parsed);
  } catch (err) {
    return next(err);
  }
}

export async function generateThoughts(req, res, next) {
  try {
    if (!requireFields(req.body, ["subject"], res)) return;
    const { subject } = req.body;

    const completion = await tryAI(() =>
      openai.chat.completions.create({
        model: CHAT_MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are LifeOS's Cognitive Historian. Given any notable person (historical or contemporary), output strict JSON ONLY: " +
              "{ name:string, era:string, field:string, thinkingStyle:string, " +
              "innovations:[string(max 6)], cognitivePatterns:[string(max 5)], mentalModels:[string(max 5)], " +
              "imagePrompt:string }. " +
              "imagePrompt: a vivid, detailed visual art prompt (under 200 chars) for an abstract painting representing their mind — suitable for DALL·E/GPT-Image. " +
              "Make it atmospheric, rich with metaphor, and unique to them.",
          },
          { role: "user", content: `Subject: ${subject}` },
        ],
      })
    );

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = safeJSON(raw, {});

    const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
    const FALLBACK_MODEL = process.env.OPENAI_IMAGE_FALLBACK_MODEL || "dall-e-3";
    const prompt = (parsed.imagePrompt || `Abstract visualization of ${subject}'s mind and ideas — vivid, surreal, masterwork`).slice(0, 1000);

    let image = null;
    try {
      const imgResult = await openai.images.generate({
        model: IMAGE_MODEL,
        prompt,
        n: 1,
        size: "1024x1024",
      });
      const url = imgResult.data?.[0]?.url;
      const b64 = imgResult.data?.[0]?.b64_json;
      if (url) image = { url };
      else if (b64) image = { dataUrl: `data:image/png;base64,${b64}` };
    } catch (imgErr) {
      console.warn("[thoughtsGenerate] Primary model failed, trying fallback:", imgErr?.message);
      try {
        const imgResult2 = await openai.images.generate({
          model: FALLBACK_MODEL,
          prompt,
          n: 1,
          size: "1024x1024",
        });
        const url = imgResult2.data?.[0]?.url;
        if (url) image = { url };
      } catch (fallbackErr) {
        console.warn("[thoughtsGenerate] Fallback also failed:", fallbackErr?.message);
      }
    }

    return res.json({ ...parsed, image });
  } catch (err) {
    return next(err);
  }
}

export async function listMindSessions(req, res) {
  const sessions = await tryDB(
    () =>
      Session.find({ userId: req.user.id, type: "mind" })
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean(),
    []
  );
  return res.json({ sessions: sessions || [] });
}
