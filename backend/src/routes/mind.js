import { Router } from "express";
import {
  getMindProfile,
  decodeMind,
  exploreMindUniverse,
  generateThoughts,
  listMindSessions,
} from "../controllers/mindController.js";
import { verifyToken } from "../utils/verifyToken.js";

const router = Router();

router.use(verifyToken);
router.get("/", getMindProfile);
router.post("/decode", decodeMind);
router.post("/explore", exploreMindUniverse);
router.post("/thoughts", generateThoughts);
router.get("/sessions", listMindSessions);

export default router;
