import { Router } from "express";
import { editedDataQcController } from "../controllers/editedDataQc.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", editedDataQcController.list);

export default router;
