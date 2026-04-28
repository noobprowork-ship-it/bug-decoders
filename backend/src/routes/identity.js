import { Router } from "express";
import {
  getIdentity,
  updateIdentity,
  generateIdentityInsights,
  getEvolutionGraph,
} from "../controllers/identityController.js";
import { verifyToken } from "../utils/verifyToken.js";

const router = Router();

router.use(verifyToken);
router.get("/", getIdentity);
router.put("/", updateIdentity);
router.post("/insights", generateIdentityInsights);
router.get("/evolution", getEvolutionGraph);

export default router;
