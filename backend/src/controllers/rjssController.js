import { openai } from "../config/openai.js";
import { tryAI } from "../utils/ai.js";
import { tryPg, pgQuery } from "../config/postgres.js";

const CHAT_MODEL   = process.env.OPENAI_CHAT_MODEL   || "gpt-4o-mini";
const SEARCH_MODEL = process.env.OPENAI_SEARCH_MODEL || "gpt-4o";

// ── In-memory scan cache (avoids repeat AI calls for the same profile) ───────
const scanCache  = new Map(); // key → { data, expires }
const CACHE_TTL  = 20 * 60 * 1000; // 20 minutes

function cacheKey(profile) {
  const { age = "", gender = "", student = false, skills = [], interests = [], location = "", currency = "" } = profile;
  return JSON.stringify({
    a:  String(age).trim(),
    g:  gender,
    s:  Boolean(student),
    sk: [...skills].sort(),
    i:  [...interests].sort(),
    l:  location.toLowerCase().trim(),
    c:  currency.toUpperCase().trim(),
  });
}

function getCache(profile) {
  const k = cacheKey(profile);
  const hit = scanCache.get(k);
  if (hit && Date.now() < hit.expires) return hit.data;
  scanCache.delete(k);
  return null;
}

function setCache(profile, data) {
  // Keep cache lean — evict oldest entries when > 50
  if (scanCache.size >= 50) {
    const oldestKey = scanCache.keys().next().value;
    scanCache.delete(oldestKey);
  }
  scanCache.set(cacheKey(profile), { data, expires: Date.now() + CACHE_TTL });
}

function todayStr() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

const JSON_SHAPE = `{
  "jobs": [
    {
      "title": "string",
      "type": "online|offline|hybrid",
      "platform": "string",
      "location": "city, country — or 'Remote / Global'",
      "salaryRange": "₹X–₹Y/hr  or  $X–$Y/hr  or  'varies'",
      "experienceRequired": "none | 0–6 months | 1–2 years | 3+ years",
      "officialLink": "https://direct-apply-link.com (real, working URL — or empty string)",
      "estimatedEarnings": {
        "hourly": "string",
        "daily": "string",
        "weekly": "string",
        "monthly": "string"
      },
      "whyItMatches": "string",
      "difficulty": "beginner|intermediate|advanced",
      "legalityCheck": "verified|regional-restrictions|verify-locally",
      "scamSafeScore": 0,
      "applySteps": ["step1", "step2"],
      "requiredSkills": ["skill1"],
      "sourceUrl": "https://platform-homepage.com",
      "sourceName": "string"
    }
  ],
  "scanMode": "web_search|fallback",
  "userEarningPotential": "string",
  "profileSummary": "string",
  "tips": ["tip1", "tip2"]
}`;

function systemPrompt(liveSearch) {
  return (
    `You are RJSS — LifeOS Real-Time Global Job Signal Scanner. Today is ${todayStr()}.\n` +
    `Scan global job portals, freelancing platforms, gig economy, and local opportunities ` +
    `to find REAL, immediately actionable earning options matched to the user's profile.\n` +
    (liveSearch
      ? "You have live web access. Search for current, real job postings on Fiverr, Upwork, Appen, " +
        "LinkedIn Jobs, Indeed, Internshala, Remote.co, FlexJobs, Amazon Mechanical Turk, Naukri, " +
        "and relevant local boards. Find actual open listings with real apply links.\n"
      : "Use your training knowledge. Return the best-matched real platforms and role types; note earnings may vary.\n") +
    `CRITICAL: Return ONLY strict JSON matching the shape below. No markdown, no text outside JSON.\n${JSON_SHAPE}\n` +
    `Rules:\n` +
    `- Return exactly 5 jobs ranked by match quality\n` +
    `- location: real city/region where the job is available, or 'Remote / Global'\n` +
    `- salaryRange: real salary or hourly rate if findable; otherwise 'varies'\n` +
    `- experienceRequired: honest entry barrier — 'none' for zero-experience roles\n` +
    `- officialLink: deep link to the actual job posting or platform apply page (NOT homepage); empty string if unavailable\n` +
    `- scamSafeScore: 0–100 (100 = verified safe). Exclude any job scoring below 60.\n` +
    `- Calibrate ALL earnings to the user's location and currency\n` +
    `- Prioritise student-friendly roles when student=true\n` +
    `- applySteps: max 3 concise steps\n` +
    `- STRICT JSON ONLY. No text before or after the JSON object.`
  );
}

function userPrompt(profile) {
  const { age, gender, student, skills, interests, location, hoursPerDay, currency } = profile;
  return (
    `PROFILE:\n` +
    `• Age: ${age || "not specified"}\n` +
    `• Gender: ${gender || "not specified"}\n` +
    `• Student: ${student ? "Yes — prioritise student-friendly, internship, micro-task, part-time" : "No"}\n` +
    `• Skills: ${(skills || []).join(", ") || "general"}\n` +
    `• Interests: ${(interests || []).join(", ") || "open"}\n` +
    `• Location: ${location || "global / remote"}\n` +
    `• Hours/day: ${hoursPerDay || 4}\n` +
    `• Currency: ${currency || "auto-detect from location"}\n\n` +
    `SOURCES TO SEARCH: Fiverr, Upwork, Freelancer, Appen, Scale AI, Amazon Mechanical Turk, ` +
    `Remotasks, Internshala, LinkedIn Jobs, Indeed, Naukri, Remote.co, FlexJobs, Toptal, 99designs, ` +
    `local job boards for ${location || "global"}.\n\n` +
    `TASK: Find 5 real, verified, immediately actionable earning opportunities for this profile. ` +
    `Include real location, salary/rate, experience needed, and a direct apply link where possible. ` +
    `Return strict JSON only.`
  );
}

function safeJSON(text) {
  try {
    const start = text.indexOf("{");
    const end   = text.lastIndexOf("}");
    if (start === -1 || end === -1) throw new Error("no JSON object found");
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * POST /api/rjss/scan
 * Body: { age, gender, student, skills[], interests[], location, hoursPerDay, currency }
 */
export async function scanJobs(req, res, next) {
  try {
    const profile = req.body || {};
    const { age, skills, location } = profile;

    if (!age && !skills?.length && !location) {
      return res.status(400).json({
        error: "Provide at least one of: age, skills, or location to start scanning.",
      });
    }

    // ── Cache hit — return instantly ─────────────────────────────────────────
    const cached = getCache(profile);
    if (cached) {
      console.log("[rjss] cache hit — returning in <1ms");
      return res.json({ ...cached, cached: true });
    }

    const prompt = userPrompt(profile);

    // ── Path 1: Responses API with live web search ───────────────────────────
    let scanMode = "web_search";
    try {
      const result = await tryAI(() =>
        openai.responses.create({
          model: SEARCH_MODEL,
          tools: [{ type: "web_search_preview" }],
          input: [
            { role: "system", content: systemPrompt(true) },
            { role: "user",   content: prompt },
          ],
        })
      );

      const text =
        result?.output_text ||
        result?.output
          ?.flatMap?.((o) => o?.content || [])
          ?.filter?.((c) => c?.type === "output_text" || c?.text)
          ?.map?.((c) => c?.text || c?.output_text || "")
          ?.join("") ||
        "";

      if (text.trim()) {
        const parsed = safeJSON(text);
        if (parsed?.jobs?.length) {
          parsed.scanMode = "web_search";
          setCache(profile, parsed);
          return res.json(parsed);
        }
      }
    } catch (searchErr) {
      const code = searchErr?.code || searchErr?.status || "unknown";
      console.warn("[rjss] web_search_preview unavailable (%s) — falling back to chat", code);
      scanMode = "fallback";
    }

    // ── Path 2: Chat completion fallback ────────────────────────────────────
    const completion = await tryAI(() =>
      openai.chat.completions.create({
        model:       CHAT_MODEL,
        max_tokens:  2000,
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt(false) },
          { role: "user",   content: prompt },
        ],
      })
    );

    const rawText = completion.choices?.[0]?.message?.content?.trim() || "";
    const parsed  = safeJSON(rawText);

    if (parsed?.jobs?.length) {
      parsed.scanMode = scanMode;
      setCache(profile, parsed);
      return res.json(parsed);
    }

    return res.status(502).json({
      error: "RJSS could not parse a valid job list. Please try again.",
      raw:   rawText.slice(0, 300),
    });
  } catch (err) {
    return next(err);
  }
}

// ── Save / Track endpoints ────────────────────────────────────────────────────

/**
 * POST /api/rjss/save
 * Body: { id, job, status? }
 */
export async function saveJob(req, res, next) {
  try {
    const userId = req.user?.id || req.guestId || "guest";
    const { id, job, status = "interested" } = req.body || {};
    if (!id || !job?.title) return res.status(400).json({ error: "id and job are required" });

    await tryPg(async () => {
      await pgQuery(
        `INSERT INTO lifeos_saved_jobs (id, user_id, job_data, status, saved_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [id, userId, JSON.stringify(job), status]
      );
    }, null);

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/rjss/saved
 */
export async function getSaved(req, res, next) {
  try {
    const userId = req.user?.id || req.guestId || "guest";

    const rows = await tryPg(async () => {
      const r = await pgQuery(
        `SELECT id, job_data, status, notes, saved_at, updated_at
         FROM lifeos_saved_jobs WHERE user_id = $1
         ORDER BY saved_at DESC LIMIT 100`,
        [userId]
      );
      return r.rows;
    }, []);

    const entries = (rows || []).map((r) => ({
      id:        r.id,
      job:       r.job_data,
      status:    r.status,
      notes:     r.notes || "",
      savedAt:   r.saved_at,
      updatedAt: r.updated_at,
    }));

    return res.json({ entries });
  } catch (err) {
    return next(err);
  }
}

/**
 * PUT /api/rjss/saved/:id
 * Body: { status?, notes? }
 */
export async function updateJobStatus(req, res, next) {
  try {
    const { id }                   = req.params;
    const { status, notes }        = req.body || {};
    const userId = req.user?.id || req.guestId || "guest";

    await tryPg(async () => {
      await pgQuery(
        `UPDATE lifeos_saved_jobs
         SET status = COALESCE($1, status),
             notes  = COALESCE($2, notes),
             updated_at = NOW()
         WHERE id = $3 AND user_id = $4`,
        [status || null, notes ?? null, id, userId]
      );
    }, null);

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

/**
 * DELETE /api/rjss/saved/:id
 */
export async function removeJob(req, res, next) {
  try {
    const { id }   = req.params;
    const userId   = req.user?.id || req.guestId || "guest";

    await tryPg(async () => {
      await pgQuery(
        `DELETE FROM lifeos_saved_jobs WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );
    }, null);

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}
