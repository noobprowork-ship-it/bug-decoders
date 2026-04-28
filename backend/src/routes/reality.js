import { Router } from "express";
import { planWeek, latestWeekPlan } from "../controllers/realityController.js";
import { verifyToken } from "../utils/verifyToken.js";

const router = Router();
router.use(verifyToken);
router.post("/plan-week", planWeek);
router.get("/latest", latestWeekPlan);
export default router;
