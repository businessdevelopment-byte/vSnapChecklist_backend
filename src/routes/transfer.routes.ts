import { Router } from "express";
import { transferController } from "../controllers/transfer.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.post("/", transferController.transferTasks);   // admin only
router.get("/logs", transferController.getTransferLogs);

export default router;
