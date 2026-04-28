import Session from "../models/Session.js";
import User from "../models/User.js";
import { openai } from "../config/openai.js";
import { requireFields, safeJSON, asArray } from "../utils/validate.js";
import { tryDB } from "../utils/db.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

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

    await tryDB(() =>
      Session.create({
        userId: req.user.id,
        type: "chat",
        title: "Command Center plan",
        messages: [
          { role: "user", content: JSON.stringify({ goals, challenges, hoursPerDay, mood }) },
          { role: "assistant", content: raw },
        ],
        metadata: { feature: "command-center" },
      })
    );

    await tryDB(() =>
      User.findByIdAndUpdate(req.user.id, {
        $set: { "settings.lastCommandCenter": parsed, "settings.lastCommandCenterAt": new Date() },
      })
    );

    return res.json(parsed);
  } catch (err) {
    console.error("[commandCenterController.planCommandCenter]", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function latestCommandCenter(req, res) {
  const user = await tryDB(
    () => User.findById(req.user.id).select("settings").lean(),
    null
  );
  return res.json({
    plan: user?.settings?.lastCommandCenter || null,
    generatedAt: user?.settings?.lastCommandCenterAt || null,
  });
}
