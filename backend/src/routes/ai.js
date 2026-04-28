import { Router } from "express";
import multer from "multer";
import { chat, listSessions, getSession, transcribe } from "../controllers/aiController.js";
import { verifyToken } from "../utils/verifyToken.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.use(verifyToken);
router.post("/chat", chat);
router.post("/transcribe", upload.single("audio"), transcribe);
router.get("/sessions", listSessions);
router.get("/sessions/:id", getSession);

export default router;
