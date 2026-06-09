import { Router } from "express";
import { templateController } from "../controllers/template.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", templateController.getAll);
router.post("/import", templateController.importMany); // must be before /:id
router.get("/:id", templateController.getById);
router.post("/", templateController.create);
router.patch("/:id", templateController.update);
router.delete("/:id", templateController.deactivate);

export default router;
