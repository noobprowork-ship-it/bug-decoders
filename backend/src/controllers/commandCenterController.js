import Session from "../models/Session.js";
import User from "../models/User.js";
import { openai } from "../config/openai.js";
import { requireFields, safeJSON, asArray } from "../utils/validate.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

/**
 * POST /api/command-center/plan
 *
 * Returns the user's top 5 priorities and an actionable plan.
 *
 * Body:
 *   {
 *     goals: string[],
 *     currentChallenges?: string[],
 *     timeAvailableHoursPerDay?: number,
 *     mood?: string
 *   }
 *
 * Example response:
 *   {
 *     "topPriorities": [
 *       { "rank": 1, "priority": "Ship Aurora MVP", "why": "Highest leverage this week", "impact": 92 },
 *       ...
 *     ],
 *     "actionPlan": [
 *       { "day": "Mon", "focus": "Deep work", "actions": ["2h core build", "1h user calls"] },
 *       ...
 *     ],
 *     "focusArea": "Execution & shipping",
 *     "energyAdvice": "Front-load mornings; protect 9–11am for deep work."
 *   }
 */
export async function planCommandCenter(req, res) {
  try {
    if (!requireFields(req.body, ["goals"], res)) return;
    const goals = asArray(req.body.goals);
    const challenges = asArray(req.body.currentChallenges);
    const hoursPerDay = Number(req.body.timeAvailableHoursPerDay) || 4;
    const mood = req.body.mood || "focused";

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are Aurora's AI Life Command Center. Output strict JSON ONLY with shape: { topPriorities:[{rank,priority,why,impact}], actionPlan:[{day,focus,actions:[]}], focusArea, energyAdvice }. topPriorities must contain exactly 5 items. actionPlan must contain 7 items, one per day starting Mon.",
        },
        {
          role: "user",
          content: `Goals: ${goals.join("; ")}
Challenges: ${challenges.join("; ") || "none"}
Time available: ${hoursPerDay}h/day
Mood: ${mood}`,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = safeJSON(raw, { topPriorities: [], actionPlan: [] });

    await Session.create({
      userId: req.user.id,
      type: "chat",
      title: "Command Center plan",
      messages: [
        { role: "user", content: JSON.stringify({ goals, challenges, hoursPerDay, mood }) },
        { role: "assistant", content: raw },
      ],
      metadata: { feature: "command-center" },
    });

    await User.findByIdAndUpdate(req.user.id, {
      $set: { "settings.lastCommandCenter": parsed, "settings.lastCommandCenterAt": new Date() },
    });

    return res.json(parsed);
  } catch (err) {
    console.error("[commandCenterController.planCommandCenter]", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/command-center/latest — returns the most recent saved plan.
 *
 * Example response:
 *   { "plan": { "topPriorities": [...], "actionPlan": [...] }, "generatedAt": "2026-04-28T..." }
 */
export async function latestCommandCenter(req, res) {
  try {
    const user = await User.findById(req.user.id).select("settings");
    return res.json({
      plan: user?.settings?.lastCommandCenter || null,
      generatedAt: user?.settings?.lastCommandCenterAt || null,
    });
  } catch (err) {
    console.error("[commandCenterController.latestCommandCenter]", err);
    return res.status(500).json({ error: err.message });
  }
}
