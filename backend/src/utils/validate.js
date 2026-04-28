/**
 * Tiny validation helpers. Returns `true` if validation passed, otherwise
 * sends a 400 response and returns `false`.
 */

export function requireFields(body, fields, res) {
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Request body must be a JSON object" });
    return false;
  }
  for (const f of fields) {
    const v = body[f];
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) {
      res.status(400).json({ error: `Missing required field: ${f}` });
      return false;
    }
  }
  return true;
}

export function asArray(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return fallback;
  return [value];
}

export function clampInt(value, { min = 0, max = 100, fallback = 0 } = {}) {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/**
 * Safely parse JSON returned by an LLM. Falls back to an empty object so
 * callers never crash on a malformed model response.
 */
export function safeJSON(raw, fallback = {}) {
  if (typeof raw !== "string") return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* ignore */ }
    }
    return fallback;
  }
}
