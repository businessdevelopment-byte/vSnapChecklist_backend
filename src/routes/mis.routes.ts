import { Router } from "express";
import { misController } from "../controllers/mis.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/dashboard", misController.getDashboard);
router.get("/history", misController.getHistory);
router.get("/sheet/for-records", misController.getSheetForRecords); // read-only Google Sheet tab
router.get("/employee/:userId/checklist-drilldown", misController.getChecklistDrilldown); // MIS drill-down, Checklist & Delegation
router.post("/targets", misController.setTarget);
router.post("/plans", misController.submitPlans);   // admin: anyone · staff: own row, next week only
router.post("/images", misController.setImages);    // admin: anyone · staff: own row, current week only

export default router;
