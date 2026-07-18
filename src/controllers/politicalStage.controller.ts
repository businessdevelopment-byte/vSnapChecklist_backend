import { Request, Response } from "express";
import { politicalStageService } from "../services/politicalStage.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import {
  politicalStageListQuerySchema,
  advanceStageBodySchema,
  POLITICAL_STAGE_ORDER,
  type PoliticalStageName,
} from "../schemas/politicalStage.schemas";

function parseStageParam(raw: string): PoliticalStageName {
  const stage = raw.toUpperCase() as PoliticalStageName;
  if (!POLITICAL_STAGE_ORDER.includes(stage)) {
    throw Object.assign(new Error(`Unknown Political stage: ${raw}`), { status: 400 });
  }
  return stage;
}

export const politicalStageController = {
  async listPending(req: Request, res: Response): Promise<void> {
    try {
      const stage = parseStageParam(String(req.params.stage));
      const query = politicalStageListQuerySchema.parse(req.query);
      const result = await politicalStageService.listPending(stage, query);
      sendPaginated(res, result, "Pending jobs fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch pending jobs", e.status ?? 500);
    }
  },

  async listHistory(req: Request, res: Response): Promise<void> {
    try {
      const stage = parseStageParam(String(req.params.stage));
      const query = politicalStageListQuerySchema.parse(req.query);
      const result = await politicalStageService.listHistory(stage, query);
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
      const job = await politicalStageService.advanceStage(jobId, data, req.user!.userId);
      sendSuccess(res, job, "Job advanced to next stage");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to advance job", e.status ?? 400);
    }
  },
};
