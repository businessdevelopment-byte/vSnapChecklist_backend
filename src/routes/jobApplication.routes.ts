import { Router } from "express";
import { jobApplicationController } from "../controllers/jobApplication.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", jobApplicationController.list);
router.post("/", jobApplicationController.create);
router.get("/:id", jobApplicationController.getById);

export default router;
