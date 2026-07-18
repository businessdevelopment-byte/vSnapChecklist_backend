import { Router } from "express";
import { leavingRecordController } from "../controllers/leavingRecord.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/pending", leavingRecordController.listPending);
router.get("/", leavingRecordController.listHistory);
router.post("/", leavingRecordController.create);

export default router;
