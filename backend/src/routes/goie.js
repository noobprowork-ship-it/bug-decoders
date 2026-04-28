import { Router } from "express";
import {
  listOpportunities,
  createOpportunity,
  generateOpportunities,
  getTrends,
  deleteOpportunity,
} from "../controllers/goieController.js";
import { verifyToken } from "../utils/verifyToken.js";

const router = Router();

router.use(verifyToken);
router.get("/", listOpportunities);
router.post("/", createOpportunity);
router.post("/generate", generateOpportunities);
router.post("/trends", getTrends);
router.delete("/:id", deleteOpportunity);

export default router;
