import { Router } from "express";
import multer from "multer";
import { register, login, voiceLogin, googleSignIn, demoGoogleLogin, me } from "../controllers/authController.js";
import { verifyToken } from "../utils/verifyToken.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.post("/register", register);
router.post("/login", login);
router.post("/voice-login", upload.single("audio"), voiceLogin);
router.post("/google", googleSignIn);
router.post("/google-demo", demoGoogleLogin);
router.get("/me", verifyToken, me);

export default router;
