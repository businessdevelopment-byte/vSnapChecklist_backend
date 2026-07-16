import { Router } from "express";
import { designationController } from "../controllers/designation.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", designationController.list);
router.post("/", designationController.create);
router.patch("/:id", designationController.update);
router.delete("/:id", designationController.delete);

export default router;
