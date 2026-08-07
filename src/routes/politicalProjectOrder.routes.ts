import { Router } from "express";
import { politicalProjectOrderController } from "../controllers/politicalProjectOrder.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", politicalProjectOrderController.list);
router.post("/", politicalProjectOrderController.create);
router.get("/:id", politicalProjectOrderController.getById);

export default router;
