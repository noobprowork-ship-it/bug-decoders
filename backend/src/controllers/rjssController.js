import { openai } from "../config/openai.js";
import { tryAI } from "../utils/ai.js";

const CHAT_MODEL   = process.env.OPENAI_CHAT_MODEL   || "gpt-4o-mini";
const SEARCH_MODEL = process.env.OPENAI_SEARCH_MODEL || "gpt-4o";

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
      "applySteps": ["step1", "step2", "step3"],
      "requiredSkills": ["skill1"],
      "sourceUrl": "https://example.com",
      "sourceName": "string"
    }
  ],
  "scanMode": "web_search|fallback",
  "userEarningPotential": "string",
  "profileSummary": "string",
  "tips": ["tip1", "tip2", "tip3"]
}`;

function systemPrompt(liveSearch) {
  return (
    `You are RJSS — LifeOS Real-Time Global Job Signal Scanner. Today is ${todayStr()}.\n` +
    `You scan global job portals, freelancing platforms, gig economy, and local opportunities ` +
    `to find real earning options matched to the user's profile.\n` +
    (liveSearch
      ? "You have live web access. Use it to find current, real job signals from Fiverr, Upwork, Appen, " +
        "LinkedIn, Indeed, Internshala, Remote.co, Flex Jobs, Amazon Mechanical Turk, and local boards.\n"
      : "You are using training knowledge. Share the best-matched opportunities you know and note currency may vary.\n") +
    `CRITICAL: Return ONLY strict JSON matching this exact shape. No markdown, no explanations outside JSON:\n${JSON_SHAPE}\n` +
    `Rules:\n` +
    `- Return exactly 5 jobs ranked by match quality\n` +
    `- scamSafeScore: 0-100 (100 = verified safe, <60 = do not include)\n` +
    `- All sourceUrls must be real, verifiable URLs\n` +
    `- Earnings must be calibrated to user's location/currency\n` +
    `- Filter out any opportunity with scamSafeScore < 60\n` +
    `- studentFriendly jobs when student=true\n` +
    `- STRICT JSON ONLY. No text before or after the JSON object.`
  );
}

function userPrompt(profile) {
  const { age, gender, student, skills, interests, location, hoursPerDay, currency } = profile;
  return (
    `SCAN TARGET PROFILE:\n` +
    `• Age: ${age || "not specified"}\n` +
    `• Gender: ${gender || "not specified"}\n` +
    `• Student: ${student ? "Yes — prioritise student-friendly, internship, micro-task, part-time" : "No"}\n` +
    `• Skills: ${(skills || []).join(", ") || "general skills"}\n` +
    `• Interests: ${(interests || []).join(", ") || "open to anything"}\n` +
    `• Location: ${location || "global / remote"}\n` +
    `• Available hours/day: ${hoursPerDay || 4}\n` +
    `• Preferred currency: ${currency || "auto-detect from location"}\n\n` +
    `SCAN SOURCES: Fiverr, Upwork, Freelancer, Appen, Scale AI, Amazon Mechanical Turk, ` +
    `Remotasks, Internshala, LinkedIn Jobs, Indeed, Remote.co, FlexJobs, Toptal, 99designs, ` +
    `local job boards for ${location || "global"}.\n\n` +
    `TASK: Find the top 5 real, verified, immediately actionable earning opportunities for this exact profile. ` +
    `Match skills precisely, estimate earnings in the user's local currency, explain why each job fits their profile. ` +
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

    const prompt = userPrompt(profile);

    // ── Path 1: Responses API with live web search ──────────────────────────
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
        temperature: 0.4,
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
