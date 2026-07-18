import { z } from "zod";

export const editedDataQcDateRangeSchema = z.object({
  fromDate: z.string().date(),
  toDate: z.string().date(),
});

// Confirmed via a real call to the external feed.
export const externalEditedDataQcSchema = z.object({
  jobId: z.string().min(1),
  jobName: z.string(),
  editorName: z.string(),
  average: z.number(),
  reviewDate: z.string().min(1),
});

export type ExternalEditedDataQc = z.infer<typeof externalEditedDataQcSchema>;
