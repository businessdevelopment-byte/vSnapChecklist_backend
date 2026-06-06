import { Router } from "express";
import authRoutes from "./auth.routes";
import checklistRoutes from "./checklist.routes";
import templateRoutes from "./template.routes";
import delegationRoutes from "./delegation.routes";
import transferRoutes from "./transfer.routes";
import userRoutes from "./user.routes";
import departmentRoutes from "./department.routes";
import holidayRoutes from "./holiday.routes";
import systemSettingsRoutes from "./systemSettings.routes";
import uploadRoutes from "./upload.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/checklist", checklistRoutes);
router.use("/templates", templateRoutes);
router.use("/delegation", delegationRoutes);
router.use("/transfer", transferRoutes);
router.use("/users", userRoutes);
router.use("/departments", departmentRoutes);
router.use("/holidays", holidayRoutes);
router.use("/system-settings", systemSettingsRoutes);
router.use("/upload", uploadRoutes);

export default router;
