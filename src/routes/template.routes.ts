import { Router } from "express";
import { templateController } from "../controllers/template.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", templateController.getAll);
router.post("/import", templateController.importMany); // must be before /:id
router.post("/delete-preview", templateController.deletePreview); // admin
router.post("/bulk-delete", templateController.deleteMany);       // admin: permanent, keeps completed history
router.get("/:id", templateController.getById);
router.post("/", templateController.create);
router.patch("/:id", templateController.update);
router.delete("/:id", templateController.deleteOne);              // admin: permanent (deactivate = PATCH isActive)

export default router;
