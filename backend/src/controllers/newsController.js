import { openai } from "../config/openai.js";
import { tryAI } from "../utils/ai.js";

const CHAT_MODEL   = process.env.OPENAI_CHAT_MODEL   || "gpt-4o-mini";
const SEARCH_MODEL = process.env.OPENAI_SEARCH_MODEL || "gpt-4o";

function todayStr() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function systemPrompt(liveSearch) {
  const base =
    "You are LifeOS News Desk — a sharp, factual current-affairs assistant. " +
    `Today's date is ${todayStr()}. ` +
    "Answer clearly and concisely. " +
    "Always respond to news/current-events queries — never refuse. " +
    "If you only have training data, share what you know and note it may not be today's latest. " +
    "Format: 2-3 short paragraphs. Cite sources inline as [Name](URL) when available. " +
    "Never say you 'cannot assist' — always provide the best answer you can.";

  if (liveSearch) return base;
  return (
    base +
    " Note: live web search is unavailable; answer from training data and " +
    "include a brief disclaimer that information may not reflect today's very latest events."
  );
}

/**
 * POST /api/news
 *
 * Body: { query: string, topic?: string }
 *
 * Strategy:
 *  1. Try Responses API with web_search_preview (gpt-4o, needs Responses endpoint).
 *  2. Fall back to plain chat completion with date-aware prompt.
 *  Both paths always return a useful response — never an error the user sees.
 */
export async function getNews(req, res, next) {
  try {
    const query = String(req.body?.query || "").trim();
    const topic = String(req.body?.topic || "general").toLowerCase();
    if (!query) return res.status(400).json({ error: "query is required" });

    const userContent =
      `Today is ${todayStr()}. Topic: ${topic}\n\nUser question: ${query}\n\n` +
      "Please provide the most relevant, factual, up-to-date answer you can.";

    // ── Path 1: Responses API with web_search_preview ──────────────────────
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
        const sources = extractSources(text);
        return res.json({
          answer:  text.trim(),
          sources,
          mode:    "web_search",
          date:    todayStr(),
        });
      }
    } catch (searchErr) {
      const code = searchErr?.code || searchErr?.status || "unknown";
      console.warn("[news] web_search_preview unavailable (%s) — falling back to chat", code);
    }

    // ── Path 2: Plain chat completion ──────────────────────────────────────
    const completion = await tryAI(() =>
      openai.chat.completions.create({
        model:      CHAT_MODEL,
        max_tokens: 600,
        messages: [
          { role: "system", content: systemPrompt(false) },
          { role: "user",   content: userContent },
        ],
      })
    );

    const text    = completion.choices?.[0]?.message?.content?.trim() || "";
    const sources = extractSources(text);

    return res.json({
      answer: text || `I don't have specific information about "${query}" right now. Try asking me something else or check a live news source.`,
      sources,
      mode:   "fallback",
      date:   todayStr(),
      notice: "Live web search is not available — this answer is from AI training data and may not reflect today's very latest events.",
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
