import { Router } from "express";
import { getProfile, updateProfile, getCareerInsights } from "../controllers/profileController.js";
import { verifyToken } from "../utils/verifyToken.js";

const router = Router();

router.get("/",    verifyToken, getProfile);
router.put("/",    verifyToken, updateProfile);
router.post("/career-insights", getCareerInsights);

export default router;
