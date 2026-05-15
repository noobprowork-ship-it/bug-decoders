import { openai } from "../config/openai.js";
import { tryAI } from "../utils/ai.js";
import { tryPg, pgQuery } from "../config/postgres.js";

const CHAT_MODEL   = process.env.OPENAI_CHAT_MODEL   || "gpt-4o-mini";
const SEARCH_MODEL = process.env.OPENAI_SEARCH_MODEL || "gpt-4o";

function todayStr() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
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

// ── In-memory cache ──────────────────────────────────────────────────────────
const courseCache = new Map();
const internCache = new Map();
const CACHE_TTL   = 30 * 60 * 1000; // 30 min

function getC(map, key) {
  const hit = map.get(key);
  if (hit && Date.now() < hit.expires) return hit.data;
  map.delete(key);
  return null;
}
function setC(map, key, data) {
  if (map.size >= 40) map.delete(map.keys().next().value);
  map.set(key, { data, expires: Date.now() + CACHE_TTL });
}

// ── Free Courses ─────────────────────────────────────────────────────────────
const COURSE_SHAPE = `{
  "courses": [
    {
      "title": "string",
      "provider": "Coursera|edX|Udemy|Khan Academy|MIT OpenCourseWare|YouTube|FreeCodeCamp|Google|Microsoft|AWS|other",
      "providerUrl": "https://provider-homepage.com",
      "courseUrl": "https://direct-course-link.com",
      "topic": "string",
      "level": "beginner|intermediate|advanced",
      "durationHours": 0,
      "durationLabel": "string — e.g. '6 hours', '4 weeks'",
      "certificate": true,
      "certificateName": "string — e.g. 'Google Data Analytics Certificate' or empty",
      "language": "English",
      "rating": 4.5,
      "ratingCount": 1000,
      "skills": ["skill1", "skill2"],
      "description": "string — 2-3 sentences about what you'll learn",
      "prerequisites": "string — what you need before starting, or 'None'",
      "isFree": true,
      "paidOption": "string — e.g. 'Certificate for $49' or 'Audit free, full access $29/mo' or 'Fully free'"
    }
  ],
  "searchSummary": "string — 1-2 sentences about the results",
  "totalFound": 0,
  "scanMode": "web_search|fallback"
}`;

/**
 * POST /api/courses/free
 * Body: { topic, level?, maxHours?, wantsCertificate?, language? }
 */
export async function findFreeCourses(req, res, next) {
  try {
    const {
      topic = "programming",
      level = "any",
      maxHours,
      wantsCertificate = false,
      language = "English",
      count = 6,
    } = req.body || {};

    if (!topic?.trim()) {
      return res.status(400).json({ error: "topic is required" });
    }

    const cacheKey = JSON.stringify({ topic: topic.toLowerCase().trim(), level, maxHours, wantsCertificate, language, count });
    const cached = getC(courseCache, cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const sysPrompt =
      `You are LifeOS Free Course Scout. Today is ${todayStr()}.\n` +
      `Find REAL, freely accessible online courses matching the user's request.\n` +
      `Focus on: Coursera (audit), edX (audit), Khan Academy, MIT OCW, FreeCodeCamp, YouTube channels with structured courses, Google/Microsoft/AWS free tiers, Udemy free courses.\n` +
      `CRITICAL: Only include courses that are genuinely free to access (audit or full free). Paid-only courses must NOT be included.\n` +
      `Return ONLY strict JSON matching this shape:\n${COURSE_SHAPE}\n` +
      `Rules:\n` +
      `- Return exactly ${Math.min(count, 8)} courses\n` +
      `- courseUrl must be a real, working direct link to the course page\n` +
      `- rating and ratingCount must be realistic (skip if unknown — use 0)\n` +
      `- certificate: true only if the course offers a real certificate (even if paid)\n` +
      `- isFree: MUST be true for all results\n` +
      `- description: concise, specific, what the learner gains\n` +
      `- STRICT JSON ONLY. No markdown.`;

    const userPrompt =
      `Find free online courses for:\n` +
      `• Topic/Skill: ${topic}\n` +
      `• Level: ${level}\n` +
      `• Max duration: ${maxHours ? `${maxHours} hours` : "any"}\n` +
      `• Certificate needed: ${wantsCertificate ? "Yes, preferred" : "Not required"}\n` +
      `• Language: ${language}\n\n` +
      `Return ${Math.min(count, 8)} real, free, high-quality courses. Strict JSON only.`;

    // Try web search first
    let scanMode = "web_search";
    try {
      const result = await tryAI(() =>
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
        result?.output_text ||
        result?.output
          ?.flatMap?.((o) => o?.content || [])
          ?.filter?.((c) => c?.type === "output_text" || c?.text)
          ?.map?.((c) => c?.text || c?.output_text || "")
          ?.join("") || "";

      if (text.trim()) {
        const parsed = safeJSON(text);
        if (parsed?.courses?.length) {
          parsed.scanMode = "web_search";
          setC(courseCache, cacheKey, parsed);
          return res.json(parsed);
        }
      }
    } catch (searchErr) {
      console.warn("[courses] web_search unavailable (%s) — fallback", searchErr?.code || searchErr?.status || "unknown");
      scanMode = "fallback";
    }

    // Fallback: chat completion
    const completion = await tryAI(() =>
      openai.chat.completions.create({
        model: CHAT_MODEL,
        max_tokens: 2500,
        temperature: 0.3,
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user",   content: userPrompt },
        ],
      })
    );

    const rawText = completion.choices?.[0]?.message?.content?.trim() || "";
    const parsed  = safeJSON(rawText);

    if (parsed?.courses?.length) {
      parsed.scanMode = scanMode;
      setC(courseCache, cacheKey, parsed);
      return res.json(parsed);
    }

    return res.status(502).json({ error: "Could not parse course results. Please try again.", raw: rawText.slice(0, 200) });
  } catch (err) {
    return next(err);
  }
}

// ── Internships ──────────────────────────────────────────────────────────────
const INTERN_SHAPE = `{
  "internships": [
    {
      "role": "string",
      "company": "string",
      "companyWebsite": "https://company.com",
      "location": "city, country — or 'Remote'",
      "type": "remote|onsite|hybrid",
      "duration": "string — e.g. '3 months', '6 weeks', '1 semester'",
      "stipend": "string — e.g. '$500/mo', 'Unpaid', '₹10,000/mo', 'Varies'",
      "skills": ["skill1", "skill2"],
      "description": "string — what the intern will do day-to-day",
      "requirements": "string — qualifications, degree year, GPA etc.",
      "applyUrl": "https://direct-apply-link.com",
      "applyPlatform": "string — e.g. 'LinkedIn', 'company careers page', 'Internshala'",
      "deadline": "string — e.g. 'Rolling', 'Dec 31 2025', 'Unknown'",
      "perks": ["perk1", "perk2"],
      "scamSafeScore": 90
    }
  ],
  "searchSummary": "string",
  "totalFound": 0,
  "scanMode": "web_search|fallback"
}`;

/**
 * POST /api/courses/internships
 * Body: { skills[], location?, type?, field?, student? }
 */
export async function findInternships(req, res, next) {
  try {
    const {
      skills = [],
      location = "global",
      type = "any",
      field = "any",
      student = true,
      count = 6,
    } = req.body || {};

    if (!skills?.length && !field) {
      return res.status(400).json({ error: "Provide at least skills or field" });
    }

    const cacheKey = JSON.stringify({ skills: [...(skills || [])].sort(), location, type, field, count });
    const cached = getC(internCache, cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const sysPrompt =
      `You are LifeOS Internship Scout. Today is ${todayStr()}.\n` +
      `Find REAL, currently open (or rolling) internship opportunities matching the user's profile.\n` +
      `Sources: LinkedIn, Internshala, Indeed, Glassdoor, AngelList, company career pages, WayUp, Chegg Internships, government/NGO programs.\n` +
      `CRITICAL: Only include legitimate, scam-safe internships (scamSafeScore ≥ 65).\n` +
      `Return ONLY strict JSON matching this shape:\n${INTERN_SHAPE}\n` +
      `Rules:\n` +
      `- Return exactly ${Math.min(count, 8)} internships ranked by relevance and scam safety\n` +
      `- applyUrl: direct link to the application page or job listing — NOT a homepage\n` +
      `- stipend: be honest — include unpaid if that's the reality\n` +
      `- scamSafeScore: 0–100 (exclude anything below 65)\n` +
      `- STRICT JSON ONLY. No markdown.`;

    const userPrompt =
      `Find internships for:\n` +
      `• Skills: ${(skills || []).join(", ") || "general"}\n` +
      `• Field/Industry: ${field}\n` +
      `• Location: ${location}\n` +
      `• Type: ${type}\n` +
      `• Student: ${student ? "Yes" : "No"}\n\n` +
      `Return ${Math.min(count, 8)} real, open internships. Strict JSON only.`;

    let scanMode = "web_search";
    try {
      const result = await tryAI(() =>
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
        result?.output_text ||
        result?.output
          ?.flatMap?.((o) => o?.content || [])
          ?.filter?.((c) => c?.type === "output_text" || c?.text)
          ?.map?.((c) => c?.text || c?.output_text || "")
          ?.join("") || "";

      if (text.trim()) {
        const parsed = safeJSON(text);
        if (parsed?.internships?.length) {
          parsed.scanMode = "web_search";
          setC(internCache, cacheKey, parsed);
          return res.json(parsed);
        }
      }
    } catch (searchErr) {
      console.warn("[internships] web_search unavailable — fallback");
      scanMode = "fallback";
    }

    const completion = await tryAI(() =>
      openai.chat.completions.create({
        model: CHAT_MODEL,
        max_tokens: 2500,
        temperature: 0.3,
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user",   content: userPrompt },
        ],
      })
    );

    const rawText = completion.choices?.[0]?.message?.content?.trim() || "";
    const parsed  = safeJSON(rawText);

    if (parsed?.internships?.length) {
      parsed.scanMode = scanMode;
      setC(internCache, cacheKey, parsed);
      return res.json(parsed);
    }

    return res.status(502).json({ error: "Could not parse internship results. Please try again.", raw: rawText.slice(0, 200) });
  } catch (err) {
    return next(err);
  }
}

// ── Save Course ──────────────────────────────────────────────────────────────
export async function saveCourse(req, res, next) {
  try {
    const userId = req.user?.id || req.guestId || "guest";
    const { id, item, itemType = "course" } = req.body || {};
    if (!id || !item?.title) return res.status(400).json({ error: "id and item are required" });

    await tryPg(async () => {
      await pgQuery(
        `INSERT INTO lifeos_saved_courses (id, user_id, item_data, item_type, saved_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (id) DO NOTHING`,
        [id, userId, JSON.stringify(item), itemType]
      );
    }, null);

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}

export async function getSavedCourses(req, res, next) {
  try {
    const userId = req.user?.id || req.guestId || "guest";

    const rows = await tryPg(async () => {
      const r = await pgQuery(
        `SELECT id, item_data, item_type, saved_at
         FROM lifeos_saved_courses WHERE user_id = $1
         ORDER BY saved_at DESC LIMIT 100`,
        [userId]
      );
      return r.rows;
    }, []);

    const entries = (rows || []).map((r) => ({
      id: r.id, item: r.item_data, itemType: r.item_type, savedAt: r.saved_at,
    }));

    return res.json({ entries });
  } catch (err) {
    return next(err);
  }
}

export async function removeSavedCourse(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.guestId || "guest";
    await tryPg(async () => {
      await pgQuery(`DELETE FROM lifeos_saved_courses WHERE id = $1 AND user_id = $2`, [id, userId]);
    }, null);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
}
