import { Router } from "express";
import { hrDashboardController } from "../controllers/hrDashboard.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", hrDashboardController.getSummary);

export default router;
