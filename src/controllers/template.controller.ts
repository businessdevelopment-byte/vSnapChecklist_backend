import { Request, Response } from "express";
import { ZodError } from "zod";
import { templateService } from "../services/template.service";
import { sendSuccess, sendPaginated, sendError, formatZodRowErrors } from "../utils/apiResponse";
import {
  createTemplateSchema,
  updateTemplateSchema,
  templateQuerySchema,
  importTemplatesSchema,
} from "../schemas/template.schemas";

export const templateController = {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const query = templateQuerySchema.parse(req.query);
      const result = await templateService.getAll(query);
      sendPaginated(res, result, "Templates fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch templates", e.status ?? 500);
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const template = await templateService.getById(Number(req.params.id));
      sendSuccess(res, template, "Template fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Template not found", e.status ?? 404);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = createTemplateSchema.parse(req.body);
      const template = await templateService.create(input);
      sendSuccess(res, template, "Template created", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to create template", e.status ?? 400);
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      const input = updateTemplateSchema.parse(req.body);
      const template = await templateService.update(Number(req.params.id), input);
      sendSuccess(res, template, "Template updated");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to update template", e.status ?? 400);
    }
  },

  async deactivate(req: Request, res: Response): Promise<void> {
    try {
      await templateService.deactivate(Number(req.params.id));
      sendSuccess(res, null, "Template deactivated");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to deactivate template", e.status ?? 400);
    }
  },

  async importMany(req: Request, res: Response): Promise<void> {
    try {
      const input = importTemplatesSchema.parse(req.body);
      const result = await templateService.importMany(input);
      sendSuccess(res, result, "Template import complete");
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        sendError(res, "Some rows failed validation", 400, formatZodRowErrors(err));
        return;
      }
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Import failed", e.status ?? 400);
    }
  },
};
