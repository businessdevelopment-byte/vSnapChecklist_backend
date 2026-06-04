import { Router } from "express";
import { departmentController } from "../controllers/department.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", departmentController.getAll);
router.post("/", departmentController.create);
router.patch("/:id", departmentController.update);
router.delete("/:id", departmentController.remove);

export default router;
