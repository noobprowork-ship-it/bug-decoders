import Session from "../models/Session.js";
import User from "../models/User.js";
import { openai } from "../config/openai.js";
import { requireFields, safeJSON, asArray } from "../utils/validate.js";
import { tryDB } from "../utils/db.js";
import { tryAI } from "../utils/ai.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

export async function planWeek(req, res, next) {
  try {
    if (!requireFields(req.body, ["vision"], res)) return;
    const { vision } = req.body;
    const constraints = asArray(req.body.constraints);
    const currentHabits = asArray(req.body.currentHabits);
    const startDate = req.body.startDate || new Date().toISOString();

    const completion = await tryAI(() =>
      openai.chat.completions.create({
        model: CHAT_MODEL,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are Aurora's Reality Architect. Output strict JSON ONLY: { vision, weekPlan:[{day(1-7),label,theme,actions:[],metric,energy}], successCriteria:[], risks:[], checkpointAt }. weekPlan must contain exactly 7 entries.",
          },
          {
            role: "user",
            content: `Vision: ${vision}
Constraints: ${constraints.join("; ") || "none"}
Current habits: ${currentHabits.join("; ") || "none"}
Start date: ${startDate}`,
          },
        ],
      })
    );

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = safeJSON(raw, { vision, weekPlan: [] });

    const session = await tryDB(() =>
      Session.create({
        userId: req.user.id,
        type: "chat",
        title: `Reality plan: ${vision.slice(0, 60)}`,
        messages: [
          { role: "user", content: vision },
          { role: "assistant", content: raw },
        ],
        metadata: { feature: "reality-architect", constraints, currentHabits, startDate },
      })
    );

    await tryDB(() =>
      User.findByIdAndUpdate(req.user.id, {
        $set: { "settings.lastWeekPlan": parsed, "settings.lastWeekPlanAt": new Date() },
      })
    );

    return res.json({ sessionId: session?._id || null, ...parsed });
  } catch (err) {
    return next(err);
  }
}

export async function latestWeekPlan(req, res) {
  const user = await tryDB(
    () => User.findById(req.user.id).select("settings").lean(),
    null
  );
  return res.json({
    plan: user?.settings?.lastWeekPlan || null,
    generatedAt: user?.settings?.lastWeekPlanAt || null,
  });
}
