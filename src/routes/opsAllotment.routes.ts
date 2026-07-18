import { Router } from "express";
import { opsAllotmentController } from "../controllers/opsAllotment.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", opsAllotmentController.list);
router.post("/apply", opsAllotmentController.apply);

export default router;
