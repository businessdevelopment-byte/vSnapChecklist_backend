import { Router } from "express";
import { misCommitmentController } from "../controllers/misCommitment.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", misCommitmentController.list);
router.post("/submit", misCommitmentController.submit);

export default router;
