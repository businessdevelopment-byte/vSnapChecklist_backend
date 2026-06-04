import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.post("/login", authController.login);
router.post("/register", authController.register);
router.post("/logout", authMiddleware, authController.logout);

export default router;
