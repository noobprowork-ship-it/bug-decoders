import { Router } from "express";
import {
  generateCinematic,
  listCinematics,
  getCinematic,
} from "../controllers/cinematicController.js";
import { verifyToken } from "../utils/verifyToken.js";

const router = Router();

router.use(verifyToken);
router.post("/generate", generateCinematic);
router.get("/", listCinematics);
router.get("/:id", getCinematic);

export default router;
