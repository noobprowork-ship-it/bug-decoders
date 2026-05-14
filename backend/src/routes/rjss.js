import { Router } from "express";
import { scanJobs, saveJob, getSaved, updateJobStatus, removeJob } from "../controllers/rjssController.js";

const router = Router();

router.post("/scan",        scanJobs);
router.post("/save",        saveJob);
router.get("/saved",        getSaved);
router.put("/saved/:id",    updateJobStatus);
router.delete("/saved/:id", removeJob);

export default router;
