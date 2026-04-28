import { openai } from "../config/openai.js";
import Session from "../models/Session.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

export async function chat(req, res) {
  try {
    const { messages = [], system, sessionId, type = "chat" } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages[] is required" });
    }

    const fullMessages = [
      { role: "system", content: system || "You are Aurora, a thoughtful AI life companion." },
      ...messages,
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
        messages: [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "assistant", content: reply },
        ],
      });
    }

    return res.json({ reply, sessionId: session?._id });
  } catch (err) {
    console.error("[aiController.chat]", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function listSessions(req, res) {
  try {
    const sessions = await Session.find({ userId: req.user.id })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();
    return res.json({ sessions });
  } catch (err) {
    console.error("[aiController.listSessions]", err);
    return res.status(500).json({ error: err.message });
  }
}

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
