import { Router } from "express";
import { rawDataQcController } from "../controllers/rawDataQc.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", rawDataQcController.list);

export default router;
