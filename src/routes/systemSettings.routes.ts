import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { systemSettingsController } from "../controllers/systemSettings.controller";

const router = Router();

router.get("/",    authMiddleware, systemSettingsController.get);
router.patch("/",  authMiddleware, systemSettingsController.update);

export default router;
