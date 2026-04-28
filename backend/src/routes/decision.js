import { Router } from "express";
import { evaluate, listDecisions } from "../controllers/decisionController.js";
import { verifyToken } from "../utils/verifyToken.js";

const router = Router();

router.use(verifyToken);
router.post("/evaluate", evaluate);
router.get("/", listDecisions);

export default router;
