import User from "../models/User.js";
import { openai } from "../config/openai.js";
import { safeJSON } from "../utils/validate.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

const ONBOARDING_QUESTIONS = [
  { id: "name", prompt: "What should Aurora call you?", field: "name" },
  { id: "purpose", prompt: "In one sentence, what are you optimizing your life for right now?", field: "purpose" },
  { id: "horizon", prompt: "What's the biggest outcome you want in the next 12 months?", field: "horizon" },
  { id: "energy", prompt: "When do you feel most alive and productive in a typical day?", field: "energyWindow" },
  { id: "blockers", prompt: "What pattern keeps blocking you the most?", field: "blockers" },
  { id: "values", prompt: "Name 3 values that must guide every big decision you make.", field: "values" },
  { id: "skills", prompt: "List 3 skills you're proud of and 1 you wish you had.", field: "skills" },
];

/**
 * POST /api/onboarding/start — initializes onboarding state and returns the first question.
 *
 * Example response:
 *   {
 *     "step": 1,
 *     "totalSteps": 7,
 *     "question": { "id": "name", "prompt": "What should Aurora call you?" },
 *     "progressPct": 14
 *   }
 */
export async function startOnboarding(req, res) {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      $set: {
        "settings.onboarding": { step: 0, answers: {}, startedAt: new Date(), completed: false },
      },
    });
    const q = ONBOARDING_QUESTIONS[0];
    return res.json({
      step: 1,
      totalSteps: ONBOARDING_QUESTIONS.length,
      question: { id: q.id, prompt: q.prompt },
      progressPct: Math.round((1 / ONBOARDING_QUESTIONS.length) * 100),
    });
  } catch (err) {
    console.error("[onboardingController.startOnboarding]", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/onboarding/answer
 *
 * Body: { questionId: string, answer: string }
 *
 * Example response (next question):
 *   { "done": false, "step": 3, "totalSteps": 7, "question": { "id": "horizon", "prompt": "..." }, "progressPct": 43 }
 *
 * Example response (final step — returns full profile built by AI):
 *   {
 *     "done": true,
 *     "profile": {
 *       "archetype": "Visionary Builder",
 *       "summary": "...",
 *       "strengths": [...],
 *       "growthEdges": [...],
 *       "recommendedRituals": [...]
 *     }
 *   }
 */
export async function answerOnboarding(req, res) {
  try {
    const { questionId, answer } = req.body || {};
    if (!questionId || answer === undefined || answer === null) {
      return res.status(400).json({ error: "questionId and answer are required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const state = user.settings?.onboarding || { step: 0, answers: {}, completed: false };
    const idx = ONBOARDING_QUESTIONS.findIndex((q) => q.id === questionId);
    if (idx === -1) return res.status(400).json({ error: `Unknown questionId: ${questionId}` });

    state.answers[questionId] = answer;
    state.step = idx + 1;

    if (questionId === "name") user.name = String(answer).trim();

    const next = ONBOARDING_QUESTIONS[idx + 1];

    if (next) {
      user.settings = { ...(user.settings || {}), onboarding: state };
      user.markModified("settings");
      await user.save();
      return res.json({
        done: false,
        step: idx + 2,
        totalSteps: ONBOARDING_QUESTIONS.length,
        question: { id: next.id, prompt: next.prompt },
        progressPct: Math.round(((idx + 2) / ONBOARDING_QUESTIONS.length) * 100),
      });
    }

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are Aurora's Smart Onboarding. Build a tight user profile from their answers. Output strict JSON ONLY: { archetype, summary, strengths:[], growthEdges:[], recommendedRituals:[{name,why,cadence}], firstWeekFocus }.",
        },
        { role: "user", content: `Answers: ${JSON.stringify(state.answers)}` },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const profile = safeJSON(raw, {});

    state.completed = true;
    state.completedAt = new Date();
    state.profile = profile;
    user.settings = { ...(user.settings || {}), onboarding: state };
    user.identityProfile = { ...(user.identityProfile || {}), ...profile };
    user.markModified("settings");
    user.markModified("identityProfile");
    await user.save();

    return res.json({ done: true, profile });
  } catch (err) {
    console.error("[onboardingController.answerOnboarding]", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/onboarding/profile — returns the built profile and onboarding state.
 *
 * Example response:
 *   {
 *     "completed": true,
 *     "answers": { ... },
 *     "profile": { "archetype": "Visionary Builder", ... }
 *   }
 */
export async function getOnboardingProfile(req, res) {
  try {
    const user = await User.findById(req.user.id).select("settings identityProfile name email");
    const state = user?.settings?.onboarding || { step: 0, answers: {}, completed: false };
    return res.json({
      completed: !!state.completed,
      step: state.step || 0,
      totalSteps: ONBOARDING_QUESTIONS.length,
      answers: state.answers || {},
      profile: state.profile || user?.identityProfile || null,
    });
  } catch (err) {
    console.error("[onboardingController.getOnboardingProfile]", err);
    return res.status(500).json({ error: err.message });
  }
}
