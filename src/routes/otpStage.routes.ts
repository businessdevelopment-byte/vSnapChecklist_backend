import { Router } from "express";
import { otpStageController } from "../controllers/otpStage.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/:stage/pending", otpStageController.listPending);
router.get("/:stage/history", otpStageController.listHistory);
router.post("/:id/advance", otpStageController.advance);

export default router;
