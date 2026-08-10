import { prisma } from "../config/database";
import { env } from "../config/env";
import { otpJobService } from "./otpJob.service";
import { otpStageService } from "./otpStage.service";
import { parseArrayLenient } from "../utils/externalApi";
import { externalOpsAllotmentSchema, type ExternalOpsAllotment } from "../schemas/opsAllotment.schemas";

// A job's member is routinely allotted weeks before the job reaches this
// stage, so matching against only the range the user happens to be viewing
// silently leaves it stuck at ASSIGN_MEMBER forever. 90 days matches the
// lookback already proven necessary for the Editor Allotments / Raw Data QC /
// Photographer Allotments feeds; 7 days was proven unsafe there for exactly
// this reason.
const MATCH_LOOKBACK_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;
const toDateOnly = (d: Date) => d.toISOString().slice(0, 10);

// The displayed range only drives the "All vsnapu Allotments" table. Matching
// always covers at least the last 90 days, widened further if the user is
// looking further back, so a wider range can only ever help.
function matchWindow(fromDate: string, toDate: string) {
  const now = Date.now();
  return {
    from: toDateOnly(new Date(Math.min(new Date(fromDate).getTime(), now - MATCH_LOOKBACK_DAYS * DAY_MS))),
    to: toDateOnly(new Date(Math.max(new Date(toDate).getTime(), now))),
  };
}

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

  async applyCreatedBetween(fromDate: string, toDate: string, actorUserId: number) {
    const window = matchWindow(fromDate, toDate);
    const allotments = await this.fetchCreatedBetween(window.from, window.to);

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

    // vsnapu naming a member is itself the trigger to advance — every job
    // still waiting at ASSIGN_MEMBER that this sync matched to an allotment
    // gets its member recorded and advances automatically. No manual
    // per-row action exists on the frontend for this anymore.
    const assignable = await prisma.otpJob.findMany({
      where: { jobId: { in: [...latestByJobId.keys()] }, currentStage: "ASSIGN_MEMBER" },
      select: { id: true, jobId: true },
    });

    for (const job of assignable) {
      const allotment = latestByJobId.get(job.jobId)!;
      // actorUserId here is whoever ran this sync, not the real vsnapu-side
      // stakeholder named in allotment.stakeholderName (a free-text field,
      // not a User FK) — a known limitation of this bulk-sync path, see
      // docs/migration plan for the MIS rebuild.
      await otpStageService.advanceStage(
        job.id,
        {
          assignedMember: allotment.stakeholderName.trim(),
          remarks: allotment.allottedByUserName?.trim()
            ? `Assigned by ${allotment.allottedByUserName.trim()} via vsnapu`
            : "Assigned via vsnapu",
        },
        actorUserId
      );
    }

    return {
      fetched: allotments.length,
      matched: assignable.length,
      backfilled,
      assigned: assignable.length,
    };
  },
};
