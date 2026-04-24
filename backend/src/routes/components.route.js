import express from "express";
import {
  chatComponents,
  initComponents
} from "../controllers/components.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

// optional init (first time load)
router.post("/components/init", protectRoute, initComponents);

// main chat
router.post("/components/chat", protectRoute, chatComponents);

export default router;