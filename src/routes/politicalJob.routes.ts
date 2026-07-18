import { Router } from "express";
import { pipelineJobController } from "../controllers/pipelineJob.controller";
import { politicalStageController } from "../controllers/politicalStage.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.post("/", pipelineJobController.createPoliticalJob);
router.get("/:stage/pending", politicalStageController.listPending);
router.get("/:stage/history", politicalStageController.listHistory);
router.post("/:id/advance", politicalStageController.advance);

export default router;
