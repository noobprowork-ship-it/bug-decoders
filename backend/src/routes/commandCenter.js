import { Router } from "express";
import { planCommandCenter, latestCommandCenter } from "../controllers/commandCenterController.js";
import { verifyToken } from "../utils/verifyToken.js";

const router = Router();
router.use(verifyToken);
router.post("/plan", planCommandCenter);
router.get("/latest", latestCommandCenter);
export default router;
