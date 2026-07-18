import { z } from "zod";

export const editingHoursPerJobDateRangeSchema = z.object({
  fromDate: z.string().date(),
  toDate: z.string().date(),
});

// Confirmed via a real call to the external feed.
export const externalEditingHoursPerJobSchema = z.object({
  jobId: z.string().min(1),
  jobName: z.string(),
  totalEditingHours: z.number(),
  latestEditingRecordOn: z.string().min(1),
});

export type ExternalEditingHoursPerJob = z.infer<typeof externalEditingHoursPerJobSchema>;
