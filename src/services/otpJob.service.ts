import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { env } from "../config/env";
import { getPaginationParams, buildPaginationMeta } from "../utils/pagination";
import { parseArrayLenient } from "../utils/externalApi";
import {
  externalOtpJobSchema,
  type OtpJobQueryInput,
  type CreateOtpJobInput,
  type ExternalOtpJob,
} from "../schemas/otpJob.schemas";

const GST_RATE = 0.18;

// vsnapu has no single-job lookup endpoint (only date-range scans), so
// backfilling arbitrary jobIds has to scan from a floor date. Real data
// observed going back to at least 2025-01-31; this system has no earlier
// history, so this is a safe, generous floor rather than an arbitrary one.
const HISTORICAL_FLOOR_DATE = "2000-01-01";

// Blank-ish placeholders the external system sends instead of omitting the
// field (e.g. `"jobShootAddress": " "`, `"pocEmail": ""`) — normalize to null.
function nullIfBlank(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function mapExternalJob(job: ExternalOtpJob): Prisma.OtpJobCreateManyInput {
  return {
    jobId: job.jobId,
    projectId: job.projectId,
    client: job.clientName,
    jobGenre: job.jobGenre,
    customIdName: nullIfBlank(job.customIdName),
    customId: nullIfBlank(job.customId),
    salesExecutive: job.salesExecutive,
    jobDate: new Date(job.jobDate),
    deliveryDate: job.deliveryDate ? new Date(job.deliveryDate) : null,
    jobTime: job.jobTime,
    pocName: job.pocName,
    pocContact: job.pocContact,
    pocWhatsapp: nullIfBlank(job.pocWhatsApp),
    pocEmail: nullIfBlank(job.pocEmail),
    poc2ndEmail: nullIfBlank(job.poc2ndEmail),
    jobCity: job.jobCity,
    jobShootAddress: nullIfBlank(job.jobShootAddress) ?? "",
    jobSpecification: nullIfBlank(job.jobSpecifications),
    deliverables: nullIfBlank(job.deliverables),
    packageAmount: job.packageAmount,
    operationsCost: job.operationsCostNonTaxableAmount,
    taxableAmount: job.taxableAmount,
    gst: job.gst,
    packageAmountWithTax: job.packageAmountWithTax,
    isTokenReceived: job.isTokenReceived.trim().toLowerCase() === "yes",
    // Order Received is a flat log, not a pending queue (see create() below) —
    // imported jobs start their pipeline at the first actionable stage.
    currentStage: "ASSIGN_MEMBER",
  };
}

export const otpJobService = {
  async list(query: OtpJobQueryInput) {
    const { skip, take, page, limit } = getPaginationParams(query);

    const where: Prisma.OtpJobWhereInput = {};

    if (query.jobGenre) where.jobGenre = query.jobGenre;
    if (query.salesExecutive) where.salesExecutive = query.salesExecutive;
    if (query.jobCity) where.jobCity = query.jobCity;

    if (query.startDate || query.endDate) {
      where.jobDate = {
        ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
        ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
      };
    }

    if (query.search) {
      where.OR = [
        { jobId: { contains: query.search, mode: "insensitive" } },
        { projectId: { contains: query.search, mode: "insensitive" } },
        { client: { contains: query.search, mode: "insensitive" } },
        { pocName: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.otpJob.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.otpJob.count({ where }),
    ]);

    return { data, pagination: buildPaginationMeta(total, page, limit) };
  },

  async create(input: CreateOtpJobInput) {
    const taxableAmount = input.taxableAmount;
    const gst = Math.round(taxableAmount * GST_RATE * 100) / 100;
    const packageAmountWithTax = Math.round(taxableAmount * (1 + GST_RATE) * 100) / 100;

    const sequence = (await prisma.otpJob.count()) + 1;
    const jobId = `ORD${String(sequence).padStart(5, "0")}`;
    const projectId = `PRJ${String(sequence).padStart(5, "0")}`;

    return prisma.otpJob.create({
      data: {
        ...input,
        jobId,
        projectId,
        jobDate: new Date(input.jobDate),
        deliveryDate: new Date(input.deliveryDate),
        gst,
        packageAmountWithTax,
        // Order Received has no form/dialog in the source (a flat log, not a
        // pending queue — see otpJob.service.ts's `list()`, unfiltered by
        // stage). The first *actionable* stage is Assign Member, so new jobs
        // start their pipeline there, not at the ORDER_RECEIVED enum default.
        currentStage: "ASSIGN_MEMBER",
      },
    });
  },

  async fetchExternalCreatedBetween(fromDate: string, toDate: string): Promise<ExternalOtpJob[]> {
    const url = new URL("/api/JobMaster/GetJobsCreatedBetween", env.VSNAPU_JOB_MASTER_BASE_URL);
    url.searchParams.set("fromDate", fromDate);
    url.searchParams.set("toDate", toDate);
    url.searchParams.set("fromTime", "00:00");
    url.searchParams.set("toTime", "23:59");

    const response = await fetch(url);
    if (!response.ok) {
      throw Object.assign(
        new Error(`vsnapu Job Master API returned ${response.status}`),
        { status: 502 }
      );
    }

    const raw: unknown = await response.json();
    return parseArrayLenient(externalOtpJobSchema, raw, "Job Master feed");
  },

  async importExternalCreatedBetween(fromDate: string, toDate: string) {
    const jobs = await this.fetchExternalCreatedBetween(fromDate, toDate);
    const { count } = await prisma.otpJob.createMany({
      data: jobs.map(mapExternalJob),
      skipDuplicates: true,
    });

    return { fetched: jobs.length, imported: count, skipped: jobs.length - count };
  },

  // Backfill for jobIds referenced by an allotment but never imported —
  // a job's creation date and its allotment date are unrelated and can
  // differ by months, so the Ops Allotments sync can't rely on Order
  // Received having already covered the right range. No single-job lookup
  // exists upstream, so this re-scans from a wide floor and filters down.
  async importJobsById(jobIds: string[], upToDate: string) {
    if (jobIds.length === 0) return { imported: 0 };

    const wanted = new Set(jobIds);
    const jobs = (await this.fetchExternalCreatedBetween(HISTORICAL_FLOOR_DATE, upToDate)).filter((job) =>
      wanted.has(job.jobId)
    );

    const { count } = await prisma.otpJob.createMany({
      data: jobs.map(mapExternalJob),
      skipDuplicates: true,
    });

    return { imported: count };
  },
};
