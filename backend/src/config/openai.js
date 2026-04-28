import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn("[openai] OPENAI_API_KEY is not set — AI calls will fail until provided.");
}

export const openai = new OpenAI({
  apiKey: apiKey || "missing-key",
});

export default openai;
