import { Router } from "express";
import { listSessions, getSessionMessages } from "../utils/sessions.js";
import { verifyTokenString } from "../utils/verifyToken.js";

const router = Router();

function optionalAuth(req, _res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (token) {
    try {
      req.user = verifyTokenString(token);
    } catch {
      /* ignore — anonymous */
    }
  }
  next();
}

router.use(optionalAuth);

router.get("/", async (req, res, next) => {
  try {
    const items = await listSessions({ userId: req.user?.id || null, limit: 50 });
    res.json({ sessions: items });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const data = await getSessionMessages({ sessionId: req.params.id, userId: req.user?.id || null });
    if (!data) return res.status(404).json({ error: "Session not found" });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
