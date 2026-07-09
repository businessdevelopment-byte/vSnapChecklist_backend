import { Router } from "express";
import { misTaskController } from "../controllers/misTask.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", misTaskController.list);
router.post("/", misTaskController.create);
router.patch("/:id", misTaskController.update);
router.delete("/:id", misTaskController.remove);

export default router;
