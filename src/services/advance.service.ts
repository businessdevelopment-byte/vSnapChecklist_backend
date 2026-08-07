import { prisma } from "../config/database";
import { env } from "../config/env";
import { otpJobService } from "./otpJob.service";
import { parseArrayLenient } from "../utils/externalApi";
import { externalPaymentBenchmarkSchema, type ExternalPaymentBenchmark } from "../schemas/advance.schemas";

// vsnapu has no single-job lookup endpoint (see otpJob.service.ts), so
// resolving a jobId that isn't in our local otp_jobs table means re-scanning
// the Job Master feed from this same floor date.
const HISTORICAL_FLOOR_DATE = "2000-01-01";

interface AdvanceTokenEntry {
  jobId: string;
  jobName: string;
  amountReceived: number;
  receivedOn: string;
}

interface AdvanceProjectGroup {
  projectId: string;
  jobCount: number;
  totalAdvanceAmount: number;
  entries: AdvanceTokenEntry[];
}

export const advanceService = {
  async fetchPaymentBenchmarks(fromDate: string, toDate: string): Promise<ExternalPaymentBenchmark[]> {
    const url = new URL("/api/public/payment-benchmarks", env.VSNAPU_JOB_MASTER_BASE_URL);
    url.searchParams.set("fromDate", fromDate);
    url.searchParams.set("toDate", toDate);
    url.searchParams.set("fromTime", "00:00");
    url.searchParams.set("toTime", "23:59");

    const response = await fetch(url);
    if (!response.ok) {
      throw Object.assign(
        new Error(`vsnapu Payment Benchmarks API returned ${response.status}`),
        { status: 502 }
      );
    }

    const raw: unknown = await response.json();
    return parseArrayLenient(externalPaymentBenchmarkSchema, raw, "Payment Benchmarks feed");
  },

  async getSummary(fromDate: string, toDate: string) {
    const benchmarks = await this.fetchPaymentBenchmarks(fromDate, toDate);
    const tokenEntries = benchmarks.filter((b) => b.category.trim().toLowerCase() === "token");

    const jobIds = [...new Set(tokenEntries.map((e) => e.jobId))];
    const projectIdByJobId = new Map<string, string>();

    if (jobIds.length > 0) {
      const localJobs = await prisma.otpJob.findMany({
        where: { jobId: { in: jobIds } },
        select: { jobId: true, projectId: true },
      });
      for (const job of localJobs) {
        projectIdByJobId.set(job.jobId, job.projectId);
      }
    }

    // A job's creation date and its advance-received date are unrelated and
    // can differ by months — a Token jobId might not be in our local DB yet
    // just because Order Received was never run for the range it was
    // created in. This is a read-only report, so resolve the missing
    // projectIds live against the Job Master feed without persisting
    // anything locally (unlike Ops Allotment's sync, which does import).
    const missingIds = jobIds.filter((id) => !projectIdByJobId.has(id));
    if (missingIds.length > 0) {
      const wanted = new Set(missingIds);
      const backfillJobs = (await otpJobService.fetchExternalCreatedBetween(HISTORICAL_FLOOR_DATE, toDate)).filter(
        (job) => wanted.has(job.jobId)
      );
      for (const job of backfillJobs) {
        projectIdByJobId.set(job.jobId, job.projectId);
      }
    }

    const groupsByProjectId = new Map<string, AdvanceProjectGroup>();
    const unmatched: AdvanceTokenEntry[] = [];

    for (const entry of tokenEntries) {
      const projectId = projectIdByJobId.get(entry.jobId);
      const row: AdvanceTokenEntry = {
        jobId: entry.jobId,
        jobName: entry.jobName,
        amountReceived: entry.amountReceived,
        receivedOn: entry.receivedOn,
      };

      if (!projectId) {
        unmatched.push(row);
        continue;
      }

      let group = groupsByProjectId.get(projectId);
      if (!group) {
        group = { projectId, jobCount: 0, totalAdvanceAmount: 0, entries: [] };
        groupsByProjectId.set(projectId, group);
      }
      group.entries.push(row);
      group.totalAdvanceAmount += entry.amountReceived;
    }

    const projects = [...groupsByProjectId.values()]
      .map((group) => ({ ...group, jobCount: new Set(group.entries.map((e) => e.jobId)).size }))
      .sort((a, b) => a.projectId.localeCompare(b.projectId));

    return { projects, unmatched };
  },
};
