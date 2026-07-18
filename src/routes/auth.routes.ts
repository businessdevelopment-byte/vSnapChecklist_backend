import { Router } from "express";
import { authController } from "../controllers/auth.controller";
import { loginLimiter, registerLimiter, refreshLimiter } from "../middleware/rateLimiter";

const router = Router();

router.post("/login", loginLimiter, authController.login);
router.post("/register", registerLimiter, authController.register);
router.post("/refresh", refreshLimiter, authController.refresh);
router.post("/logout", authController.logout);

export default router;
