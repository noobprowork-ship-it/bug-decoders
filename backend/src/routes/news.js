import { Router } from "express";
import { getNews } from "../controllers/newsController.js";

const router = Router();
router.post("/", getNews);

export default router;
