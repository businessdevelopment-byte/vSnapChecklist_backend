import { Request, Response } from "express";
import { politicalProjectOrderService } from "../services/politicalProjectOrder.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import { createPoliticalProjectOrderSchema, politicalProjectOrderListQuerySchema } from "../schemas/politicalProjectOrder.schemas";

export const politicalProjectOrderController = {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = createPoliticalProjectOrderSchema.parse(req.body);
      const projectOrder = await politicalProjectOrderService.create(input, req.user!.userId);
      sendSuccess(res, projectOrder, "Project Order created", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to create Project Order", e.status ?? 400);
    }
  },

  async list(req: Request, res: Response): Promise<void> {
    try {
      const query = politicalProjectOrderListQuerySchema.parse(req.query);
      const result = await politicalProjectOrderService.list(query);
      sendPaginated(res, result, "Project Orders fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch Project Orders", e.status ?? 500);
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = Number(req.params.id);
      const projectOrder = await politicalProjectOrderService.getById(id);
      if (!projectOrder) {
        sendError(res, "Project Order not found", 404);
        return;
      }
      sendSuccess(res, projectOrder, "Project Order fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch Project Order", e.status ?? 500);
    }
  },
};
