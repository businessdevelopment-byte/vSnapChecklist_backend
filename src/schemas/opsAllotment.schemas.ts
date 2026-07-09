import { z } from "zod";

export const opsAllotmentDateRangeSchema = z.object({
  fromDate: z.string().date(),
  toDate: z.string().date(),
});

// Shape of one record from the external vsnapu Ops Allotments API
// (GET https://apis.vsnapu.com/api/public/ops-allotments) — validated at the
// boundary since it's a system we don't control.
export const externalOpsAllotmentSchema = z.object({
  jobId: z.string().min(1),
  // Not min(1) — same risk class as the Job Master feed's blank-field
  // records; skipped by parseArrayLenient if genuinely malformed instead.
  stakeholderId: z.string(),
  stakeholderName: z.string(),
  allottedOn: z.string().min(1),
  allottedByUserId: z.string().nullish(),
  allottedByUserName: z.string().nullish(),
});

export type OpsAllotmentDateRangeInput = z.infer<typeof opsAllotmentDateRangeSchema>;
export type ExternalOpsAllotment = z.infer<typeof externalOpsAllotmentSchema>;
