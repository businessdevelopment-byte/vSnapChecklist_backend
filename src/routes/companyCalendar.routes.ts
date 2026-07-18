import { Router } from "express";
import { companyCalendarController } from "../controllers/companyCalendar.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", companyCalendarController.list);
router.post("/", companyCalendarController.create);

export default router;
