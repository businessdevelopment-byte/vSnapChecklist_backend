import { Request, Response } from "express";
import { pmsStageService } from "../services/pmsStage.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import { pmsStageListQuerySchema, advanceStageBodySchema, PMS_STAGE_ORDER, type PmsStageName } from "../schemas/pmsStage.schemas";

function parseStageParam(raw: string): PmsStageName {
  const stage = raw.toUpperCase() as PmsStageName;
  if (!PMS_STAGE_ORDER.includes(stage)) {
    throw Object.assign(new Error(`Unknown PMS stage: ${raw}`), { status: 400 });
  }
  return stage;
}

export const pmsStageController = {
  async listPending(req: Request, res: Response): Promise<void> {
    try {
      const stage = parseStageParam(String(req.params.stage));
      const query = pmsStageListQuerySchema.parse(req.query);
      const result = await pmsStageService.listPending(stage, query);
      sendPaginated(res, result, "Pending jobs fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch pending jobs", e.status ?? 500);
    }
  },

  async listHistory(req: Request, res: Response): Promise<void> {
    try {
      const stage = parseStageParam(String(req.params.stage));
      const query = pmsStageListQuerySchema.parse(req.query);
      const result = await pmsStageService.listHistory(stage, query);
      sendPaginated(res, result, "Stage history fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch stage history", e.status ?? 500);
    }
  },

  async advance(req: Request, res: Response): Promise<void> {
    try {
      const jobId = Number(req.params.id);
      const { data } = advanceStageBodySchema.parse(req.body);
      const job = await pmsStageService.advanceStage(jobId, data);
      sendSuccess(res, job, "Job advanced to next stage");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to advance job", e.status ?? 400);
    }
  },
};
