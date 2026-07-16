import { Router } from "express";
import { vacancyController } from "../controllers/vacancy.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", vacancyController.list);
router.post("/", vacancyController.create);
router.get("/:vacancyNumber", vacancyController.getByNumber);
router.patch("/:vacancyNumber", vacancyController.updateByNumber);
router.patch("/:vacancyNumber/approval", vacancyController.updateApproval);
router.delete("/:vacancyNumber", vacancyController.deleteByNumber);

export default router;
