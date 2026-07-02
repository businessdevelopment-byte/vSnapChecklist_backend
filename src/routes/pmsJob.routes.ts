import { Router } from "express";
import { pipelineJobController } from "../controllers/pipelineJob.controller";
import { pmsStageController } from "../controllers/pmsStage.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.post("/", pipelineJobController.createPmsJob);
router.get("/:stage/pending", pmsStageController.listPending);
router.get("/:stage/history", pmsStageController.listHistory);
router.post("/:id/advance", pmsStageController.advance);

export default router;
