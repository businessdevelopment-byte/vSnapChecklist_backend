import { Router } from "express";
import { templateController } from "../controllers/template.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", templateController.getAll);
router.get("/:id", templateController.getById);
router.post("/", templateController.create);       // admin only (enforced in controller)
router.patch("/:id", templateController.update);   // admin only
router.delete("/:id", templateController.deactivate); // soft delete

export default router;
