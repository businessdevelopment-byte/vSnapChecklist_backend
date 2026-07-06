import { Router } from "express";
import { leaveRequestController } from "../controllers/leaveRequest.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/balances", leaveRequestController.balances);
router.get("/all", leaveRequestController.listAll);
router.get("/", leaveRequestController.list);
router.post("/", leaveRequestController.create);
router.patch("/:id/status", leaveRequestController.updateStatus);

export default router;
