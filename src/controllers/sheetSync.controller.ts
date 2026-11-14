import { Request, Response } from "express";
import { sheetSyncService } from "../services/sheetSync/sheetSync.service";
import { sendSuccess, sendError } from "../utils/apiResponse";

// Settings → Google Sheet Sync. Admin only.
export const sheetSyncController = {
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") { sendError(res, "Admin only", 403); return; }
      const status = await sheetSyncService.getStatus();
      sendSuccess(res, status, "Sheet sync status fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch sheet sync status", e.status ?? 500);
    }
  },

  // "Sync now": answers as soon as the run has started (202); the page then
  // follows it through GET /status.
  async run(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") { sendError(res, "Admin only", 403); return; }
      const runId = await sheetSyncService.startRun("MANUAL", req.user!.userId);
      sendSuccess(res, { runId }, "Sync started", 202);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to start the sync", e.status ?? 500);
    }
  },
};
