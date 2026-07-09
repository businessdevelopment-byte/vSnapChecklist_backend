import { prisma } from "../config/database";
import { env } from "../config/env";
import { otpJobService } from "./otpJob.service";
import { parseArrayLenient } from "../utils/externalApi";
import { externalOpsAllotmentSchema, type ExternalOpsAllotment } from "../schemas/opsAllotment.schemas";

export const opsAllotmentService = {
  async fetchCreatedBetween(fromDate: string, toDate: string): Promise<ExternalOpsAllotment[]> {
    const url = new URL("/api/public/ops-allotments", env.VSNAPU_JOB_MASTER_BASE_URL);
    url.searchParams.set("fromDate", fromDate);
    url.searchParams.set("toDate", toDate);
    url.searchParams.set("fromTime", "00:00");
    url.searchParams.set("toTime", "23:59");

    const response = await fetch(url);
    if (!response.ok) {
      throw Object.assign(
        new Error(`vsnapu Ops Allotments API returned ${response.status}`),
        { status: 502 }
      );
    }

    const raw: unknown = await response.json();
    return parseArrayLenient(externalOpsAllotmentSchema, raw, "Ops Allotments feed");
  },

  async applyCreatedBetween(fromDate: string, toDate: string) {
    const allotments = await this.fetchCreatedBetween(fromDate, toDate);

    // A job can appear more than once (re-assignment) — keep only the latest
    // allotment per jobId before applying.
    const latestByJobId = new Map<string, ExternalOpsAllotment>();
    for (const allotment of allotments) {
      const existing = latestByJobId.get(allotment.jobId);
      if (!existing || new Date(allotment.allottedOn) >= new Date(existing.allottedOn)) {
        latestByJobId.set(allotment.jobId, allotment);
      }
    }

    // A job's creation date and its allotment date are unrelated and can
    // differ by months — an allotted jobId might not be in our local DB yet
    // just because Order Received was never run for the range it was
    // created in. Backfill any gaps before matching, so this sync doesn't
    // silently depend on Order Received's import history.
    const existingJobs = await prisma.otpJob.findMany({
      where: { jobId: { in: [...latestByJobId.keys()] } },
      select: { jobId: true },
    });
    const existingIds = new Set(existingJobs.map((j) => j.jobId));
    const missingIds = [...latestByJobId.keys()].filter((id) => !existingIds.has(id));

    let backfilled = 0;
    if (missingIds.length > 0) {
      const result = await otpJobService.importJobsById(missingIds, toDate);
      backfilled = result.imported;
    }

    // Matching + advancing to the next stage is a manual, per-row action from
    // here on (the "Process" button on Assign Member's Assigned tab) — this
    // sync only guarantees every allotted job actually exists locally so the
    // frontend's jobId join has something to match against. It never calls
    // advanceStage itself.
    const matched = await prisma.otpJob.count({
      where: { jobId: { in: [...latestByJobId.keys()] }, currentStage: "ASSIGN_MEMBER" },
    });

    return {
      fetched: allotments.length,
      matched,
      backfilled,
    };
  },
};
