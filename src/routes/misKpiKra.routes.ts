import { Router } from "express";
import { misKpiKraController } from "../controllers/misKpiKra.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", misKpiKraController.list);
router.post("/", misKpiKraController.create);
router.patch("/:id", misKpiKraController.update);
router.delete("/:id", misKpiKraController.remove);

export default router;
