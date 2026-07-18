import { Router } from "express";
import { misController } from "../controllers/mis.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/dashboard", misController.getDashboard);
router.get("/history", misController.getHistory);
router.post("/targets", misController.setTarget);
router.post("/plans", misController.submitPlans);

export default router;
