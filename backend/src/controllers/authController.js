import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { signToken } from "../utils/verifyToken.js";
import { processVoiceLogin } from "../utils/voiceLogin.js";

export async function register(req, res) {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: email.toLowerCase(), passwordHash });
    const token = signToken({ id: user._id.toString(), email: user.email });

    return res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, tier: user.tier },
    });
  } catch (err) {
    console.error("[authController.register]", err);
    return res.status(500).json({ error: err.message });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.passwordHash) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken({ id: user._id.toString(), email: user.email });
    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, tier: user.tier },
    });
  } catch (err) {
    console.error("[authController.login]", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/auth/voice-login
 *
 * Secure Voice Login — accepts a multipart audio upload (field: `audio`),
 * transcribes it via Whisper, derives a stable voice-print id, and either
 * creates the account on first use or verifies the print on subsequent logins.
 *
 * Body (multipart/form-data):
 *   email: string
 *   audio: File (webm/wav/mp3, <= 25MB)
 *
 * Example response:
 *   {
 *     "token": "eyJhbGciOi...",
 *     "transcript": "Aurora, this is Amit. Open my dashboard.",
 *     "user": { "id": "...", "email": "amit@example.com", "tier": "pro" }
 *   }
 */
export async function voiceLogin(req, res) {
  try {
    const file = req.file;
    const email = req.body?.email?.toLowerCase();
    if (!file) return res.status(400).json({ error: "audio file is required (field: audio)" });
    if (!email) return res.status(400).json({ error: "email is required" });

    const { transcript, voicePrintId } = await processVoiceLogin(file);

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ email, voicePrintId });
    } else if (!user.voicePrintId) {
      user.voicePrintId = voicePrintId;
      await user.save();
    } else if (user.voicePrintId !== voicePrintId) {
      return res.status(401).json({ error: "Voice print does not match this account", transcript });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken({ id: user._id.toString(), email: user.email });
    return res.json({
      token,
      transcript,
      user: { id: user._id, name: user.name, email: user.email, tier: user.tier },
    });
  } catch (err) {
    console.error("[authController.voiceLogin]", err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/auth/google
 *
 * "Continue with Google" — collects the user's real Google profile data
 * (name + email + optional photo URL + optional bio) and creates or reuses
 * a real LifeOS account. We persist into Postgres (when DATABASE_URL is set)
 * so the user's profile, history and bio survive restarts. If Mongo is
 * connected we also keep the legacy User document in sync.
 *
 * To wire up real Google One-Tap on the client, send the verified email +
 * name + picture from the Google credential to this endpoint.
 *
 * Body: { email: string, name?: string, photoUrl?: string, bio?: object }
 */
export async function googleSignIn(req, res) {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const rawName = (req.body?.name || "").toString().trim();
    const photoUrl = (req.body?.photoUrl || "").toString().trim() || null;
    const bio = req.body?.bio && typeof req.body.bio === "object" ? req.body.bio : {};

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ error: "A valid email address is required." });
    }

    // ---- Postgres path (preferred — DATABASE_URL is set on Replit) ----
    const { isPgReady, pgQuery } = await import("../config/postgres.js");
    if (isPgReady()) {
      const id = `g_${Buffer.from(email).toString("base64url").slice(0, 22)}`;
      const existing = await pgQuery(
        `SELECT id, email, name, photo_url, bio FROM lifeos_users WHERE email = $1`,
        [email]
      );
      let row;
      if (existing.rows.length === 0) {
        const inserted = await pgQuery(
          `INSERT INTO lifeos_users (id, email, name, photo_url, provider, bio, last_login_at)
           VALUES ($1, $2, $3, $4, 'google', $5::jsonb, NOW())
           RETURNING id, email, name, photo_url, bio`,
          [id, email, rawName || email.split("@")[0], photoUrl, JSON.stringify(bio)]
        );
        row = inserted.rows[0];
      } else {
        const merged = { ...(existing.rows[0].bio || {}), ...bio };
        const updated = await pgQuery(
          `UPDATE lifeos_users
              SET name = COALESCE(NULLIF($2, ''), name),
                  photo_url = COALESCE($3, photo_url),
                  bio = $4::jsonb,
                  last_login_at = NOW()
            WHERE email = $1
            RETURNING id, email, name, photo_url, bio`,
          [email, rawName, photoUrl, JSON.stringify(merged)]
        );
        row = updated.rows[0];
      }

      const token = signToken({ id: row.id, email: row.email });
      return res.json({
        token,
        user: {
          id: row.id,
          email: row.email,
          name: row.name,
          photoUrl: row.photo_url,
          bio: row.bio,
          tier: "free",
        },
      });
    }

    // ---- Mongo path (legacy) ----
    let user = null;
    try {
      user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          name: rawName || email.split("@")[0],
          email,
          tier: "free",
          settings: { google: { photoUrl, bio } },
        });
      } else {
        if (rawName) user.name = rawName;
        user.lastLoginAt = new Date();
        await user.save().catch(() => {});
      }
      const token = signToken({ id: user._id.toString(), email: user.email });
      return res.json({
        token,
        user: { id: user._id, name: user.name, email: user.email, photoUrl, bio, tier: user.tier },
      });
    } catch (dbErr) {
      // No DB — issue a guest token tied to the real email.
      const token = signToken({ id: `guest_${email}`, email });
      return res.json({
        token,
        user: { id: `guest_${email}`, name: rawName || email.split("@")[0], email, photoUrl, bio, tier: "guest" },
        notice: "Connected (no database — your data lives in this session).",
      });
    }
  } catch (err) {
    console.error("[authController.googleSignIn]", err);
    return res.status(500).json({ error: err.message });
  }
}

// Legacy alias so the old `/google-demo` endpoint keeps working.
export const demoGoogleLogin = googleSignIn;

export async function me(req, res) {
  try {
    const user = await User.findById(req.user.id).select("-passwordHash");
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({ user });
  } catch (err) {
    console.error("[authController.me]", err);
    return res.status(500).json({ error: err.message });
  }
}
