import { Router } from "express";
import { generateExploreInsights } from "../controllers/exploreController.js";
import { verifyToken } from "../utils/verifyToken.js";

const router = Router();
router.use(verifyToken);
router.post("/insights", generateExploreInsights);
export default router;
