import { Router } from "express";
import { checklistController } from "../controllers/checklist.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

// Stats & aggregates
router.get("/stats", checklistController.getStats);
router.get("/staff-stats", checklistController.getStaffStats); // admin
router.get("/monthly-stats", checklistController.getMonthlyStats); // admin
router.get("/history", checklistController.getHistory);

// Main list — triggers lazy task generation
router.get("/", checklistController.getEntries);

// Mutations
router.post("/:id/submit", checklistController.submit);
router.post("/admin-done", checklistController.markAdminDone);   // admin
router.post("/leave", checklistController.markLeave);            // admin
router.post("/backfill", checklistController.backfillAll);       // admin: bulk generate past tasks

export default router;
