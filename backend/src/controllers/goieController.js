import Opportunity from "../models/Opportunity.js";
import { openai } from "../config/openai.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

export async function listOpportunities(req, res) {
  try {
    const { category, region, limit = 50 } = req.query;
    const filter = { userId: req.user.id };
    if (category) filter.category = category;
    if (region) filter.region = region;

    const opportunities = await Opportunity.find(filter)
      .sort({ score: -1, createdAt: -1 })
      .limit(Math.min(Number(limit) || 50, 200));

    return res.json({ opportunities });
  } catch (err) {
    console.error("[goieController.listOpportunities]", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function createOpportunity(req, res) {
  try {
    const payload = { ...req.body, userId: req.user.id };
    const opportunity = await Opportunity.create(payload);
    return res.status(201).json({ opportunity });
  } catch (err) {
    console.error("[goieController.createOpportunity]", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function generateOpportunities(req, res) {
  try {
    const { interests = [], region = "global", count = 5 } = req.body;

    const prompt = `Generate ${count} concrete near-term opportunities for a person interested in: ${interests.join(", ") || "general growth"}.
Region focus: ${region}.
Return JSON array of objects with keys: title, description, category (career|investment|education|relationship|health|creative|other), score (0-100), tags (array of strings).`;

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are GOIE — Aurora's Global Opportunity Intelligence Engine. Always respond with JSON: { opportunities: [...] }." },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = { opportunities: [] }; }
    const items = Array.isArray(parsed.opportunities) ? parsed.opportunities : [];

    const created = await Opportunity.insertMany(
      items.map((o) => ({
        userId: req.user.id,
        title: o.title || "Untitled opportunity",
        description: o.description || "",
        category: o.category || "other",
        region,
        score: Number(o.score) || 0,
        tags: Array.isArray(o.tags) ? o.tags : [],
      }))
    );

    return res.status(201).json({ opportunities: created });
  } catch (err) {
    console.error("[goieController.generateOpportunities]", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function deleteOpportunity(req, res) {
  try {
    const result = await Opportunity.deleteOne({ _id: req.params.id, userId: req.user.id });
    if (!result.deletedCount) return res.status(404).json({ error: "Opportunity not found" });
    return res.json({ ok: true });
  } catch (err) {
    console.error("[goieController.deleteOpportunity]", err);
    return res.status(500).json({ error: err.message });
  }
}
