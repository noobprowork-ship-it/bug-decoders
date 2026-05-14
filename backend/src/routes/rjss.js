import { Router } from "express";
import { scanJobs } from "../controllers/rjssController.js";

const router = Router();

router.post("/scan", scanJobs);

export default router;
