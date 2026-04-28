import Session from "../models/Session.js";
import User from "../models/User.js";
import { openai } from "../config/openai.js";
import { requireFields, safeJSON, asArray } from "../utils/validate.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

/**
 * POST /api/activity/analyze
 *
 * Activity & Skill Analyzer — converts user habits into strengths & weaknesses.
 *
 * Body:
 *   {
 *     activities: [{ name: string, frequencyPerWeek?: number, hoursPerWeek?: number }],
 *     skills?: string[],
 *     ambitions?: string[]
 *   }
 *
 * Example response:
 *   {
 *     "strengths": [{ "skill": "Async writing", "evidence": "10h/wk journaling", "score": 87 }],
 *     "weaknesses": [{ "area": "Sleep consistency", "why": "Late-night gaming 4x/wk", "score": 32 }],
 *     "skillGaps": ["Public speaking", "Negotiation"],
 *     "recommendations": [{ "title": "Toastmasters cohort", "impact": "high", "timeCost": "2h/wk" }],
 *     "summary": "Strong individual maker, weak public-presence muscle."
 *   }
 */
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

    await Session.create({
      userId: req.user.id,
      type: "chat",
      title: "Activity analysis",
      messages: [
        { role: "user", content: JSON.stringify({ activities, skills, ambitions }) },
        { role: "assistant", content: raw },
      ],
      metadata: { feature: "activity-analyzer" },
    });

    await User.findByIdAndUpdate(req.user.id, {
      $set: { "settings.lastActivityAnalysis": parsed, "settings.lastActivityAnalysisAt": new Date() },
    });

    return res.json(parsed);
  } catch (err) {
    console.error("[activityController.analyzeActivity]", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/activity/latest — returns the most recent saved analysis.
 */
export async function latestAnalysis(req, res) {
  try {
    const user = await User.findById(req.user.id).select("settings");
    return res.json({
      analysis: user?.settings?.lastActivityAnalysis || null,
      generatedAt: user?.settings?.lastActivityAnalysisAt || null,
    });
  } catch (err) {
    console.error("[activityController.latestAnalysis]", err);
    return res.status(500).json({ error: err.message });
  }
}
