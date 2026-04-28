import OpenAI from "openai";

// Prefer Replit AI Integrations (managed billing, no key required from user).
// Falls back to a user-provided OPENAI_API_KEY if those env vars are missing.
const integrationKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
const integrationBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
const userKey = process.env.OPENAI_API_KEY;

const apiKey = integrationKey || userKey;
const baseURL = integrationBaseUrl || undefined;

export const isAIConfigured = Boolean(apiKey);
export const isUsingReplitAIIntegration = Boolean(integrationKey && integrationBaseUrl);

if (!isAIConfigured) {
  console.warn("[openai] No AI provider configured — AI calls will fail until provided.");
} else if (isUsingReplitAIIntegration) {
  console.log("[openai] Using Replit AI Integrations (managed billing).");
} else {
  console.log("[openai] Using user-provided OPENAI_API_KEY.");
}

export const openai = new OpenAI({
  apiKey: apiKey || "missing-key",
  baseURL,
});

export default openai;
