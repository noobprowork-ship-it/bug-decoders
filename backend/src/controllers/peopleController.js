import { openai } from "../config/openai.js";
import { tryAI } from "../utils/ai.js";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

function systemPrompt() {
  return `You are LifeOS Community Match — an AI that helps people find their tribe online.

When a user describes their interests, skills, personality, and passions, you return a JSON array of the BEST online communities where they'll find genuinely like-minded people.

Communities can include: subreddits, Discord servers, LinkedIn groups, GitHub communities, Slack workspaces, forums, newsletters, podcasts, meetup groups, indie communities, Twitter/X communities.

Return ONLY a raw JSON array (no markdown, no code fences) of objects with this exact shape:
[
  {
    "name": "Community Name",
    "platform": "Reddit | Discord | LinkedIn | GitHub | Forum | Slack | Twitter | Other",
    "platformIcon": "reddit | discord | linkedin | github | slack | twitter | globe",
    "description": "2-3 sentence description of who's there and why it matches this person",
    "matchScore": 92,
    "memberCount": "850k members",
    "link": "https://reddit.com/r/example",
    "tags": ["AI", "startups", "creativity"],
    "why": "One specific sentence explaining exactly why THIS person belongs here",
    "activity": "Very Active | Active | Moderate"
  }
]

Return 8-12 communities. Sort by matchScore descending. Always include at least 2 subreddits, 1 Discord, 1 LinkedIn group. Use real, publicly known communities when possible.`;
}

export async function matchPeople(req, res, next) {
  try {
    const { interests, skills, personality, topics, country, age, bio } = req.body || {};

    const userProfile = [
      interests?.length  ? `Interests: ${interests.join(", ")}` : null,
      skills?.length     ? `Skills: ${skills.join(", ")}` : null,
      personality        ? `Personality: ${personality}` : null,
      topics?.length     ? `Topics they love: ${topics.join(", ")}` : null,
      country            ? `Country: ${country}` : null,
      age                ? `Age: ${age}` : null,
      bio                ? `Bio: ${bio}` : null,
    ].filter(Boolean).join("\n");

    if (!userProfile.trim()) {
      return res.status(400).json({ error: "Please provide at least one interest, skill, or topic." });
    }

    const result = await tryAI(() =>
      openai.chat.completions.create({
        model: CHAT_MODEL,
        max_tokens: 2000,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt() },
          { role: "user",   content: `Find the best communities for this person:\n\n${userProfile}` },
        ],
      })
    );

    const raw = result.choices?.[0]?.message?.content?.trim() || "[]";

    let communities;
    try {
      const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      communities = JSON.parse(cleaned);
      if (!Array.isArray(communities)) communities = [];
    } catch {
      communities = [];
    }

    return res.json({ communities, count: communities.length });
  } catch (err) {
    return next(err);
  }
}
