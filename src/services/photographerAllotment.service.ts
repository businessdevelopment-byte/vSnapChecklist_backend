import { prisma } from "../config/database";
import { env } from "../config/env";
import { parseArrayLenient } from "../utils/externalApi";
import { otpStageService } from "./otpStage.service";
import {
  externalPhotographerAllotmentSchema,
  type ExternalPhotographerAllotment,
} from "../schemas/photographerAllotment.schemas";

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
  async applyCreatedBetween(fromDate: string, toDate: string, actorUserId: number) {
    const allotments = await this.fetchCreatedBetween(fromDate, toDate);

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

    return {
      fetched: allotments.length,
      matched,
      sentToSearch,
    };
  },
};
