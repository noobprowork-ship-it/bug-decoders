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
