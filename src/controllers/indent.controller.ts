import { Request, Response } from "express";
import { indentService } from "../services/indent.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import { indentQuerySchema, createIndentSchema } from "../schemas/indent.schemas";

export const indentController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const query = indentQuerySchema.parse(req.query);
      const result = await indentService.list(query);
      sendPaginated(res, result, "Indents fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch indents", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = createIndentSchema.parse(req.body);
      const indent = await indentService.create(input);
      sendSuccess(res, indent, "Indent created", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to create indent", e.status ?? 400);
    }
  },
};
