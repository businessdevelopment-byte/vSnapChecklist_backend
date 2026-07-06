import { Router } from "express";
import { indentController } from "../controllers/indent.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", indentController.list);
router.post("/", indentController.create);

export default router;
