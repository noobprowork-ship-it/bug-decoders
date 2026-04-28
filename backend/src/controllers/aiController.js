import { openai } from "../config/openai.js";
import Session from "../models/Session.js";
import { requireFields } from "../utils/validate.js";
import { tryDB } from "../utils/db.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

export async function chat(req, res) {
  try {
    if (!requireFields(req.body, ["messages"], res)) return;
    const { messages, system, sessionId, type = "chat" } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages[] is required" });
    }

    const fullMessages = [
      {
        role: "system",
        content:
          system ||
          "You are Aurora — a calm, deeply insightful AI life companion. Be concrete, kind and brief.",
      },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages: fullMessages,
    });

    const reply = completion.choices?.[0]?.message?.content ?? "";

    const session = await tryDB(async () => {
      if (sessionId) {
        return Session.findOneAndUpdate(
          { _id: sessionId, userId: req.user.id },
          {
            $push: {
              messages: {
                $each: [
                  ...messages.map((m) => ({ role: m.role, content: m.content })),
                  { role: "assistant", content: reply },
                ],
              },
            },
          },
          { new: true }
        );
      }
      return Session.create({
        userId: req.user.id,
        type,
        title: messages[0]?.content?.slice(0, 80) || "Conversation",
        messages: [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "assistant", content: reply },
        ],
      });
    });

    return res.json({ reply, sessionId: session?._id || null, model: CHAT_MODEL });
  } catch (err) {
    console.error("[aiController.chat]", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function listSessions(req, res) {
  const sessions = await tryDB(
    () =>
      Session.find({ userId: req.user.id })
        .sort({ updatedAt: -1 })
        .limit(50)
        .select("type title updatedAt createdAt metadata")
        .lean(),
    []
  );
  return res.json({ sessions: sessions || [] });
}

export async function getSession(req, res) {
  const session = await tryDB(
    () => Session.findOne({ _id: req.params.id, userId: req.user.id }).lean(),
    null
  );
  if (!session) return res.status(404).json({ error: "Session not found" });
  return res.json({ session });
}
