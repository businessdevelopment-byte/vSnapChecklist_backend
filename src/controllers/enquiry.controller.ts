import { Request, Response } from "express";
import { enquiryService } from "../services/enquiry.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import { enquiryQuerySchema, createEnquirySchema } from "../schemas/enquiry.schemas";

export const enquiryController = {
  async listOpenIndents(req: Request, res: Response): Promise<void> {
    try {
      const query = enquiryQuerySchema.parse(req.query);
      const result = await enquiryService.listOpenIndents(query);
      sendPaginated(res, result, "Open indents fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch open indents", e.status ?? 500);
    }
  },

  async listHistory(req: Request, res: Response): Promise<void> {
    try {
      const query = enquiryQuerySchema.parse(req.query);
      const result = await enquiryService.listHistory(query);
      sendPaginated(res, result, "Enquiries fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch enquiries", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = createEnquirySchema.parse(req.body);
      const enquiry = await enquiryService.create(input, req.user!.userId);
      sendSuccess(res, enquiry, "Enquiry created", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to create enquiry", e.status ?? 400);
    }
  },
};
