import { Router } from "express";
import {
  findFreeCourses,
  findInternships,
  saveCourse,
  getSavedCourses,
  removeSavedCourse,
} from "../controllers/coursesController.js";

const router = Router();

router.post("/free",         findFreeCourses);
router.post("/internships",  findInternships);
router.post("/save",         saveCourse);
router.get("/saved",         getSavedCourses);
router.delete("/saved/:id",  removeSavedCourse);

export default router;
