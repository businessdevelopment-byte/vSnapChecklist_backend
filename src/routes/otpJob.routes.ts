import { Router } from "express";
import { otpJobController } from "../controllers/otpJob.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/", otpJobController.list);
router.post("/", otpJobController.create);
router.get("/clients", otpJobController.listClients);
router.get("/external", otpJobController.listExternal);
router.post("/import-external", otpJobController.importExternal);

export default router;
