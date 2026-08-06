import { Router } from "express";
import { delegationController } from "../controllers/delegation.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

// Aggregates — before /:id to avoid capture
router.get("/history",          delegationController.getHistory);
router.get("/status-counts",    delegationController.getStatusCounts);
router.get("/mis-stats",        delegationController.getMisStats);
router.get("/mis-staff-stats",  delegationController.getMisStaffStats);
router.post("/admin-done",      delegationController.markHistoryAdminDone);  // admin
router.get("/submissions",      delegationController.listSubmissions);       // admin
router.post("/import",          delegationController.importMany);

// CRUD
router.get("/", delegationController.getAll);
router.get("/:id", delegationController.getById);
router.post("/", delegationController.create);
router.patch("/:id/status", delegationController.updateStatus);
router.delete("/:id", delegationController.softDelete);

// Submit completion
router.post("/:id/submit", delegationController.submit);

// Admin review of submitted "Done" completions
router.post("/history/:historyId/approve", delegationController.approveSubmission);
router.post("/history/:historyId/reject",  delegationController.rejectSubmission);

export default router;
