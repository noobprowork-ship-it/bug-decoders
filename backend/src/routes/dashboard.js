import { Router } from "express";
import { getDashboard } from "../controllers/dashboardController.js";
import { verifyToken } from "../utils/verifyToken.js";

const router = Router();
router.use(verifyToken);
router.get("/", getDashboard);
export default router;
