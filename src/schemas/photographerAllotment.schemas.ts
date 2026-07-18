import { z } from "zod";

export const photographerAllotmentDateRangeSchema = z.object({
  fromDate: z.string().date(),
  toDate: z.string().date(),
});

// Shape of one record from the external vsnapu Photographer Allotments API
// (GET https://apis.vsnapu.com/api/public/photographer-allotments) —
// validated at the boundary since it's a system we don't control.
export const externalPhotographerAllotmentSchema = z.object({
  jobId: z.string().min(1),
  photographerId: z.string(),
  photographerName: z.string(),
  mobile: z.string(),
  allottedOn: z.string().min(1),
  allottedByUserId: z.string().nullish(),
  allottedByUserName: z.string().nullish(),
});

export type PhotographerAllotmentDateRangeInput = z.infer<typeof photographerAllotmentDateRangeSchema>;
export type ExternalPhotographerAllotment = z.infer<typeof externalPhotographerAllotmentSchema>;
