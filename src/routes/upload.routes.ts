import { Router } from "express";
import { authMiddleware } from "../middleware/authMiddleware";
import { createUploadMiddleware } from "../middleware/uploadMiddleware";
import { uploadController } from "../controllers/upload.controller";

const router = Router();
const upload = createUploadMiddleware("checklist");

router.post("/", authMiddleware, upload.single("file"), uploadController.uploadFile);

export default router;
