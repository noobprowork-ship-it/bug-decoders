import { Router } from "express";
import { analyzeActivity, latestAnalysis } from "../controllers/activityController.js";
import { verifyToken } from "../utils/verifyToken.js";

const router = Router();
router.use(verifyToken);
router.post("/analyze", analyzeActivity);
router.get("/latest", latestAnalysis);
export default router;
