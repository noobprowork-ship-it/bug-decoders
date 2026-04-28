import User from "../models/User.js";
import Session from "../models/Session.js";
import { openai } from "../config/openai.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

export async function getMindProfile(req, res) {
  try {
    const user = await User.findById(req.user.id).select("mindProfile");
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ mind: user.mindProfile || {} });
  } catch (err) {
    console.error("[mindController.getMindProfile]", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function decodeMind(req, res) {
  try {
    const { thoughts = "", mood, recent_events = [] } = req.body;
    if (!thoughts) return res.status(400).json({ error: "thoughts is required" });

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are Aurora's Mind Decoder. Respond with strict JSON." },
        {
          role: "user",
          content: `Decode this stream of thought and return JSON {
  themes: [...],
  cognitive_patterns: [...],
  emotional_tone: string,
  recommendations: [...]
}.
Thoughts: ${thoughts}
Mood: ${mood || "unspecified"}
Recent events: ${recent_events.join("; ") || "n/a"}`,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    await User.findByIdAndUpdate(req.user.id, {
      $set: { "mindProfile.lastDecoding": parsed, "mindProfile.lastDecodedAt": new Date() },
    });

    await Session.create({
      userId: req.user.id,
      type: "mind",
      title: "Mind decoding",
      messages: [
        { role: "user", content: thoughts },
        { role: "assistant", content: raw },
      ],
      metadata: { mood, recent_events },
    });

    return res.json({ decoding: parsed });
  } catch (err) {
    console.error("[mindController.decodeMind]", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function listMindSessions(req, res) {
  try {
    const sessions = await Session.find({ userId: req.user.id, type: "mind" })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();
    return res.json({ sessions });
  } catch (err) {
    console.error("[mindController.listMindSessions]", err);
    return res.status(500).json({ error: err.message });
  }
}
