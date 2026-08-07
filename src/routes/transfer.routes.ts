import { Router } from "express";
import { transferController } from "../controllers/transfer.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.post("/requests", transferController.createRequest);              // any authenticated user
router.get("/requests", transferController.listRequests);                // admin only (enforced in controller)
router.post("/requests/:id/approve", transferController.approveRequest); // admin only
router.post("/requests/:id/reject", transferController.rejectRequest);   // admin only
router.get("/logs", transferController.getTransferLogs);

export default router;
