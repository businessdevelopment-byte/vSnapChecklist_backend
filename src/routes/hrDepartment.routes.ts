import { Router } from "express";
import { hrDepartmentController } from "../controllers/hrDepartment.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", hrDepartmentController.list);
router.post("/", hrDepartmentController.create);
router.patch("/:id", hrDepartmentController.update);
router.delete("/:id", hrDepartmentController.delete);

export default router;
