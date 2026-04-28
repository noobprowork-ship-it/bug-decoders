import Session from "../models/Session.js";
import User from "../models/User.js";
import { openai } from "../config/openai.js";
import { requireFields, safeJSON, asArray } from "../utils/validate.js";
import { tryDB } from "../utils/db.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

export async function analyzeActivity(req, res) {
  try {
    if (!requireFields(req.body, ["activities"], res)) return;
    const activities = asArray(req.body.activities);
    const skills = asArray(req.body.skills);
    const ambitions = asArray(req.body.ambitions);

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are Aurora's Activity & Skill Analyzer. Output strict JSON ONLY: { strengths:[{skill,evidence,score(0-100)}], weaknesses:[{area,why,score(0-100)}], skillGaps:[], recommendations:[{title,impact,timeCost}], summary }.",
        },
        {
          role: "user",
          content: `Activities: ${JSON.stringify(activities)}
Self-reported skills: ${skills.join(", ") || "n/a"}
Ambitions: ${ambitions.join("; ") || "n/a"}`,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = safeJSON(raw, { strengths: [], weaknesses: [] });

    await tryDB(() =>
      Session.create({
        userId: req.user.id,
        type: "chat",
        title: "Activity analysis",
        messages: [
          { role: "user", content: JSON.stringify({ activities, skills, ambitions }) },
          { role: "assistant", content: raw },
        ],
        metadata: { feature: "activity-analyzer" },
      })
    );

    await tryDB(() =>
      User.findByIdAndUpdate(req.user.id, {
        $set: { "settings.lastActivityAnalysis": parsed, "settings.lastActivityAnalysisAt": new Date() },
      })
    );

    return res.json(parsed);
  } catch (err) {
    console.error("[activityController.analyzeActivity]", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function latestAnalysis(req, res) {
  const user = await tryDB(
    () => User.findById(req.user.id).select("settings").lean(),
    null
  );
  return res.json({
    analysis: user?.settings?.lastActivityAnalysis || null,
    generatedAt: user?.settings?.lastActivityAnalysisAt || null,
  });
}
