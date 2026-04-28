import { Router } from "express";
import {
  getMindProfile,
  decodeMind,
  listMindSessions,
} from "../controllers/mindController.js";
import { verifyToken } from "../utils/verifyToken.js";

const router = Router();

router.use(verifyToken);
router.get("/", getMindProfile);
router.post("/decode", decodeMind);
router.get("/sessions", listMindSessions);

export default router;
