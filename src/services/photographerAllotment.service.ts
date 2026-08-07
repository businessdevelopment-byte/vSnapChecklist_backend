import { Prisma } from "@prisma/client";
import { prisma } from "../config/database";
import { env } from "../config/env";
import { parseArrayLenient } from "../utils/externalApi";
import { otpStageService } from "./otpStage.service";
import {
  externalPhotographerAllotmentSchema,
  type ExternalPhotographerAllotment,
} from "../schemas/photographerAllotment.schemas";

// A job's photographer is routinely allotted weeks before the job reaches
// this stage, so matching against only the range the user happens to be
// viewing silently records "no photographer" and pushes the job on to
// Photographer Search — irreversibly. 90 days matches the lookback already
// proven necessary for the Editor Allotments / Raw Data QC feeds; 7 days was
// proven unsafe there for exactly this reason.
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

function hasPhotographer(data: unknown): boolean {
  const name = (data as Record<string, unknown> | null)?.photographerName;
  return typeof name === "string" && name.trim().length > 0;
}

export const photographerAllotmentService = {
  async fetchCreatedBetween(fromDate: string, toDate: string): Promise<ExternalPhotographerAllotment[]> {
    const url = new URL("/api/public/photographer-allotments", env.VSNAPU_JOB_MASTER_BASE_URL);
    url.searchParams.set("fromDate", fromDate);
    url.searchParams.set("toDate", toDate);
    url.searchParams.set("fromTime", "00:00");
    url.searchParams.set("toTime", "23:59");

    const response = await fetch(url);
    if (!response.ok) {
      throw Object.assign(
        new Error(`vsnapu Photographer Allotments API returned ${response.status}`),
        { status: 502 }
      );
    }

    const raw: unknown = await response.json();
    return parseArrayLenient(externalPhotographerAllotmentSchema, raw, "Photographer Allotments feed");
  },

  // No manual "Allot" step anymore — every job waiting at PHOTOGRAPHER_ALLOTMENT
  // is routed automatically the moment this runs: matched against vsnapu ->
  // straight to Final Photographer with that photographer's details; no match
  // -> Photographer Search, to be found manually there.
  //
  // Also repairs jobs a previous too-narrow sync already mis-routed (see
  // repairMisroutedJobs) — the old 7-day window meant any job allotted more
  // than a week earlier was recorded as having no photographer at all.
  async applyCreatedBetween(fromDate: string, toDate: string, actorUserId: number) {
    const window = matchWindow(fromDate, toDate);
    const allotments = await this.fetchCreatedBetween(window.from, window.to);

    const latestByJobId = new Map<string, ExternalPhotographerAllotment>();
    for (const allotment of allotments) {
      const existing = latestByJobId.get(allotment.jobId);
      if (!existing || new Date(allotment.allottedOn) >= new Date(existing.allottedOn)) {
        latestByJobId.set(allotment.jobId, allotment);
      }
    }

    const pendingJobs = await prisma.otpJob.findMany({
      where: { currentStage: "PHOTOGRAPHER_ALLOTMENT" },
      select: { id: true, jobId: true },
    });

    let matched = 0;
    let sentToSearch = 0;
    for (const job of pendingJobs) {
      const allotment = latestByJobId.get(job.jobId);
      if (allotment) {
        await otpStageService.advanceStage(
          job.id,
          {
            photographerAvailable: "Yes",
            photographerName: allotment.photographerName.trim(),
            photographerContact: allotment.mobile.trim(),
          },
          actorUserId
        );
        matched++;
      } else {
        await otpStageService.advanceStage(job.id, { photographerAvailable: "No" }, actorUserId);
        sentToSearch++;
      }
    }

    const repaired = await this.repairMisroutedJobs(latestByJobId);

    return {
      fetched: allotments.length,
      matched,
      sentToSearch,
      repaired,
    };
  },

  // Jobs sitting at Photographer Search whose PHOTOGRAPHER_ALLOTMENT event
  // recorded no photographer, but which vsnapu does have an allotment for.
  // Rewrites that stage event with the real photographer (rather than only
  // moving the job) — the Photographer Allotment table renders from the event
  // log, so leaving the stale "No" there would keep showing the wrong answer.
  async repairMisroutedJobs(latestByJobId: Map<string, ExternalPhotographerAllotment>): Promise<number> {
    if (latestByJobId.size === 0) return 0;

    const candidates = await prisma.otpJob.findMany({
      where: { currentStage: "PHOTOGRAPHER_SEARCH", jobId: { in: [...latestByJobId.keys()] } },
      select: {
        id: true,
        jobId: true,
        stageEvents: {
          where: { stage: "PHOTOGRAPHER_ALLOTMENT" },
          orderBy: { id: "desc" },
          take: 1,
          select: { id: true, data: true },
        },
      },
    });

    let repaired = 0;
    for (const job of candidates) {
      const event = job.stageEvents[0];
      if (!event || hasPhotographer(event.data)) continue;

      const allotment = latestByJobId.get(job.jobId)!;
      await prisma.$transaction([
        prisma.otpStageEvent.update({
          where: { id: event.id },
          data: {
            data: {
              ...(event.data as Record<string, unknown>),
              photographerAvailable: "Yes",
              photographerName: allotment.photographerName.trim(),
              photographerContact: allotment.mobile.trim(),
            } as Prisma.InputJsonValue,
          },
        }),
        prisma.otpJob.update({ where: { id: job.id }, data: { currentStage: "FINAL_PHOTOGRAPHER" } }),
      ]);
      repaired++;
    }

    return repaired;
  },
};
