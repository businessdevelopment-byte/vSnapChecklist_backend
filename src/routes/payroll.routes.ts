import { Router } from "express";
import { payrollController } from "../controllers/payroll.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/me", payrollController.mySalary);
router.get("/", payrollController.list);
router.post("/", payrollController.create);

export default router;
