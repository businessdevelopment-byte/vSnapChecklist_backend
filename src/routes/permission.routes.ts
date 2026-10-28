import { Router } from "express";
import { permissionController } from "../controllers/permission.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/user/:userId", permissionController.getUserPermissions);   // effective access; staff: own only
router.post("/assign", permissionController.assignSectionPermissions);
router.post("/remove", permissionController.removeSectionPermissions);
router.post("/set", permissionController.setUserPermissions);
router.get("/all", permissionController.getAllUserPermissions);
router.get("/departments", permissionController.getDepartmentPermissions);       // admin
router.post("/departments/set", permissionController.setDepartmentPermissions);  // admin
router.get("/defaults", permissionController.getDefaultPermissions);             // admin
router.post("/defaults/set", permissionController.setDefaultPermissions);        // admin

export default router;
