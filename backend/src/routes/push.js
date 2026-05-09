import { Router } from "express";
import {
  getVapidKey,
  subscribe,
  unsubscribe,
  sendTest,
} from "../controllers/pushController.js";

const router = Router();

// Public — frontend needs the VAPID public key to build a subscription
router.get("/vapid-public-key", getVapidKey);

// Save a subscription (called after browser push permission granted)
router.post("/subscribe", subscribe);

// Remove a subscription (called when user opts out)
router.delete("/subscribe", unsubscribe);

// Send an immediate test notification to confirm things work
router.post("/test", sendTest);

export default router;
