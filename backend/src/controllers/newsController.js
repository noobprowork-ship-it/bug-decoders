import { openai } from "../config/openai.js";
import { tryAI } from "../utils/ai.js";

const CHAT_MODEL   = process.env.OPENAI_CHAT_MODEL   || "gpt-4o-mini";
const SEARCH_MODEL = process.env.OPENAI_SEARCH_MODEL || "gpt-4o";

function todayStr() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function hashStr(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

function getImageUrl(topic, index = 0) {
  // picsum.photos accepts any string seed and returns a consistent, free photo
  const seed = encodeURIComponent(`${topic}-${index}`);
  return `https://picsum.photos/seed/${seed}/800/420`;
}

function systemPrompt(liveSearch) {
  const dateStr = todayStr();
  const base = `You are LifeOS News Desk — a sharp, factual current-affairs assistant.
Today's date is ${dateStr}.

Always respond to news/current-events queries — NEVER refuse.
Return ONLY a raw JSON object (no markdown, no code fences) with this exact shape:
{
  "headline": "One overall headline summarising the topic",
  "summary": "2-3 sentence overview of the topic",
  "articles": [
    {
      "title": "Article title",
      "description": "2-3 sentence summary of this specific story",
      "source": "Source name (e.g. BBC, Reuters, TechCrunch)",
      "sourceUrl": "https://...",
      "category": "Technology | Business | Science | Sports | Politics | Health | Entertainment | World",
      "publishedAt": "e.g. May 16, 2025",
      "keywords": ["keyword1", "keyword2"]
    }
  ]
}
Return 5-8 articles. Use real, known sources when possible. Never fabricate quotes as real.`;

  if (!liveSearch) {
    return base + `\nNote: live web search is unavailable; answer from training data. Set publishedAt to "${dateStr}" for all articles.`;
  }
  return base;
}

/**
 * POST /api/news
 * Body: { query: string, topic?: string }
 */
export async function getNews(req, res, next) {
  try {
    const query = String(req.body?.query || "").trim();
    const topic = String(req.body?.topic || "general").toLowerCase();
    if (!query) return res.status(400).json({ error: "query is required" });

    const userContent =
      `Today is ${todayStr()}. Topic: ${topic}\n\nUser question: ${query}\n\n` +
      "Return a structured JSON news report as instructed.";

    let rawJson = null;
    let mode = "fallback";

    // ── Path 1: Responses API with web_search_preview ──────────────────
    try {
      const result = await tryAI(() =>
        openai.responses.create({
          model: SEARCH_MODEL,
          tools: [{ type: "web_search_preview" }],
          input: [
            { role: "system", content: systemPrompt(true) },
            { role: "user",   content: userContent },
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
        rawJson = text.trim();
        mode = "web_search";
      }
    } catch (searchErr) {
      const code = searchErr?.code || searchErr?.status || "unknown";
      console.warn("[news] web_search_preview unavailable (%s) — falling back to chat", code);
    }

    // ── Path 2: Chat completion fallback ───────────────────────────────
    if (!rawJson) {
      const completion = await tryAI(() =>
        openai.chat.completions.create({
          model:      CHAT_MODEL,
          max_tokens: 2000,
          temperature: 0.5,
          messages: [
            { role: "system", content: systemPrompt(false) },
            { role: "user",   content: userContent },
          ],
        })
      );
      rawJson = completion.choices?.[0]?.message?.content?.trim() || "";
    }

    // ── Parse JSON ─────────────────────────────────────────────────────
    let parsed = null;
    try {
      const cleaned = rawJson
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "")
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // If JSON parse fails, return plain text response for backwards compat
      const sources = extractSources(rawJson);
      return res.json({
        answer:   rawJson,
        articles: [],
        sources,
        mode,
        date: todayStr(),
      });
    }

    // Add images to each article
    const articles = (parsed.articles || []).map((a, i) => ({
      ...a,
      imageUrl: getImageUrl(a.keywords?.[0] || topic, i),
    }));

    return res.json({
      headline: parsed.headline || query,
      summary:  parsed.summary  || "",
      articles,
      mode,
      date: todayStr(),
      ...(mode === "fallback" ? {
        notice: "Live web search is not available — this answer is from AI training data.",
      } : {}),
    });
  } catch (err) {
    return next(err);
  }
}

function extractSources(text) {
  const re  = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ title: m[1], url: m[2] });
  }
  return out;
}
