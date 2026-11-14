import { Router } from "express";
import { sheetSyncController } from "../controllers/sheetSync.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/status", sheetSyncController.getStatus); // admin
router.post("/run", sheetSyncController.run);         // admin

export default router;
