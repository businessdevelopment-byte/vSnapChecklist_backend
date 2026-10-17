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
router.patch("/:id/employee", userController.updateEmployeeLink);
router.patch("/:id/departments", userController.updateDepartments);
router.post("/delete-all", userController.deleteAllNonAdmins); // admin + password: deletes every USER-role account, keeps admins
router.get("/:id/delete-preview", userController.deletePreview); // admin: counts shown in the delete warning
router.delete("/:id", userController.deleteUser); // admin: permanently deletes the user + all their tasks/history

export default router;
