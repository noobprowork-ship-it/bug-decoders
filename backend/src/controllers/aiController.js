import { openai } from "../config/openai.js";
import Session from "../models/Session.js";
import { requireFields } from "../utils/validate.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

/**
 * POST /api/ai/chat
 *
 * Generic AI chat endpoint backing the Life Command Center conversation surface.
 *
 * Body:
 *   {
 *     messages: [{ role: "user"|"assistant", content: string }],
 *     system?: string,
 *     sessionId?: string,
 *     type?: "chat"|"voice"|"mind"|"multiverse"|"cinematic"|"decision"|"identity"|"goie"
 *   }
 *
 * Example response:
 *   {
 *     "reply": "Here are the three highest-leverage moves you can make this week…",
 *     "sessionId": "65f1c2b3a8d2e1d4f6a8b9c0",
 *     "model": "gpt-4o-mini"
 *   }
 */
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

    let session;
    if (sessionId) {
      session = await Session.findOneAndUpdate(
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
    } else {
      session = await Session.create({
        userId: req.user.id,
        type,
        title: messages[0]?.content?.slice(0, 80) || "Conversation",
        messages: [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "assistant", content: reply },
        ],
      });
    }

    return res.json({ reply, sessionId: session?._id, model: CHAT_MODEL });
  } catch (err) {
    console.error("[aiController.chat]", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/ai/sessions
 *
 * Example response:
 *   { "sessions": [{ "_id": "...", "type": "chat", "title": "...", "updatedAt": "..." }] }
 */
export async function listSessions(req, res) {
  try {
    const sessions = await Session.find({ userId: req.user.id })
      .sort({ updatedAt: -1 })
      .limit(50)
      .select("type title updatedAt createdAt metadata")
      .lean();
    return res.json({ sessions });
  } catch (err) {
    console.error("[aiController.listSessions]", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/ai/sessions/:id
 *
 * Example response: { "session": { "_id": "...", "messages": [...], "metadata": {...} } }
 */
export async function getSession(req, res) {
  try {
    const session = await Session.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!session) return res.status(404).json({ error: "Session not found" });
    return res.json({ session });
  } catch (err) {
    console.error("[aiController.getSession]", err);
    return res.status(500).json({ error: err.message });
  }
}
