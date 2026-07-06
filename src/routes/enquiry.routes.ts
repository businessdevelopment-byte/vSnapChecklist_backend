import { Router } from "express";
import { enquiryController } from "../controllers/enquiry.controller";
import { authMiddleware } from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/open-indents", enquiryController.listOpenIndents);
router.get("/", enquiryController.listHistory);
router.post("/", enquiryController.create);

export default router;
