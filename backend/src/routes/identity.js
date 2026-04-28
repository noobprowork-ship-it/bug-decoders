import { Router } from "express";
import {
  getIdentity,
  updateIdentity,
  generateIdentityInsights,
} from "../controllers/identityController.js";
import { verifyToken } from "../utils/verifyToken.js";

const router = Router();

router.use(verifyToken);
router.get("/", getIdentity);
router.put("/", updateIdentity);
router.post("/insights", generateIdentityInsights);

export default router;
