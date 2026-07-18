import { Router } from "express";
import { permissionController } from "../controllers/permission.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/user/:userId", permissionController.getUserPermissions);
router.post("/assign", permissionController.assignSectionPermissions);
router.post("/remove", permissionController.removeSectionPermissions);
router.post("/set", permissionController.setUserPermissions);
router.get("/all", permissionController.getAllUserPermissions);

export default router;
