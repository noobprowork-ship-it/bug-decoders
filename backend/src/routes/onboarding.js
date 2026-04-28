import { Router } from "express";
import {
  startOnboarding,
  answerOnboarding,
  getOnboardingProfile,
} from "../controllers/onboardingController.js";
import { verifyToken } from "../utils/verifyToken.js";

const router = Router();
router.use(verifyToken);
router.post("/start", startOnboarding);
router.post("/answer", answerOnboarding);
router.get("/profile", getOnboardingProfile);
export default router;
