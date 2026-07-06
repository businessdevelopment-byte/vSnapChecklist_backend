import { Router } from "express";
import { employeeController } from "../controllers/employee.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/me", employeeController.getMyProfile);
router.patch("/me", employeeController.updateMyProfile);
router.get("/", employeeController.list);
router.post("/", employeeController.create);

export default router;
