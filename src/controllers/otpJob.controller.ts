import { Request, Response } from "express";
import { otpJobService } from "../services/otpJob.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import {
  otpJobQuerySchema,
  createOtpJobSchema,
  externalJobDateRangeSchema,
} from "../schemas/otpJob.schemas";

export const otpJobController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const query = otpJobQuerySchema.parse(req.query);
      const result = await otpJobService.list(query);
      sendPaginated(res, result, "Orders fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch orders", e.status ?? 500);
    }
  },

  async listClients(_req: Request, res: Response): Promise<void> {
    try {
      const clients = await otpJobService.listDistinctClients();
      sendSuccess(res, clients, "Clients fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch clients", e.status ?? 500);
    }
  },

  async listPocs(_req: Request, res: Response): Promise<void> {
    try {
      const pocs = await otpJobService.listDistinctPocs();
      sendSuccess(res, pocs, "POCs fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch POCs", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = createOtpJobSchema.parse(req.body);
      const job = await otpJobService.create(input);
      sendSuccess(res, job, "Order created", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to create order", e.status ?? 400);
    }
  },

  async listExternal(req: Request, res: Response): Promise<void> {
    try {
      const { fromDate, toDate } = externalJobDateRangeSchema.parse(req.query);
      const jobs = await otpJobService.fetchExternalCreatedBetween(fromDate, toDate);
      sendSuccess(res, jobs, "External jobs fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch external jobs", e.status ?? 500);
    }
  },

  async importExternal(req: Request, res: Response): Promise<void> {
    try {
      const { fromDate, toDate } = externalJobDateRangeSchema.parse(req.body);
      const result = await otpJobService.importExternalCreatedBetween(fromDate, toDate);
      sendSuccess(res, result, "External jobs imported");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to import external jobs", e.status ?? 500);
    }
  },
};
