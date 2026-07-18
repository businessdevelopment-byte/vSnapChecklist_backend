import { Router } from "express";
import { misRecordController } from "../controllers/misRecord.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", misRecordController.list);
router.post("/", misRecordController.create);
router.patch("/:id", misRecordController.update);
router.delete("/:id", misRecordController.remove);

export default router;
