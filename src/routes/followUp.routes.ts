import { Router } from "express";
import { followUpController } from "../controllers/followUp.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/callable-enquiries", followUpController.listCallableEnquiries);
router.get("/", followUpController.listHistory);
router.post("/", followUpController.create);

export default router;
