import { Router } from "express";
import { checklistController } from "../controllers/checklist.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

// Stats & aggregates
router.get("/stats", checklistController.getStats);
router.get("/tab-counts", checklistController.getTabCounts); // Checklist page badges — same WHERE as the list
router.get("/staff-stats", checklistController.getStaffStats); // non-admins: own row only
router.get("/monthly-stats", checklistController.getMonthlyStats); // non-admins: own data only
router.get("/calendar-summary", checklistController.getCalendarSummary);
router.get("/preview", checklistController.previewUpcoming); // read-only projection, no DB writes
router.get("/history", checklistController.getHistory);
router.get("/transferred-in", checklistController.getTransferredIn); // tasks currently on loan to me
router.get("/leave-logs", checklistController.getLeaveLogs); // audit trail for markLeave()
router.get("/report", checklistController.getReport); // Download Report page; non-admins: own data only

// Main list — triggers lazy task generation
router.get("/", checklistController.getEntries);

// Mutations
router.post("/:id/submit", checklistController.submit);
router.post("/admin-done", checklistController.markAdminDone);   // admin
router.post("/leave", checklistController.markLeave);            // admin
router.post("/backfill", checklistController.backfillAll);       // admin: bulk generate past tasks

export default router;
