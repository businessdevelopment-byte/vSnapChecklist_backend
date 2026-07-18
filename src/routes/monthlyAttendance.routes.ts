import { Router } from "express";
import { monthlyAttendanceController } from "../controllers/monthlyAttendance.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", monthlyAttendanceController.list);
router.post("/", monthlyAttendanceController.create);

export default router;
