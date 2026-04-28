/**
 * Centralized OpenAI error translation.
 *
 * Wraps any OpenAI SDK call with `tryAI(() => openai.chat.completions.create(...))`
 * so that quota / rate-limit / auth / network failures bubble up as a structured
 * `AIError` instead of a generic 500 with cryptic provider text.
 *
 * The Express error middleware in `server.js` recognizes `AIError` and turns it
 * into a clean JSON response the frontend can render with a helpful hint.
 */

export class AIError extends Error {
  constructor({
    status = 502,
    code = "ai_unavailable",
    message,
    hint,
    providerStatus,
    providerCode,
    providerMessage,
  } = {}) {
    super(message || providerMessage || "AI provider error");
    this.name = "AIError";
    this.status = status;
    this.code = code;
    this.hint = hint;
    this.providerStatus = providerStatus;
    this.providerCode = providerCode;
    this.providerMessage = providerMessage;
  }
}

export function isAIError(err) {
  return !!err && (err.name === "AIError" || err instanceof AIError);
}

export function aiErrorPayload(err) {
  return {
    error: err.message,
    code: err.code,
    hint: err.hint,
    providerStatus: err.providerStatus,
    providerCode: err.providerCode,
  };
}

/**
 * Run an OpenAI SDK call. On failure, throws an AIError with proper status,
 * a stable `code` for the frontend, and a friendly `hint` for the user.
 */
export async function tryAI(fn) {
  const hasIntegration =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const hasUserKey = process.env.OPENAI_API_KEY;
  if (!hasIntegration && !hasUserKey) {
    throw new AIError({
      status: 503,
      code: "ai_not_configured",
      message: "Aurora's AI provider is not configured on this server.",
      hint: "Connect Replit AI Integrations or set OPENAI_API_KEY in the server environment.",
    });
  }

  try {
    return await fn();
  } catch (err) {
    const providerStatus = err?.status;
    const providerCode = err?.code || err?.error?.code;
    const providerMessage = err?.error?.message || err?.message || "Unknown AI provider error";

    if (providerCode === "insufficient_quota") {
      throw new AIError({
        status: 503,
        code: "ai_quota_exceeded",
        message: "Aurora's AI provider is out of credits.",
        hint: "Add billing or top up credits on the OpenAI account behind OPENAI_API_KEY, then try again.",
        providerStatus,
        providerCode,
        providerMessage,
      });
    }

    if (providerStatus === 429) {
      throw new AIError({
        status: 503,
        code: "ai_rate_limited",
        message: "Aurora is being rate-limited by the AI provider.",
        hint: "Wait a few seconds and try again.",
        providerStatus,
        providerCode,
        providerMessage,
      });
    }

    if (providerStatus === 401 || providerCode === "invalid_api_key") {
      throw new AIError({
        status: 503,
        code: "ai_auth_failed",
        message: "Aurora's AI provider rejected the API key.",
        hint: "Replace OPENAI_API_KEY with a valid key and restart the server.",
        providerStatus,
        providerCode,
        providerMessage,
      });
    }

    if (providerStatus >= 500) {
      throw new AIError({
        status: 502,
        code: "ai_provider_down",
        message: "Aurora's AI provider is temporarily unavailable.",
        hint: "Try again in a moment.",
        providerStatus,
        providerCode,
        providerMessage,
      });
    }

    throw new AIError({
      status: 502,
      code: "ai_provider_error",
      message: providerMessage,
      providerStatus,
      providerCode,
      providerMessage,
    });
  }
}
