import { Router } from "express";
import { delegationController } from "../controllers/delegation.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

// Aggregates — before /:id to avoid capture
router.get("/history", delegationController.getHistory);
router.get("/status-counts", delegationController.getStatusCounts);
router.post("/admin-done", delegationController.markHistoryAdminDone);  // admin

// CRUD
router.get("/", delegationController.getAll);
router.get("/:id", delegationController.getById);
router.post("/", delegationController.create);
router.patch("/:id/status", delegationController.updateStatus);
router.delete("/:id", delegationController.softDelete);

// Submit completion
router.post("/:id/submit", delegationController.submit);

export default router;
