import { Router } from "express";
import {
  listOpportunities,
  createOpportunity,
  generateOpportunities,
  deleteOpportunity,
} from "../controllers/goieController.js";
import { verifyToken } from "../utils/verifyToken.js";

const router = Router();

router.use(verifyToken);
router.get("/", listOpportunities);
router.post("/", createOpportunity);
router.post("/generate", generateOpportunities);
router.delete("/:id", deleteOpportunity);

export default router;
