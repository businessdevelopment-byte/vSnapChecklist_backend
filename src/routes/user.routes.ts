import { Router } from "express";
import { userController } from "../controllers/user.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/me", userController.getMe);
router.patch("/me", userController.updateMe);
router.get("/", userController.getAll);
router.post("/", userController.create);
router.post("/import", userController.importMany);
router.patch("/:id/status", userController.updateStatus);
router.patch("/:id/role", userController.updateRole);
router.patch("/:id/department", userController.updateDepartment);

export default router;
