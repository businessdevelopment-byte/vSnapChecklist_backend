import { Router } from "express";
import { editingHoursPerJobController } from "../controllers/editingHoursPerJob.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", editingHoursPerJobController.list);

export default router;
