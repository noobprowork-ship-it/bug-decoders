import { openai } from "../config/openai.js";
import { safeJSON, asArray } from "../utils/validate.js";
import { tryAI } from "../utils/ai.js";

const CHAT_MODEL   = process.env.OPENAI_CHAT_MODEL   || "gpt-4o-mini";
const SEARCH_MODEL = process.env.OPENAI_SEARCH_MODEL || "gpt-4o";

/**
 * POST /api/explore/insights
 *
 * Takes a summary of the user's in-app behavior (page views, feature
 * interactions, time-on-screen) and returns AI-generated insights:
 * hidden skills, behavioral patterns, suggested careers, and habits.
 * Falls back to a deterministic structure when AI isn't available.
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

// ── Smart Match ───────────────────────────────────────────────────────────────

const SMART_MATCH_SHAPE = `{
  "summary": "string — 2-3 sentences about the user's profile and match quality",
  "jobMatches": [
    {
      "title": "string",
      "platform": "string — job board or gig platform",
      "matchScore": 0,
      "whyMatch": "string — 1-2 sentences",
      "applyUrl": "https://real-apply-link.com",
      "salary": "string — estimated salary/rate"
    }
  ],
  "courseRecs": [
    {
      "title": "string",
      "provider": "string",
      "url": "https://course-url.com",
      "level": "beginner|intermediate|advanced",
      "duration": "string",
      "whyMatch": "string — why this course fits the user"
    }
  ],
  "careerPaths": [
    {
      "title": "string",
      "fit": 0,
      "roadmap": "string — 2-3 sentence roadmap",
      "timeline": "string — e.g. '6–12 months'"
    }
  ],
  "topSkillsToLearn": [
    {
      "skill": "string",
      "reason": "string",
      "resourceUrl": "https://free-resource-url.com"
    }
  ],
  "insights": ["string — brief actionable insight"]
}`;

/**
 * POST /api/explore/smart-match
 * Body: { interests[], skills[], platforms, goals, activitySummary }
 */
export async function generateSmartMatch(req, res, next) {
  try {
    const {
      interests = [],
      skills = [],
      platforms = "",
      goals = "",
      activitySummary = {},
    } = req.body || {};

    if (!interests.length && !skills.length && !goals) {
      return res.status(400).json({ error: "Provide at least interests, skills, or goals." });
    }

    const sysPrompt =
      `You are LifeOS Smart Match — a personalized career and learning intelligence engine.\n` +
      `Analyze the user's profile and generate highly personalized matches for jobs, courses, and career paths.\n` +
      `Use live web knowledge of current job market and courses (Coursera, edX, Udemy, LinkedIn Jobs, Indeed, etc.).\n` +
      `Return ONLY strict JSON with this shape:\n${SMART_MATCH_SHAPE}\n` +
      `Rules:\n` +
      `- jobMatches: return 4–5 real, specific roles — NOT generic titles. Include real platforms.\n` +
      `- courseRecs: return 3–4 real courses that are freely available or well-known paid options. Include real URLs.\n` +
      `- careerPaths: return 3 concrete paths with honest fit scores.\n` +
      `- topSkillsToLearn: return 4 skills with free resource URLs.\n` +
      `- insights: return 3–5 punchy, actionable insights.\n` +
      `- matchScore and fit must be realistic integers 0–100.\n` +
      `- STRICT JSON ONLY. No markdown.`;

    const userPrompt =
      `USER PROFILE:\n` +
      `• Interests: ${interests.join(", ") || "general"}\n` +
      `• Current skills: ${skills.join(", ") || "general"}\n` +
      `• Content consumed: ${platforms || "not specified"}\n` +
      `• Goals: ${goals || "not specified"}\n` +
      `• LifeOS activity: ${JSON.stringify(activitySummary)}\n\n` +
      `Generate personalized job matches, course recommendations, career paths, and top skills to learn. Strict JSON only.`;

    let result = null;

    // Try web search first for live data
    try {
      const resp = await tryAI(() =>
        openai.responses.create({
          model: SEARCH_MODEL,
          tools: [{ type: "web_search_preview" }],
          input: [
            { role: "system", content: sysPrompt },
            { role: "user",   content: userPrompt },
          ],
        })
      );

      const text =
        resp?.output_text ||
        resp?.output
          ?.flatMap?.((o) => o?.content || [])
          ?.filter?.((c) => c?.type === "output_text" || c?.text)
          ?.map?.((c) => c?.text || c?.output_text || "")
          ?.join("") || "";

      if (text.trim()) {
        const start = text.indexOf("{"); const end = text.lastIndexOf("}");
        if (start !== -1 && end !== -1) {
          try { result = JSON.parse(text.slice(start, end + 1)); } catch { /* ignore */ }
        }
      }
    } catch (searchErr) {
      console.warn("[smart-match] web search unavailable — fallback to chat");
    }

    // Chat completion fallback
    if (!result) {
      const completion = await tryAI(() =>
        openai.chat.completions.create({
          model: CHAT_MODEL,
          response_format: { type: "json_object" },
          max_tokens: 3000,
          temperature: 0.4,
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user",   content: userPrompt },
          ],
        })
      );
      const raw = completion.choices?.[0]?.message?.content ?? "{}";
      result = safeJSON(raw, {});
    }

    if (!result?.summary) {
      return res.status(502).json({ error: "Smart match could not generate results. Please try again." });
    }

    return res.json({ match: result });
  } catch (err) {
    return next(err);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyReport() {
  return {
    summary: "Not enough activity yet — open a few modules and interact with them so LifeOS can learn your patterns.",
    engagementScore: 0,
    hiddenSkills: [],
    interests: [],
    behaviorPatterns: [],
    careerPaths: [],
    recommendations: [
      { title: "Try a module", action: "Open GOIE, Mind, or Multiverse from the home dashboard.", impact: "Seeds your first signal." },
    ],
    weeklyReport: { theme: "Just getting started", wins: [], watchouts: [] },
  };
}

function deterministicReport({ topPages, topActions, totalMinutes, viewsLast7d, actionsLast7d }) {
  const niceName = (p) => {
    const map = {
      "/dashboard": "Home", "/goie": "GOIE", "/multiverse": "Multiverse",
      "/mind": "Mind", "/voice": "Voice AI", "/explore": "Explore",
      "/rjss": "Jobs", "/courses": "Courses",
    };
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
