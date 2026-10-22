import { z } from "zod";
import { checkDateRange } from "./checklist.schemas";

export const REPORT_MAX_DAYS = 366;
// A capped report would silently under-count, so over this the request is
// refused instead and the caller narrows the range or picks one user.
export const REPORT_MAX_ROWS = 50_000;

export const reportQuerySchema = z
  .object({
    startDate: z.string().date(),
    endDate: z.string().date(),
    userId: z.coerce.number().int().positive().optional(), // admin: filter by user
    departmentId: z.coerce.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => checkDateRange(data.startDate, data.endDate, ctx, REPORT_MAX_DAYS));

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;

export function tooManyRowsError(kind: string, count: number) {
  return Object.assign(
    new Error(
      `This report has ${count.toLocaleString("en-IN")} ${kind} rows — the limit is ${REPORT_MAX_ROWS.toLocaleString("en-IN")}. Narrow the date range or pick one user.`
    ),
    { status: 400 }
  );
}
