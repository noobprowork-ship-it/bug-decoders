import { Router } from "express";
import { generateExploreInsights, generateSmartMatch } from "../controllers/exploreController.js";
import { verifyToken } from "../utils/verifyToken.js";

const router = Router();
router.use(verifyToken);
router.post("/insights",     generateExploreInsights);
router.post("/smart-match",  generateSmartMatch);
export default router;
