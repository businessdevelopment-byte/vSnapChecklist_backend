import { Router } from "express";
import { photographerAllotmentController } from "../controllers/photographerAllotment.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", photographerAllotmentController.list);
router.post("/apply", photographerAllotmentController.apply);

export default router;
