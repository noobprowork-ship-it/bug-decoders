import { openai } from "../config/openai.js";
import { safeJSON, asArray } from "../utils/validate.js";
import { tryAI } from "../utils/ai.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

/**
 * POST /api/explore/insights
 *
 * Takes a summary of the user's in-app behavior (page views, feature
 * interactions, time-on-screen) and returns AI-generated insights:
 * hidden skills, behavioral patterns, suggested careers, and habits
 * to develop. Falls back to a deterministic structure when the AI
 * provider isn't configured so the page never breaks.
 */
export async function generateExploreInsights(req, res, next) {
  try {
    const summary = req.body?.summary || {};
    const topPages = asArray(summary.topPages);
    const topActions = asArray(summary.topActions);
    const totalMinutes = Number(summary.totalMinutes) || 0;
    const viewsLast7d = Number(summary.viewsLast7d) || 0;
    const actionsLast7d = Number(summary.actionsLast7d) || 0;

    if (topPages.length === 0 && topActions.length === 0) {
      return res.json({
        report: emptyReport(),
        aiStatus: { ok: true, code: "no_activity" },
      });
    }

    try {
      const completion = await tryAI(() =>
        openai.chat.completions.create({
          model: CHAT_MODEL,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You are LifeOS Explore — an analyst that turns a user's in-app behavior into actionable life intelligence. Output STRICT JSON ONLY with this shape: " +
                '{ "summary": string, ' +
                '"engagementScore": number(0-100), ' +
                '"hiddenSkills": [{"skill": string, "evidence": string, "confidence": number(0-1)}], ' +
                '"interests": [{"label": string, "why": string}], ' +
                '"behaviorPatterns": [{"pattern": string, "implication": string}], ' +
                '"careerPaths": [{"title": string, "fit": number(0-100), "nextStep": string}], ' +
                '"recommendations": [{"title": string, "action": string, "impact": string}], ' +
                '"weeklyReport": {"theme": string, "wins": [string], "watchouts": [string]} }. ' +
                "Return at least 3 items per array. Be concrete and warm.",
            },
            {
              role: "user",
              content:
                `Top pages visited (with visit count + minutes):\n${JSON.stringify(topPages)}\n\n` +
                `Feature interactions (with counts):\n${JSON.stringify(topActions)}\n\n` +
                `Last 7 days: ${viewsLast7d} views, ${actionsLast7d} actions.\n` +
                `Lifetime in-app minutes: ${totalMinutes}.`,
            },
          ],
        })
      );

      const raw = completion.choices?.[0]?.message?.content ?? "{}";
      const parsed = safeJSON(raw, emptyReport());
      return res.json({ report: parsed, aiStatus: { ok: true } });
    } catch (aiErr) {
      const code = aiErr?.code || "ai_error";
      const message = aiErr?.message || "AI provider unavailable";
      return res.json({
        report: deterministicReport({ topPages, topActions, totalMinutes, viewsLast7d, actionsLast7d }),
        aiStatus: { ok: false, code, message, hint: aiErr?.hint },
      });
    }
  } catch (err) {
    return next(err);
  }
}

function emptyReport() {
  return {
    summary: "Not enough activity yet — open a few modules and interact with them so LifeOS can learn your patterns.",
    engagementScore: 0,
    hiddenSkills: [],
    interests: [],
    behaviorPatterns: [],
    careerPaths: [],
    recommendations: [
      { title: "Try a module", action: "Open GOIE, Cinematic, or Mind from the home dashboard.", impact: "Seeds your first signal." },
    ],
    weeklyReport: { theme: "Just getting started", wins: [], watchouts: [] },
  };
}

function deterministicReport({ topPages, topActions, totalMinutes, viewsLast7d, actionsLast7d }) {
  const niceName = (p) => {
    const map = { "/dashboard": "Home", "/goie": "GOIE", "/multiverse": "Multiverse", "/cinematic": "Cinematic", "/mind": "Mind", "/voice": "Voice AI", "/explore": "Explore" };
    return map[p] || p;
  };
  const pages = topPages.slice(0, 5).map((p) => `${niceName(p.target)} (${p.count}x)`);
  const actions = topActions.slice(0, 5).map((a) => `${a.name} (${a.count}x)`);
  const score = Math.min(100, viewsLast7d * 4 + actionsLast7d * 6 + Math.round(totalMinutes / 10));

  return {
    summary: `You spent ~${totalMinutes} minutes in LifeOS. Your most-used surfaces were: ${pages.join(", ") || "—"}.`,
    engagementScore: score,
    hiddenSkills: actions.slice(0, 3).map((a) => ({
      skill: `Repeated use of ${a}`,
      evidence: "You came back to this enough to count as a habit.",
      confidence: 0.5,
    })),
    interests: pages.slice(0, 3).map((p) => ({ label: p, why: "Heavy time-on-page suggests genuine interest." })),
    behaviorPatterns: [
      { pattern: viewsLast7d >= 10 ? "Power-user week" : "Light-touch week", implication: viewsLast7d >= 10 ? "You're in build mode." : "Try a deeper session this week." },
    ],
    careerPaths: [],
    recommendations: [
      { title: "Connect AI for richer insights", action: "Configure the AI provider in environment settings.", impact: "Unlocks personalized career and skill insights." },
    ],
    weeklyReport: { theme: "Behavioral baseline captured", wins: pages.slice(0, 2), watchouts: [] },
  };
}
