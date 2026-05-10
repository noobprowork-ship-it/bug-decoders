/**
 * Profile controller — full user profile CRUD + AI career analysis.
 *
 * Profile data is stored in the `bio` JSONB column of `lifeos_users`.
 * Fields: about, age, gender, personalityType, skills[], linkedin,
 *         github, portfolio, customLinks[{label,url}], photoUrl
 */

import { pgQuery, isPgReady, tryPg } from "../config/postgres.js";
import { openai } from "../config/openai.js";
import { tryAI } from "../utils/ai.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

/* ── helpers ────────────────────────────────────────────────────────────── */

function userId(req) {
  return req.user?.id || null;
}

function guestProfile(req) {
  return req.body || {};
}

/* ── GET /api/profile ───────────────────────────────────────────────────── */
export async function getProfile(req, res) {
  const uid = userId(req);
  if (!uid || !isPgReady()) {
    return res.json({ profile: null, isGuest: true });
  }
  const row = await tryPg(async () => {
    const r = await pgQuery(
      "SELECT id, email, name, photo_url, bio FROM lifeos_users WHERE id = $1",
      [uid]
    );
    return r.rows[0];
  });
  if (!row) return res.json({ profile: null, isGuest: false });

  const bio = row.bio || {};
  return res.json({
    profile: {
      id:              row.id,
      email:           row.email,
      name:            row.name,
      photoUrl:        row.photo_url || bio.photoUrl || null,
      about:           bio.about || "",
      age:             bio.age || null,
      gender:          bio.gender || "",
      personalityType: bio.personalityType || "",
      skills:          Array.isArray(bio.skills) ? bio.skills : [],
      linkedin:        bio.linkedin || "",
      github:          bio.github || "",
      portfolio:       bio.portfolio || "",
      customLinks:     Array.isArray(bio.customLinks) ? bio.customLinks : [],
    },
  });
}

/* ── PUT /api/profile ───────────────────────────────────────────────────── */
export async function updateProfile(req, res) {
  const uid = userId(req);
  const body = req.body || {};

  const {
    name, photoUrl, about, age, gender, personalityType,
    skills, linkedin, github, portfolio, customLinks,
  } = body;

  if (!uid || !isPgReady()) {
    return res.json({
      ok: true,
      notice: "Profile saved locally (no account — sign in to persist).",
      profile: body,
    });
  }

  const bio = {
    about:           about           || "",
    age:             age             || null,
    gender:          gender          || "",
    personalityType: personalityType || "",
    skills:          Array.isArray(skills) ? skills.filter(Boolean) : [],
    linkedin:        linkedin        || "",
    github:          github          || "",
    portfolio:       portfolio       || "",
    customLinks:     Array.isArray(customLinks) ? customLinks.filter((l) => l?.url) : [],
  };

  const row = await tryPg(async () => {
    const r = await pgQuery(
      `UPDATE lifeos_users
          SET name      = COALESCE(NULLIF($2, ''), name),
              photo_url = COALESCE(NULLIF($3, ''), photo_url),
              bio       = bio || $4::jsonb
        WHERE id = $1
        RETURNING id, email, name, photo_url, bio`,
      [uid, name || "", photoUrl || "", JSON.stringify(bio)]
    );
    return r.rows[0];
  });

  if (!row) return res.status(500).json({ error: "Failed to save profile" });

  const merged = row.bio || {};
  return res.json({
    ok: true,
    profile: {
      id:              row.id,
      email:           row.email,
      name:            row.name,
      photoUrl:        row.photo_url || merged.photoUrl || null,
      about:           merged.about || "",
      age:             merged.age || null,
      gender:          merged.gender || "",
      personalityType: merged.personalityType || "",
      skills:          Array.isArray(merged.skills) ? merged.skills : [],
      linkedin:        merged.linkedin || "",
      github:          merged.github || "",
      portfolio:       merged.portfolio || "",
      customLinks:     Array.isArray(merged.customLinks) ? merged.customLinks : [],
    },
  });
}

/* ── POST /api/profile/career-insights ─────────────────────────────────── */
export async function getCareerInsights(req, res, next) {
  try {
    const profile = req.body?.profile || guestProfile(req);
    const {
      name, age, gender, personalityType, skills = [], about, interests = [],
    } = profile;

    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    const profileText = [
      name            ? `Name: ${name}`                              : null,
      age             ? `Age: ${age}`                               : null,
      gender          ? `Gender: ${gender}`                         : null,
      personalityType ? `Personality type: ${personalityType}`      : null,
      skills.length   ? `Skills: ${skills.join(", ")}`              : null,
      about           ? `Bio / About: ${about}`                     : null,
      interests.length? `Interests: ${interests.join(", ")}`        : null,
    ].filter(Boolean).join("\n");

    if (!profileText.trim()) {
      return res.json({
        jobOpportunities: [],
        careerPaths: [],
        learningPaths: [],
        trendingRoles: [],
        notice: "Add profile details (skills, age, interests) for personalised recommendations.",
      });
    }

    const prompt = `Today is ${today}.

User profile:
${profileText}

You are a world-class career strategist. Based on this profile, produce a JSON object with exactly these keys:

{
  "summary": "2-3 sentence personalised career snapshot",
  "jobOpportunities": [
    {
      "title": "Job title",
      "company_type": "Type of company / sector",
      "match_pct": 85,
      "why": "Why this fits them",
      "action": "Concrete first step"
    }
  ],
  "careerPaths": [
    {
      "path": "Career path name",
      "timeline": "e.g. 2-3 years",
      "potential": "e.g. $80-120k",
      "steps": ["step 1", "step 2", "step 3"]
    }
  ],
  "learningPaths": [
    {
      "skill": "Skill to learn",
      "resource": "Best resource",
      "time": "estimated time",
      "why": "Why this unlocks growth"
    }
  ],
  "trendingRoles": [
    {
      "role": "Role name",
      "demand": "High/Very High/Explosive",
      "avgSalary": "e.g. $90-130k",
      "fit": "How it matches the user"
    }
  ]
}

Provide 5 jobOpportunities, 3 careerPaths, 4 learningPaths, 5 trendingRoles.
Return ONLY valid JSON, no markdown fences.`;

    const completion = await tryAI(() =>
      openai.chat.completions.create({
        model: CHAT_MODEL,
        max_tokens: 1800,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a career intelligence AI. Always return valid JSON. " +
              "Be specific, realistic, and tailored to the user's actual profile. " +
              "Focus on 2025-2026 in-demand roles and real career paths.",
          },
          { role: "user", content: prompt },
        ],
      })
    );

    const raw = completion.choices?.[0]?.message?.content || "{}";
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    return res.json({
      summary:          parsed.summary          || "",
      jobOpportunities: parsed.jobOpportunities || [],
      careerPaths:      parsed.careerPaths      || [],
      learningPaths:    parsed.learningPaths    || [],
      trendingRoles:    parsed.trendingRoles    || [],
    });
  } catch (err) {
    next(err);
  }
}
