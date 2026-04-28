import { Router } from "express";
import { simulate, listSimulations } from "../controllers/multiverseController.js";
import { verifyToken } from "../utils/verifyToken.js";

const router = Router();

router.use(verifyToken);
router.post("/simulate", simulate);
router.get("/", listSimulations);

export default router;
