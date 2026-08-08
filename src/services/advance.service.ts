import { prisma } from "../config/database";
import { env } from "../config/env";
import { otpJobService, mapExternalJob } from "./otpJob.service";
import { parseArrayLenient } from "../utils/externalApi";
import { externalPaymentBenchmarkSchema, type ExternalPaymentBenchmark } from "../schemas/advance.schemas";

// The same "order fields" shown on every other OTP stage table (Order
// Received, Assign Member, ...) — attached per entry so the Advance page's
// tables can show the same Columns picker/field set instead of just the
// payment-feed's own 4 fields. Deliberately excludes id/currentStage/
// createdAt/updatedAt, which no existing column renderer reads, so both a
// real local OtpJob row and a resolved-but-unpersisted backfill hit fit here.
interface AdvanceJobDetails {
  jobId: string;
  projectId: string;
  client: string;
  jobGenre: string;
  customIdName: string | null;
  customId: string | null;
  salesExecutive: string;
  jobDate: Date;
  deliveryDate: Date | null;
  jobTime: string;
  pocName: string;
  pocContact: string;
  pocWhatsapp: string | null;
  pocEmail: string | null;
  poc2ndEmail: string | null;
  jobCity: string;
  jobShootAddress: string;
  jobSpecification: string | null;
  deliverables: string | null;
  packageAmount: unknown;
  operationsCost: unknown;
  taxableAmount: unknown;
  gst: unknown;
  packageAmountWithTax: unknown;
  isTokenReceived: boolean;
}

// vsnapu has no single-job lookup endpoint (see otpJob.service.ts), so
// resolving a jobId that isn't in our local otp_jobs table means re-scanning
// the Job Master feed from this same floor date.
const HISTORICAL_FLOOR_DATE = "2000-01-01";

// A job's advance/token payment is taken at booking time, unrelated to the
// job's own jobDate — it can be received weeks before or after. Checking
// only the user's displayed [fromDate,toDate] window for "has this jobId
// ever been paid" is the same narrow-lookback bug class already found and
// fixed for Photographer Allotment / Editor Allotments / Raw Data QC (see
// docs/migration/.claude/context/KNOWN_ISSUES_AND_DEVIATIONS.md #31) — reuse
// that fix's shape here rather than a full HISTORICAL_FLOOR_DATE scan, since
// 90 days safely covers the booking-to-shoot lead time already proven
// sufficient there.
const RECEIVED_LOOKBACK_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const toDateOnly = (d: Date) => d.toISOString().slice(0, 10);

function receivedMatchWindow(fromDate: string, toDate: string) {
  const now = Date.now();
  return {
    from: toDateOnly(new Date(Math.min(new Date(fromDate).getTime(), now - RECEIVED_LOOKBACK_DAYS * DAY_MS))),
    to: toDateOnly(new Date(Math.max(new Date(toDate).getTime(), now))),
  };
}

// The full Job Master history feed is tens of MB and grows every day. Every
// Token entry whose jobId isn't in our local otp_jobs table yet (routine for
// a live feed — see the comment below) triggered a full re-download +
// re-validation of that entire feed, on every single request. That easily
// blew past the frontend's request timeout and made the page appear to never
// load. Cache the scan per toDate for a few minutes so repeated Advance
// views/refetches in that window reuse it instead of re-fetching from scratch.
const BACKFILL_CACHE_TTL_MS = 5 * 60 * 1000;
let backfillCache: {
  toDate: string;
  expiresAt: number;
  jobs: Awaited<ReturnType<typeof otpJobService.fetchExternalCreatedBetween>>;
} | null = null;

async function fetchHistoricalJobsCached(toDate: string) {
  const now = Date.now();
  if (backfillCache && backfillCache.toDate === toDate && backfillCache.expiresAt > now) {
    return backfillCache.jobs;
  }
  const jobs = await otpJobService.fetchExternalCreatedBetween(HISTORICAL_FLOOR_DATE, toDate);
  backfillCache = { toDate, expiresAt: now + BACKFILL_CACHE_TTL_MS, jobs };
  return jobs;
}

interface AdvanceTokenEntry {
  jobId: string;
  jobName: string;
  amountReceived: number;
  receivedOn: string;
  // The full order-field set for this jobId (see AdvanceJobDetails) so the
  // frontend can render the same column set as the other OTP stage tables.
  // Null only when the jobId couldn't be resolved anywhere (truly unmatched).
  job: AdvanceJobDetails | null;
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
    const window = receivedMatchWindow(fromDate, toDate);

    const [benchmarks, widenedBenchmarks, localJobsInRange] = await Promise.all([
      this.fetchPaymentBenchmarks(fromDate, toDate),
      this.fetchPaymentBenchmarks(window.from, window.to),
      prisma.otpJob.findMany({
        where: { jobDate: { gte: new Date(fromDate), lte: new Date(toDate) } },
        orderBy: { jobDate: "asc" },
      }),
    ]);

    const tokenEntries = benchmarks.filter((b) => b.category.trim().toLowerCase() === "token");
    const receivedJobIds = new Set(
      widenedBenchmarks.filter((b) => b.category.trim().toLowerCase() === "token").map((b) => b.jobId)
    );

    const jobIds = [...new Set(tokenEntries.map((e) => e.jobId))];
    const jobDetailsByJobId = new Map<string, AdvanceJobDetails>();

    if (jobIds.length > 0) {
      const localJobs = await prisma.otpJob.findMany({
        where: { jobId: { in: jobIds } },
        select: {
          jobId: true,
          projectId: true,
          client: true,
          jobGenre: true,
          customIdName: true,
          customId: true,
          salesExecutive: true,
          jobDate: true,
          deliveryDate: true,
          jobTime: true,
          pocName: true,
          pocContact: true,
          pocWhatsapp: true,
          pocEmail: true,
          poc2ndEmail: true,
          jobCity: true,
          jobShootAddress: true,
          jobSpecification: true,
          deliverables: true,
          packageAmount: true,
          operationsCost: true,
          taxableAmount: true,
          gst: true,
          packageAmountWithTax: true,
          isTokenReceived: true,
        },
      });
      for (const job of localJobs) {
        jobDetailsByJobId.set(job.jobId, job);
      }
    }

    // A job's creation date and its advance-received date are unrelated and
    // can differ by months — a Token jobId might not be in our local DB yet
    // just because Order Received was never run for the range it was
    // created in. This is a read-only report, so resolve the missing
    // projectIds live against the Job Master feed without persisting
    // anything locally (unlike Ops Allotment's sync, which does import).
    const missingIds = jobIds.filter((id) => !jobDetailsByJobId.has(id));
    if (missingIds.length > 0) {
      const wanted = new Set(missingIds);
      const backfillJobs = (await fetchHistoricalJobsCached(toDate)).filter((job) => wanted.has(job.jobId));
      for (const job of backfillJobs) {
        const mapped = mapExternalJob(job);
        jobDetailsByJobId.set(job.jobId, {
          jobId: mapped.jobId,
          projectId: mapped.projectId,
          client: mapped.client,
          jobGenre: mapped.jobGenre,
          customIdName: mapped.customIdName ?? null,
          customId: mapped.customId ?? null,
          salesExecutive: mapped.salesExecutive,
          jobDate: new Date(mapped.jobDate as string | Date),
          deliveryDate: mapped.deliveryDate ? new Date(mapped.deliveryDate as string | Date) : null,
          jobTime: mapped.jobTime,
          pocName: mapped.pocName,
          pocContact: mapped.pocContact,
          pocWhatsapp: mapped.pocWhatsapp ?? null,
          pocEmail: mapped.pocEmail ?? null,
          poc2ndEmail: mapped.poc2ndEmail ?? null,
          jobCity: mapped.jobCity,
          jobShootAddress: mapped.jobShootAddress as string,
          jobSpecification: mapped.jobSpecification ?? null,
          deliverables: mapped.deliverables ?? null,
          packageAmount: mapped.packageAmount,
          operationsCost: mapped.operationsCost,
          taxableAmount: mapped.taxableAmount,
          gst: mapped.gst,
          packageAmountWithTax: mapped.packageAmountWithTax,
          isTokenReceived: mapped.isTokenReceived as boolean,
        });
      }
    }

    const groupsByProjectId = new Map<string, AdvanceProjectGroup>();
    const unmatched: AdvanceTokenEntry[] = [];

    for (const entry of tokenEntries) {
      const job = jobDetailsByJobId.get(entry.jobId) ?? null;
      const row: AdvanceTokenEntry = {
        jobId: entry.jobId,
        jobName: entry.jobName,
        amountReceived: entry.amountReceived,
        receivedOn: entry.receivedOn,
        job,
      };

      if (!job) {
        unmatched.push(row);
        continue;
      }

      let group = groupsByProjectId.get(job.projectId);
      if (!group) {
        group = { projectId: job.projectId, jobCount: 0, totalAdvanceAmount: 0, entries: [] };
        groupsByProjectId.set(job.projectId, group);
      }
      group.entries.push(row);
      group.totalAdvanceAmount += entry.amountReceived;
    }

    const projects = [...groupsByProjectId.values()]
      .map((group) => ({ ...group, jobCount: new Set(group.entries.map((e) => e.jobId)).size }))
      .sort((a, b) => a.projectId.localeCompare(b.projectId));

    // Every local job scheduled in this window that never shows up as having
    // received an advance in the widened match window above — "how much job
    // order is left from the advance". Deliberately not filtered by
    // isTokenReceived (schema.prisma's OtpJob.isTokenReceived): that's a
    // one-time snapshot of vsnapu's own field captured only at import/create
    // time, never updated afterward, and not what the rest of this service
    // trusts for matching.
    const pendingAdvance = localJobsInRange.filter((job) => !receivedJobIds.has(job.jobId));

    return { projects, unmatched, pendingAdvance };
  },
};
