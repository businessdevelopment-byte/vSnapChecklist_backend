import { z } from "zod";

export const editorAllotmentDateRangeSchema = z.object({
  fromDate: z.string().date(),
  toDate: z.string().date(),
});

// Confirmed via a real call to the external feed — same shape as
// photographerAllotment.schemas.ts's externalPhotographerAllotmentSchema,
// minus `mobile` (this feed doesn't return one).
export const externalEditorAllotmentSchema = z.object({
  jobId: z.string().min(1),
  editorId: z.string(),
  editorName: z.string(),
  allottedOn: z.string().min(1),
  allottedByUserId: z.string().nullish(),
  allottedByUserName: z.string().nullish(),
});

export type ExternalEditorAllotment = z.infer<typeof externalEditorAllotmentSchema>;
