import { Request, Response } from "express";
import { ZodError } from "zod";
import { sendError, sendSuccess } from "../utils/apiResponse";
import { initVideoUploadSchema, videoChunkQuerySchema, videoIdSchema } from "../schemas/video.schemas";
import { videoUploadService } from "../services/video/videoUpload.service";

function fail(res: Response, err: unknown, fallback: string): void {
  if (err instanceof ZodError) {
    sendError(res, err.issues[0]?.message ?? "Invalid request", 400);
    return;
  }
  const e = err as { status?: number; message?: string; errors?: unknown };
  if (!e.status) console.error(`[video] ${fallback}:`, err);
  sendError(res, e.status ? e.message ?? fallback : fallback, e.status ?? 500, e.errors);
}

export const videoController = {
  // Starts an upload — the client then sends the file in chunks.
  async init(req: Request, res: Response): Promise<void> {
    try {
      const input = initVideoUploadSchema.parse(req.body);
      const result = await videoUploadService.init(input, req.user!);
      sendSuccess(res, { ...result, maxBytes: videoUploadService.maxBytes() }, "Upload started", 201);
    } catch (err) {
      fail(res, err, "Could not start the video upload");
    }
  },

  async uploadChunk(req: Request, res: Response): Promise<void> {
    try {
      const id = videoIdSchema.parse(req.params.id);
      const { offset } = videoChunkQuerySchema.parse(req.query);
      const result = await videoUploadService.appendChunk(id, offset, req.body as Buffer, req.user!);
      sendSuccess(res, result, "Chunk saved");
    } catch (err) {
      fail(res, err, "Could not save this part of the video");
    }
  },

  async complete(req: Request, res: Response): Promise<void> {
    try {
      const id = videoIdSchema.parse(req.params.id);
      const asset = await videoUploadService.complete(id, req.user!);
      sendSuccess(res, videoUploadService.toView(asset, req), "Video uploaded");
    } catch (err) {
      fail(res, err, "Could not finish the video upload");
    }
  },

  // Any signed-in user may look a video up: it is shown on tasks to their
  // assignees, and its files are served like every other upload.
  async get(req: Request, res: Response): Promise<void> {
    try {
      const id = videoIdSchema.parse(req.params.id);
      const asset = await videoUploadService.get(id);
      sendSuccess(res, videoUploadService.toView(asset, req), "Video fetched");
    } catch (err) {
      fail(res, err, "Could not load the video");
    }
  },

  async cancel(req: Request, res: Response): Promise<void> {
    try {
      const id = videoIdSchema.parse(req.params.id);
      await videoUploadService.cancel(id, req.user!);
      sendSuccess(res, null, "Video removed");
    } catch (err) {
      fail(res, err, "Could not remove the video");
    }
  },
};
