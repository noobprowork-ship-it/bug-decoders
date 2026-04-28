import Session from "../models/Session.js";
import User from "../models/User.js";
import { openai } from "../config/openai.js";
import { requireFields, safeJSON, asArray } from "../utils/validate.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

/**
 * POST /api/reality/plan-week
 *
 * Reality Architect Engine — turns a vision into a concrete 7-day plan.
 *
 * Body:
 *   {
 *     vision: string,
 *     constraints?: string[],
 *     currentHabits?: string[],
 *     startDate?: ISODate
 *   }
 *
 * Example response:
 *   {
 *     "vision": "Launch Aurora MVP",
 *     "weekPlan": [
 *       { "day": 1, "label": "Mon", "theme": "Foundations", "actions": ["Lock scope", "Draft schema"], "metric": "Scope doc shipped", "energy": "high" },
 *       ...
 *     ],
 *     "successCriteria": ["MVP demo ready", "5 user interviews booked"],
 *     "risks": ["Burnout from late nights"],
 *     "checkpointAt": "Day 4 retrospective"
 *   }
 */
export async function planWeek(req, res) {
  try {
    if (!requireFields(req.body, ["vision"], res)) return;
    const { vision } = req.body;
    const constraints = asArray(req.body.constraints);
    const currentHabits = asArray(req.body.currentHabits);
    const startDate = req.body.startDate || new Date().toISOString();

    const completion = await openai.chat.completions.create({
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
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = safeJSON(raw, { vision, weekPlan: [] });

    const session = await Session.create({
      userId: req.user.id,
      type: "chat",
      title: `Reality plan: ${vision.slice(0, 60)}`,
      messages: [
        { role: "user", content: vision },
        { role: "assistant", content: raw },
      ],
      metadata: { feature: "reality-architect", constraints, currentHabits, startDate },
    });

    await User.findByIdAndUpdate(req.user.id, {
      $set: { "settings.lastWeekPlan": parsed, "settings.lastWeekPlanAt": new Date() },
    });

    return res.json({ sessionId: session._id, ...parsed });
  } catch (err) {
    console.error("[realityController.planWeek]", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/reality/latest — returns the user's most recent week plan.
 */
export async function latestWeekPlan(req, res) {
  try {
    const user = await User.findById(req.user.id).select("settings");
    return res.json({
      plan: user?.settings?.lastWeekPlan || null,
      generatedAt: user?.settings?.lastWeekPlanAt || null,
    });
  } catch (err) {
    console.error("[realityController.latestWeekPlan]", err);
    return res.status(500).json({ error: err.message });
  }
}
