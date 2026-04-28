import User from "../models/User.js";
import Session from "../models/Session.js";
import { openai } from "../config/openai.js";
import { requireFields, safeJSON, asArray } from "../utils/validate.js";
import { tryDB } from "../utils/db.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

export async function getMindProfile(req, res) {
  const user = await tryDB(
    () => User.findById(req.user.id).select("mindProfile").lean(),
    null
  );
  return res.json({ mind: user?.mindProfile || {} });
}

export async function decodeMind(req, res) {
  try {
    if (!requireFields(req.body, ["thoughts"], res)) return;
    const { thoughts } = req.body;
    const mood = req.body.mood || "unspecified";
    const recent = asArray(req.body.recent_events);

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are Aurora's Mind Decoder. Output strict JSON ONLY: { themes:[], cognitive_patterns:[], emotional_tone, recommendations:[] }.",
        },
        {
          role: "user",
          content: `Thoughts: ${thoughts}
Mood: ${mood}
Recent events: ${recent.join("; ") || "n/a"}`,
        },
      ],
    });

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
    console.error("[mindController.decodeMind]", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function exploreMindUniverse(req, res) {
  try {
    if (!requireFields(req.body, ["responses"], res)) return;
    const responses = req.body.responses;

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are Aurora's Mind Universe Explorer. Output strict JSON ONLY: { personality:{type, traits:[{name,score(0-100)}]}, thinkingPatterns:[], cognitiveBiases:[], preferredEnvironments:[], growthLevers:[] }.",
        },
        { role: "user", content: `Responses: ${JSON.stringify(responses)}` },
      ],
    });

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
    console.error("[mindController.exploreMindUniverse]", err);
    return res.status(500).json({ error: err.message });
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
