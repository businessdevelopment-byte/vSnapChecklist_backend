import { Router } from "express";
import { holidayController } from "../controllers/holiday.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/",                  holidayController.getAll);
router.get("/working-days",      holidayController.getWorkingDays);
router.post("/",                 holidayController.create);
router.delete("/:id",            holidayController.remove);

export default router;
