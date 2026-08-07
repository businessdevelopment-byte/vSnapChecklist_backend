import { Router } from "express";
import { advanceController } from "../controllers/advance.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", advanceController.summary);

export default router;
