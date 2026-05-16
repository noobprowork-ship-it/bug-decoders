import { Router } from "express";
import { matchPeople } from "../controllers/peopleController.js";

const router = Router();
router.post("/match", matchPeople);

export default router;
