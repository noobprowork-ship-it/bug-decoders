import { Router } from "express";
import { chat, listSessions, getSession } from "../controllers/aiController.js";
import { verifyToken } from "../utils/verifyToken.js";

const router = Router();

router.use(verifyToken);
router.post("/chat", chat);
router.get("/sessions", listSessions);
router.get("/sessions/:id", getSession);

export default router;
