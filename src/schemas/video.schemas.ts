import { z } from "zod";

// VideoAsset ids are Prisma cuids. Checking the shape also keeps the id safe
// to use as a folder name.
export const videoIdSchema = z.string().cuid("Invalid video id");

export const initVideoUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().max(100).optional().default(""),
  sizeBytes: z.number().int().positive(),
});

export const videoChunkQuerySchema = z.object({
  offset: z.coerce.number().int().min(0),
});

// Attach / replace / remove the video on an existing task (Quick Task).
export const setSampleVideoSchema = z.object({
  sampleVideoId: videoIdSchema.nullable(),
});

export type InitVideoUploadInput = z.infer<typeof initVideoUploadSchema>;
