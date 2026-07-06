import { Router } from "express";
import { dailyAttendanceController } from "../controllers/dailyAttendance.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/me", dailyAttendanceController.myAttendance);
router.get("/", dailyAttendanceController.list);
router.post("/", dailyAttendanceController.create);

export default router;
