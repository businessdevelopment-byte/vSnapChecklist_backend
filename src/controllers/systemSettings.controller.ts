import type { Request, Response } from "express";
import { z } from "zod";
import { systemSettingsService } from "../services/systemSettings.service";
import { sendSuccess, sendError } from "../utils/apiResponse";

const updateSchema = z.object({
  skipSundays: z.boolean(),
});

export const systemSettingsController = {
  async get(req: Request, res: Response): Promise<void> {
    try {
      const settings = await systemSettingsService.get();
      sendSuccess(res, settings);
    } catch (err) {
      sendError(res, "Failed to fetch settings", 500);
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      if (req.user?.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const parsed = updateSchema.parse(req.body);
      const settings = await systemSettingsService.update(parsed);
      sendSuccess(res, settings, "Settings updated");
    } catch (err) {
      if (err instanceof z.ZodError) {
        sendError(res, "Invalid input", 400, err.errors);
        return;
      }
      sendError(res, "Failed to update settings", 500);
    }
  },
};
