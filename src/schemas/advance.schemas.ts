import { z } from "zod";

export const advanceDateRangeSchema = z.object({
  fromDate: z.string().date(),
  toDate: z.string().date(),
});

// Shape of one record from the external vsnapu Payment Benchmarks API
// (GET https://apis.vsnapu.com/api/public/payment-benchmarks) — validated at
// the boundary since it's a system we don't control. `category` carries
// several values ("Token", "Week Before", "D-Day", "On Delivery", ...); only
// "Token" rows represent an advance payment.
export const externalPaymentBenchmarkSchema = z.object({
  jobId: z.string().min(1),
  jobName: z.string(),
  amountReceived: z.coerce.number(),
  category: z.string().min(1),
  receivedOn: z.string().min(1),
});

export type AdvanceDateRangeInput = z.infer<typeof advanceDateRangeSchema>;
export type ExternalPaymentBenchmark = z.infer<typeof externalPaymentBenchmarkSchema>;
