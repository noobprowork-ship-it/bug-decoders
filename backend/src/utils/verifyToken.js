import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const GUEST_COOKIE = "aurora.guest";
const GUEST_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyTokenString(token) {
  return jwt.verify(token, JWT_SECRET);
}

function ensureGuest(req, res) {
  const existing = req.cookies?.[GUEST_COOKIE];
  if (existing && /^guest_[a-f0-9]{16,}$/.test(existing)) return existing;
  const id = `guest_${crypto.randomBytes(12).toString("hex")}`;
  res.cookie(GUEST_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: GUEST_MAX_AGE_MS,
  });
  return id;
}

export function verifyToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      req.isGuest = false;
      return next();
    } catch (err) {
      console.warn("[verifyToken] invalid token, falling back to guest:", err.message);
    }
  }

  const id = ensureGuest(req, res);
  req.user = { id, email: `${id}@guest.aurora`, name: "Guest" };
  req.isGuest = true;
  return next();
}

export function requireRealUser(req, res, next) {
  if (req.isGuest) {
    return res.status(401).json({ error: "Sign in to access this resource" });
  }
  return next();
}

export default verifyToken;
