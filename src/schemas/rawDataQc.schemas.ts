import { z } from "zod";

export const rawDataQcDateRangeSchema = z.object({
  fromDate: z.string().date(),
  toDate: z.string().date(),
});

// Confirmed via a real call to the external feed.
export const externalRawDataQcSchema = z.object({
  jobId: z.string().min(1),
  jobName: z.string(),
  photographerName: z.string(),
  average: z.number(),
  reviewDate: z.string().min(1),
});

export type ExternalRawDataQc = z.infer<typeof externalRawDataQcSchema>;
