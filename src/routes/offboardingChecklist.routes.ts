import { Router } from "express";
import { offboardingChecklistController } from "../controllers/offboardingChecklist.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/pending", offboardingChecklistController.listPending);
router.get("/", offboardingChecklistController.listHistory);
router.post("/", offboardingChecklistController.create);

export default router;
