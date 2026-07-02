import { Router } from "express";
import { otpJobController } from "../controllers/otpJob.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", otpJobController.list);
router.post("/", otpJobController.create);

export default router;
