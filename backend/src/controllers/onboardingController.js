import User from "../models/User.js";
import { openai } from "../config/openai.js";
import { safeJSON } from "../utils/validate.js";
import { tryDB, dbReady } from "../utils/db.js";
import { tryAI } from "../utils/ai.js";

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

const inMemoryOnboarding = new Map();

function getState(userId) {
  if (!inMemoryOnboarding.has(userId)) {
    inMemoryOnboarding.set(userId, { step: 0, answers: {}, completed: false });
  }
  return inMemoryOnboarding.get(userId);
}

export async function startOnboarding(req, res) {
  const fresh = { step: 0, answers: {}, startedAt: new Date(), completed: false };
  inMemoryOnboarding.set(req.user.id, fresh);
  await tryDB(() =>
    User.findByIdAndUpdate(req.user.id, { $set: { "settings.onboarding": fresh } })
  );
  const q = ONBOARDING_QUESTIONS[0];
  return res.json({
    step: 1,
    totalSteps: ONBOARDING_QUESTIONS.length,
    question: { id: q.id, prompt: q.prompt },
    progressPct: Math.round((1 / ONBOARDING_QUESTIONS.length) * 100),
  });
}

export async function answerOnboarding(req, res, next) {
  try {
    const { questionId, answer } = req.body || {};
    if (!questionId || answer === undefined || answer === null) {
      return res.status(400).json({ error: "questionId and answer are required" });
    }

    const idx = ONBOARDING_QUESTIONS.findIndex((q) => q.id === questionId);
    if (idx === -1) return res.status(400).json({ error: `Unknown questionId: ${questionId}` });

    const state = getState(req.user.id);
    state.answers[questionId] = answer;
    state.step = idx + 1;

    const next_q = ONBOARDING_QUESTIONS[idx + 1];

    if (next_q) {
      if (dbReady()) {
        await tryDB(() =>
          User.findByIdAndUpdate(req.user.id, { $set: { "settings.onboarding": state } })
        );
      }
      return res.json({
        done: false,
        step: idx + 2,
        totalSteps: ONBOARDING_QUESTIONS.length,
        question: { id: next_q.id, prompt: next_q.prompt },
        progressPct: Math.round(((idx + 2) / ONBOARDING_QUESTIONS.length) * 100),
      });
    }

    const completion = await tryAI(() =>
      openai.chat.completions.create({
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
      })
    );

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const profile = safeJSON(raw, {});

    state.completed = true;
    state.completedAt = new Date();
    state.profile = profile;

    await tryDB(() =>
      User.findByIdAndUpdate(req.user.id, {
        $set: {
          "settings.onboarding": state,
          identityProfile: profile,
          ...(state.answers.name ? { name: String(state.answers.name).trim() } : {}),
        },
      })
    );

    return res.json({ done: true, profile });
  } catch (err) {
    return next(err);
  }
}

export async function getOnboardingProfile(req, res) {
  const state = inMemoryOnboarding.get(req.user.id);
  const dbUser = await tryDB(
    () => User.findById(req.user.id).select("settings identityProfile name email").lean(),
    null
  );
  const merged = state || dbUser?.settings?.onboarding || { step: 0, answers: {}, completed: false };
  return res.json({
    completed: !!merged.completed,
    step: merged.step || 0,
    totalSteps: ONBOARDING_QUESTIONS.length,
    answers: merged.answers || {},
    profile: merged.profile || dbUser?.identityProfile || null,
  });
}
