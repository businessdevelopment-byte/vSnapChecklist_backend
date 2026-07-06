import { Router } from "express";
import { onboardingChecklistController } from "../controllers/onboardingChecklist.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/pending", onboardingChecklistController.listPending);
router.get("/", onboardingChecklistController.listHistory);
router.post("/", onboardingChecklistController.create);

export default router;
