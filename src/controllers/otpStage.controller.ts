import { Request, Response } from "express";
import { otpStageService } from "../services/otpStage.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import { stageListQuerySchema, advanceStageSchema, OTP_STAGE_ORDER, type OtpStageName } from "../schemas/otpStage.schemas";

function parseStageParam(raw: string): OtpStageName {
  const stage = raw.toUpperCase() as OtpStageName;
  if (!OTP_STAGE_ORDER.includes(stage)) {
    throw Object.assign(new Error(`Unknown OTP stage: ${raw}`), { status: 400 });
  }
  return stage;
}

export const otpStageController = {
  async listPending(req: Request, res: Response): Promise<void> {
    try {
      const stage = parseStageParam(String(req.params.stage));
      const query = stageListQuerySchema.parse(req.query);
      const result = await otpStageService.listPending(stage, query);
      sendPaginated(res, result, "Pending orders fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch pending orders", e.status ?? 500);
    }
  },

  async listAssignedMembers(_req: Request, res: Response): Promise<void> {
    try {
      const members = await otpStageService.listDistinctAssignedMembers();
      sendSuccess(res, members, "Assigned members fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch assigned members", e.status ?? 500);
    }
  },

  async listHistory(req: Request, res: Response): Promise<void> {
    try {
      const stage = parseStageParam(String(req.params.stage));
      const query = stageListQuerySchema.parse(req.query);
      const result = await otpStageService.listHistory(stage, query);
      sendPaginated(res, result, "Stage history fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch stage history", e.status ?? 500);
    }
  },

  async advance(req: Request, res: Response): Promise<void> {
    try {
      const jobId = Number(req.params.id);
      const { data } = advanceStageSchema.parse(req.body);
      const job = await otpStageService.advanceStage(jobId, data, req.user!.userId);
      sendSuccess(res, job, "Order advanced to next stage");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to advance order", e.status ?? 400);
    }
  },
};
