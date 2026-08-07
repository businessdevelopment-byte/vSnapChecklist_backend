import { Router } from "express";
import { pmsStageController } from "../controllers/pmsStage.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

// Before /:stage/* so "assigned-members" isn't captured as a stage param.
router.get("/assigned-members", pmsStageController.listAssignedMembers);
router.get("/:stage/pending", pmsStageController.listPending);
router.get("/:stage/history", pmsStageController.listHistory);
router.post("/:id/advance", pmsStageController.advance);

export default router;
