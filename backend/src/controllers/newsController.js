import { openai } from "../config/openai.js";
import { tryAI } from "../utils/ai.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
const SEARCH_MODEL = process.env.OPENAI_SEARCH_MODEL || "gpt-4o";

/**
 * POST /api/news
 *
 * Aurora's "current affairs" mode. Uses the OpenAI Responses API with the
 * `web_search_preview` tool when available, so the assistant can answer
 * about up-to-the-minute news (markets, wars, space, sports). Falls back
 * to a regular chat completion with an honest disclaimer if web search is
 * not enabled on the account.
 *
 * Body: { query: string, topic?: "general"|"markets"|"sports"|"space"|"world" }
 */
export async function getNews(req, res, next) {
  try {
    const query = String(req.body?.query || "").trim();
    const topic = String(req.body?.topic || "general").toLowerCase();
    if (!query) return res.status(400).json({ error: "query is required" });

    const system =
      "You are Aurora's current-affairs desk. Answer with the latest verified information. " +
      "Cite at least 2 sources inline as [name](url). Keep it short, factual, and voice-friendly. " +
      "If you cannot verify something with a recent source, say so explicitly.";

    // Try Responses API with web_search_preview tool (works on gpt-4o family).
    try {
      const result = await tryAI(() =>
        openai.responses.create({
          model: SEARCH_MODEL,
          tools: [{ type: "web_search_preview" }],
          input: [
            { role: "system", content: system },
            { role: "user", content: `Topic: ${topic}\n\nQuestion: ${query}` },
          ],
        })
      );

      const text =
        result.output_text ||
        result?.output
          ?.flatMap?.((o) => o?.content || [])
          ?.map((c) => c?.text || "")
          ?.join("") ||
        "";

      const sources = extractSources(text);
      return res.json({ answer: text.trim(), sources, mode: "web_search" });
    } catch (searchErr) {
      console.warn("[news] web_search unavailable, falling back:", searchErr?.code || searchErr?.message);
    }

    // Fallback: plain chat completion with an honest disclaimer.
    const completion = await tryAI(() =>
      openai.chat.completions.create({
        model: CHAT_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are Aurora's current-affairs desk. Live web search is unavailable right now, " +
              "so answer from your training data and explicitly note that the information may be outdated. " +
              "Be concise and voice-friendly.",
          },
          { role: "user", content: `Topic: ${topic}\n\nQuestion: ${query}` },
        ],
      })
    );
    const text = completion.choices?.[0]?.message?.content?.trim() || "";
    return res.json({
      answer: text,
      sources: [],
      mode: "fallback",
      notice: "Live web search is not enabled — answer is based on training data and may be outdated.",
    });
  } catch (err) {
    return next(err);
  }
}

function extractSources(text) {
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) out.push({ title: m[1], url: m[2] });
  return out;
}
