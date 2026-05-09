import { openai } from "../config/openai.js";
import { tryAI } from "../utils/ai.js";

const CHAT_MODEL   = process.env.OPENAI_CHAT_MODEL   || "gpt-4o-mini";
const SEARCH_MODEL = process.env.OPENAI_SEARCH_MODEL || "gpt-4o-mini";

const SYSTEM_PROMPT =
  "You are LifeOS News Desk — a sharp, concise current-affairs assistant. " +
  "Answer with the most recent verified information you have. " +
  "Cite at least 2 sources inline as [name](url) when they are available. " +
  "Keep answers short, factual, and voice-friendly (max 3 short paragraphs). " +
  "If you are unsure about recent events, clearly say so.";

/**
 * POST /api/news
 *
 * Body: { query: string, topic?: "general"|"markets"|"sports"|"space"|"world" }
 *
 * Strategy:
 *  1. Try Responses API with web_search_preview (gpt-4o family, needs Responses endpoint).
 *  2. Fall back to plain chat completion with a live-search disclaimer.
 *  Both paths fail fast and cleanly so the UI always gets a response.
 */
export async function getNews(req, res, next) {
  try {
    const query = String(req.body?.query || "").trim();
    const topic = String(req.body?.topic || "general").toLowerCase();
    if (!query) return res.status(400).json({ error: "query is required" });

    const userContent = `Topic: ${topic}\n\nQuestion: ${query}`;

    // ── Path 1: Responses API with web_search_preview ──────────────────────
    try {
      const result = await tryAI(() =>
        openai.responses.create({
          model: SEARCH_MODEL,
          tools: [{ type: "web_search_preview" }],
          input: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user",   content: userContent },
          ],
        })
      );

      // Normalise output across SDK versions
      const text =
        result?.output_text ||
        result?.output
          ?.flatMap?.((o) => o?.content || [])
          ?.filter?.((c) => c?.type === "output_text" || c?.text)
          ?.map?.((c) => c?.text || c?.output_text || "")
          ?.join("") ||
        "";

      if (text.trim()) {
        const sources = extractSources(text);
        return res.json({ answer: text.trim(), sources, mode: "web_search" });
      }
      // Empty response — fall through to chat completion
    } catch (searchErr) {
      // Expected: web_search not enabled on this key/provider — fall through silently
      const code = searchErr?.code || searchErr?.status || "unknown";
      console.warn("[news] web_search_preview unavailable (%s) — falling back to chat", code);
    }

    // ── Path 2: Plain chat completion ──────────────────────────────────────
    const completion = await tryAI(() =>
      openai.chat.completions.create({
        model: CHAT_MODEL,
        max_tokens: 512,
        messages: [
          {
            role: "system",
            content:
              SYSTEM_PROMPT +
              " Live web search is unavailable, so answer from training data and " +
              "explicitly note if information may be outdated.",
          },
          { role: "user", content: userContent },
        ],
      })
    );

    const text = completion.choices?.[0]?.message?.content?.trim() || "";
    const sources = extractSources(text);
    return res.json({
      answer: text || "I couldn't find information on that right now.",
      sources,
      mode: "fallback",
      notice:
        "Live web search is not available — this answer is based on training data and may be outdated.",
    });
  } catch (err) {
    return next(err);
  }
}

function extractSources(text) {
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ title: m[1], url: m[2] });
  }
  return out;
}
