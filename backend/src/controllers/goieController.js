import Opportunity from "../models/Opportunity.js";
import { openai } from "../config/openai.js";
import { requireFields, safeJSON, asArray, clampInt } from "../utils/validate.js";
import { tryDB, dbReady } from "../utils/db.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

export async function listOpportunities(req, res) {
  const { category, region } = req.query;
  const limit = clampInt(req.query.limit, { min: 1, max: 200, fallback: 50 });
  const filter = { userId: req.user.id };
  if (category) filter.category = category;
  if (region) filter.region = region;

  const opportunities = await tryDB(
    () => Opportunity.find(filter).sort({ score: -1, createdAt: -1 }).limit(limit).lean(),
    []
  );
  return res.json({ opportunities: opportunities || [] });
}

export async function createOpportunity(req, res) {
  try {
    if (!requireFields(req.body, ["title"], res)) return;
    const payload = { ...req.body, userId: req.user.id };
    const opportunity = await tryDB(() => Opportunity.create(payload), null);
    if (!opportunity) {
      return res.status(503).json({ error: "Persistence is not available right now" });
    }
    return res.status(201).json({ opportunity });
  } catch (err) {
    console.error("[goieController.createOpportunity]", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function generateOpportunities(req, res) {
  try {
    const interests = asArray(req.body?.interests);
    const skills = asArray(req.body?.skills);
    const region = req.body?.region || "global";
    const count = clampInt(req.body?.count, { min: 1, max: 15, fallback: 5 });
    const timeframe = req.body?.timeframe || "90d";

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are GOIE — Aurora's Global Opportunity Intelligence Engine. Output strict JSON ONLY: { opportunities:[{title,description,category(career|investment|education|relationship|health|creative|other),score(0-100),tags:[],sourceUrl}] }.",
        },
        {
          role: "user",
          content: `Generate ${count} concrete opportunities.
Interests: ${interests.join(", ") || "general growth"}
Skills: ${skills.join(", ") || "n/a"}
Region: ${region}
Timeframe: ${timeframe}.`,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = safeJSON(raw, { opportunities: [] });
    const items = Array.isArray(parsed.opportunities) ? parsed.opportunities : [];

    const docs = items.map((o) => ({
      userId: req.user.id,
      title: o.title || "Untitled opportunity",
      description: o.description || "",
      category: o.category || "other",
      region,
      score: clampInt(o.score, { min: 0, max: 100, fallback: 50 }),
      tags: Array.isArray(o.tags) ? o.tags : [],
      sourceUrl: o.sourceUrl || undefined,
      metadata: { timeframe, interests, skills },
    }));

    let opportunities = docs;
    if (dbReady()) {
      const created = await tryDB(() => Opportunity.insertMany(docs), null);
      if (created) opportunities = created;
    }
    return res.status(201).json({ opportunities });
  } catch (err) {
    console.error("[goieController.generateOpportunities]", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function getTrends(req, res) {
  try {
    const focus = req.body?.focus || "global opportunities";
    const region = req.body?.region || "global";

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are GOIE's Trends layer. Output strict JSON ONLY: { headline, trends:[{label,delta,horizon,confidence(0-1)}], insights:[], actionPrompts:[] }.",
        },
        { role: "user", content: `Focus: ${focus}. Region: ${region}.` },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? "{}";
    const parsed = safeJSON(raw, {});
    return res.json(parsed);
  } catch (err) {
    console.error("[goieController.getTrends]", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function deleteOpportunity(req, res) {
  const result = await tryDB(
    () => Opportunity.deleteOne({ _id: req.params.id, userId: req.user.id }),
    null
  );
  if (!result || !result.deletedCount) {
    return res.status(404).json({ error: "Opportunity not found" });
  }
  return res.json({ ok: true });
}
