import { Router } from "express";
import { editorAllotmentController } from "../controllers/editorAllotment.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", editorAllotmentController.list);

export default router;
