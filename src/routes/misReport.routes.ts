import { Router } from "express";
import { misReportController } from "../controllers/misReport.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", misReportController.list);
router.post("/", misReportController.create);

export default router;
